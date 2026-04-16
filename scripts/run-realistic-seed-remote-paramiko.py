#!/usr/bin/env python3
import argparse
import json
import os
import posixpath
import re
import sys
import time
from pathlib import Path

import paramiko


REQUIRED_LOCAL_FILES = [
    "scripts/seed-realistic-test-server.mjs",
    "package.json",
    "package-lock.json",
    "server.js",
    "data/intake-schema.json",
    "data/followup-questions-schema.json",
]
REQUIRED_LOCAL_DIRS = [
    "server",
    "public",
]


def sh_quote(text: str) -> str:
    return "'" + text.replace("'", "'\"'\"'") + "'"


def ensure_local_files(repo_root: Path) -> None:
    for rel in REQUIRED_LOCAL_FILES:
        target = repo_root / rel
        if not target.is_file():
            raise RuntimeError(f"Missing required file: {target}")
    for rel in REQUIRED_LOCAL_DIRS:
        target = repo_root / rel
        if not target.is_dir():
            raise RuntimeError(f"Missing required directory: {target}")


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    normalized = posixpath.normpath(remote_dir)
    if normalized in ("", "/"):
        return
    current = "/"
    for part in normalized.strip("/").split("/"):
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)


def upload_file(sftp: paramiko.SFTPClient, local_file: Path, remote_file: str) -> None:
    ensure_remote_dir(sftp, posixpath.dirname(remote_file))
    sftp.put(str(local_file), remote_file)
    print(f"> [upload] {local_file} -> {remote_file}")


def upload_tree(sftp: paramiko.SFTPClient, local_dir: Path, remote_dir: str) -> None:
    for local_path in sorted(local_dir.rglob("*")):
        if not local_path.is_file():
            continue
        relative = local_path.relative_to(local_dir).as_posix()
        remote_path = posixpath.join(remote_dir, relative)
        upload_file(sftp, local_path, remote_path)


def run_remote_stream(client: paramiko.SSHClient, command: str, context: str) -> tuple[int, str]:
    print(f"> [remote] {command}")
    channel = client.get_transport().open_session()
    channel.exec_command(command)
    out_chunks = []
    err_chunks = []
    while True:
        if channel.recv_ready():
            chunk = channel.recv(65535).decode("utf-8", errors="replace")
            out_chunks.append(chunk)
            print(chunk, end="")
        if channel.recv_stderr_ready():
            chunk = channel.recv_stderr(65535).decode("utf-8", errors="replace")
            err_chunks.append(chunk)
            print(chunk, end="", file=sys.stderr)
        if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
            break
        time.sleep(0.1)
    code = channel.recv_exit_status()
    output = "".join(out_chunks)
    return code, output


def run_remote_capture(client: paramiko.SSHClient, command: str, context: str) -> str:
    print(f"> [remote] {command}")
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out, end="")
    if err.strip():
        print(err, end="", file=sys.stderr)
    if code != 0:
        detail = f"{out}\n{err}".strip().replace("\n", " ")
        detail = detail[:500] if detail else "No remote output."
        raise RuntimeError(f"{context} failed with exit code {code}. {detail}")
    return out


def run_remote(client: paramiko.SSHClient, command: str, log_command: bool = False) -> tuple[int, str, str]:
    if log_command:
        print(f"> [remote] {command}")
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def parse_artifacts_dir(output: str) -> str:
    match = re.search(r"SEED_ARTIFACTS=(.+)", output or "")
    return match.group(1).strip() if match else ""


def download_if_exists(sftp: paramiko.SFTPClient, remote_file: str, local_file: Path) -> bool:
    try:
        sftp.stat(remote_file)
    except OSError:
        return False
    local_file.parent.mkdir(parents=True, exist_ok=True)
    sftp.get(remote_file, str(local_file))
    return True


def write_local_failure_summary(local_dir: Path) -> None:
    seed_run_path = local_dir / "seed-run.json"
    if not seed_run_path.is_file():
      return
    payload = json.loads(seed_run_path.read_text(encoding="utf-8"))
    accounts = payload.get("metadata", {}).get("accounts", [])
    error = payload.get("metadata", {}).get("error", {})
    lines = [
        "# 测试服造数失败摘要",
        "",
        f"- 状态：{payload.get('status', '')}",
        f"- 阶段：{payload.get('phase', '')}",
        f"- 当前账号：{payload.get('currentActor', '')}",
        f"- 当前日期：{payload.get('currentDate', '')}",
        f"- 失败原因：{error.get('message', '')}",
        "",
        "## 账号信息",
        "",
        "| 角色 | 区域 | 姓名 | 账号 | 密码 | 状态 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for item in accounts:
        lines.append(
            f"| {item.get('role','')} | {item.get('regionId','')} | {item.get('name','')} | {item.get('account','')} | {item.get('password','')} | {item.get('status','')} |"
        )
    (local_dir / "local-failure-summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def wait_for_remote_health(client: paramiko.SSHClient, base_url: str, attempts: int = 12, sleep_seconds: int = 5) -> str:
    health_cmd = f"set -euo pipefail; curl -fsS {sh_quote(base_url.rstrip('/') + '/api/health')}"
    last_error = ""
    for attempt in range(1, attempts + 1):
        print(f"> [remote] {health_cmd} (attempt {attempt}/{attempts})")
        code, out, err = run_remote(client, health_cmd, log_command=False)
        if code == 0 and out.strip():
            print(out, end="")
            return out
        last_error = (err or out or f"exit code {code}").strip()
        if last_error:
            print(last_error, end="" if last_error.endswith("\n") else "\n", file=sys.stderr)
        if attempt < attempts:
            time.sleep(sleep_seconds)
    raise RuntimeError(f"Remote health preflight failed after {attempts} attempts. Last error: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload and run realistic seed script on TangProject test server.")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--server-host", required=True)
    parser.add_argument("--ssh-port", type=int, default=22)
    parser.add_argument("--server-user", default="root")
    parser.add_argument("--remote-dir", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:3000")
    parser.add_argument("--password-env-var", default="ALIYUN_SSH_PASSWORD")
    parser.add_argument("--day-count", type=int, default=7)
    parser.add_argument("--rollback-on-success", action="store_true")
    parser.add_argument("--no-rollback-on-failure", action="store_true")
    parser.add_argument("--skip-upload", action="store_true")
    parser.add_argument("--skip-install-deps", action="store_true")
    parser.add_argument("--no-chromium-install", action="store_true")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    ensure_local_files(repo_root)

    password = os.environ.get(args.password_env_var, "")
    if not password:
        raise RuntimeError(f"Missing SSH password in environment variable {args.password_env_var}.")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=args.server_host,
        port=args.ssh_port,
        username=args.server_user,
        password=password,
        look_for_keys=False,
        allow_agent=False,
        timeout=20,
        auth_timeout=20,
        banner_timeout=20,
    )
    transport = client.get_transport()
    if transport:
        transport.set_keepalive(30)

    artifacts_dir = ""
    try:
        remote_dir_q = sh_quote(args.remote_dir)
        prep_cmd = (
            "set -euo pipefail; "
            "command -v docker >/dev/null 2>&1 || { echo 'ERROR: docker is required.' >&2; exit 31; }; "
            "command -v npm >/dev/null 2>&1 || { echo 'ERROR: npm is required.' >&2; exit 32; }; "
            "command -v node >/dev/null 2>&1 || { echo 'ERROR: node is required.' >&2; exit 33; }; "
            "command -v curl >/dev/null 2>&1 || { echo 'ERROR: curl is required.' >&2; exit 34; }; "
            f"mkdir -p {remote_dir_q}/scripts {remote_dir_q}/server {remote_dir_q}/public {remote_dir_q}/data {remote_dir_q}/output/seed-runs"
        )
        run_remote_capture(client, prep_cmd, "Remote prerequisite check")

        if not args.skip_upload:
            sftp = client.open_sftp()
            try:
                for rel in REQUIRED_LOCAL_FILES:
                    upload_file(sftp, repo_root / rel, posixpath.join(args.remote_dir, rel.replace("\\", "/")))
                upload_tree(sftp, repo_root / "server", posixpath.join(args.remote_dir, "server"))
                upload_tree(sftp, repo_root / "public", posixpath.join(args.remote_dir, "public"))
            finally:
                sftp.close()

        if not args.skip_install_deps:
            install_cmd = f"set -euo pipefail; cd {remote_dir_q}; npm install --no-audit --no-fund"
            run_remote_capture(client, install_cmd, "Remote npm install")

        if not args.no_chromium_install:
            chromium_cmd = f"set -euo pipefail; cd {remote_dir_q}; npx playwright install chromium"
            run_remote_capture(client, chromium_cmd, "Remote Playwright install")

        sync_cmd = (
            "set -euo pipefail; "
            f"cd {remote_dir_q}; "
            "docker image inspect local/tang-project:latest >/dev/null 2>&1 || "
            "{ echo 'ERROR: local/tang-project:latest is missing on remote host.' >&2; exit 41; }; "
            "docker compose up -d --force-recreate --no-build tang-project; "
            "docker exec tang-project sh -lc 'rm -rf /app/server /app/public && mkdir -p /app/server /app/public'; "
            f"docker cp {remote_dir_q}/server.js tang-project:/app/server.js; "
            f"docker cp {remote_dir_q}/server/. tang-project:/app/server/; "
            f"docker cp {remote_dir_q}/public/. tang-project:/app/public/; "
            "docker restart tang-project"
        )
        run_remote_capture(client, sync_cmd, "Remote code sync before seed run")

        health_output = wait_for_remote_health(client, args.base_url)
        if '"simulation":{"enabled":false' not in health_output.replace(" ", ""):
            raise RuntimeError("Remote health preflight failed: simulation.enabled is not false.")

        run_cmd = (
            f"set -euo pipefail; cd {remote_dir_q}; "
            f"node scripts/seed-realistic-test-server.mjs --base-url {sh_quote(args.base_url)} --repo-root {remote_dir_q} --day-count {args.day_count}"
        )
        if args.rollback_on_success:
            run_cmd += " --rollback-on-success"
        if args.no_rollback_on_failure:
            run_cmd += " --no-rollback-on-failure"
        exit_code, output = run_remote_stream(client, run_cmd, "Remote realistic seed run")
        artifacts_dir = parse_artifacts_dir(output)
        if artifacts_dir:
            print(f"ARTIFACTS_DIR={artifacts_dir}")
            run_id = posixpath.basename(artifacts_dir.rstrip("/"))
            local_dir = repo_root / "output" / "seed-runs-local" / run_id
            sftp = client.open_sftp()
            try:
                download_if_exists(sftp, posixpath.join(artifacts_dir, "seed-run.json"), local_dir / "seed-run.json")
                download_if_exists(sftp, posixpath.join(artifacts_dir, "error.md"), local_dir / "error.md")
                download_if_exists(sftp, posixpath.join(artifacts_dir, "seed-report.md"), local_dir / "seed-report.md")
                download_if_exists(sftp, posixpath.join(artifacts_dir, "progress.log"), local_dir / "progress.log")
            finally:
                sftp.close()
            write_local_failure_summary(local_dir)
            print(f"LOCAL_ARTIFACTS_DIR={local_dir}")
        if exit_code != 0:
            detail = output.strip().replace("\n", " ")
            detail = detail[:500] if detail else "No remote output."
            raise RuntimeError(f"Remote realistic seed run failed with exit code {exit_code}. {detail}")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
