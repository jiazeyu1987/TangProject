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


REQUIRED_ROOT_FILES = [
    "package.json",
    "package-lock.json",
    "server.js",
    "Dockerfile",
    ".dockerignore",
]
REQUIRED_PUBLIC_FILES = [
    "public/index.html",
    "public/app.js",
    "public/styles.css",
]
REQUIRED_STATIC_DATA_FILES = [
    "data/intake-schema.json",
    "data/followup-questions-schema.json",
    "data/seed-store.json",
]


def sh_quote(text: str) -> str:
    return "'" + text.replace("'", "'\"'\"'") + "'"


def ensure_local_files(repo_root: Path) -> None:
    for rel in REQUIRED_ROOT_FILES + REQUIRED_PUBLIC_FILES + REQUIRED_STATIC_DATA_FILES:
        target = repo_root / rel
        if not target.is_file():
            raise RuntimeError(f"Missing required file: {target}")
    simulation_dir = repo_root / "simulation"
    if not simulation_dir.is_dir():
        raise RuntimeError(f"Missing required directory: {simulation_dir}")


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    remote_dir = posixpath.normpath(remote_dir)
    if remote_dir in ("", "/"):
        return
    parts = remote_dir.strip("/").split("/")
    current = "/"
    for part in parts:
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


def run_remote(client: paramiko.SSHClient, command: str, context: str, stream: bool = True) -> str:
    print(f"> [remote] {command}")
    if stream:
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
        if code != 0:
            detail = "".join((out_chunks + err_chunks)).strip().replace("\n", " ")
            detail = detail[:500] if detail else "No remote output."
            raise RuntimeError(f"{context} failed with exit code {code}. {detail}")
        return output

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


def list_remote_runs(client: paramiko.SSHClient, remote_dir: str) -> list[str]:
    runs_root = posixpath.join(remote_dir, "output", "simulations")
    output = run_remote(
        client,
        f"set -euo pipefail; if [ -d {sh_quote(runs_root)} ]; then ls -1 {sh_quote(runs_root)}; fi",
        "List remote simulation runs",
        stream=False,
    )
    return [line.strip() for line in output.splitlines() if line.strip()]


def parse_run_id_from_output(text: str) -> str:
    match = re.search(r'"runId"\s*:\s*"([^"]+)"', text or "")
    return match.group(1) if match else ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Run TangProject simulation on remote server with Paramiko.")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--server-host", required=True)
    parser.add_argument("--ssh-port", type=int, default=22)
    parser.add_argument("--server-user", default="root")
    parser.add_argument("--remote-dir", required=True)
    parser.add_argument("--scenario", default="default-month")
    parser.add_argument("--password-env-var", default="ALIYUN_SSH_PASSWORD")
    parser.add_argument("--skip-upload", action="store_true")
    parser.add_argument("--skip-install-deps", action="store_true")
    parser.add_argument("--no-chromium-install", action="store_true")
    args = parser.parse_args()

    if not re.match(r"^[A-Za-z0-9._-]+$", args.scenario):
        raise RuntimeError(
            "Scenario name is invalid. Allowed chars: A-Z, a-z, 0-9, dot, underscore, hyphen."
        )

    repo_root = Path(args.repo_root).resolve()
    ensure_local_files(repo_root)

    password = os.environ.get(args.password_env_var, "")
    if not password:
        raise RuntimeError(
            f"Missing SSH password in environment variable {args.password_env_var}."
        )

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

    try:
        remote_dir_q = sh_quote(args.remote_dir)
        prep_cmd = (
            "set -euo pipefail; "
            "command -v docker >/dev/null 2>&1 || { echo 'ERROR: docker is required on remote host.' >&2; exit 31; }; "
            "command -v npm >/dev/null 2>&1 || { echo 'ERROR: npm is required on remote host.' >&2; exit 32; }; "
            "command -v codex >/dev/null 2>&1 || { echo 'ERROR: codex CLI is required on remote host.' >&2; exit 33; }; "
            f"mkdir -p {remote_dir_q}/public {remote_dir_q}/data {remote_dir_q}/simulation"
        )
        run_remote(client, prep_cmd, "Remote prerequisite check")

        if not args.skip_upload:
            sftp = client.open_sftp()
            try:
                for rel in REQUIRED_ROOT_FILES:
                    upload_file(sftp, repo_root / rel, posixpath.join(args.remote_dir, rel))
                for rel in REQUIRED_PUBLIC_FILES:
                    upload_file(sftp, repo_root / rel, posixpath.join(args.remote_dir, rel))
                for rel in REQUIRED_STATIC_DATA_FILES:
                    upload_file(sftp, repo_root / rel, posixpath.join(args.remote_dir, rel))
                upload_tree(
                    sftp,
                    repo_root / "simulation",
                    posixpath.join(args.remote_dir, "simulation"),
                )
            finally:
                sftp.close()

        if not args.skip_install_deps:
            install_cmd = f"set -euo pipefail; cd {remote_dir_q}; npm install --no-audit --no-fund"
            run_remote(client, install_cmd, "Remote npm install", stream=False)

        if not args.no_chromium_install:
            chromium_cmd = f"set -euo pipefail; cd {remote_dir_q}; npx playwright install chromium"
            run_remote(client, chromium_cmd, "Remote Playwright install", stream=False)

        run_remote(client, "set -euo pipefail; codex login status", "Remote Codex login status")

        runs_before = set(list_remote_runs(client, args.remote_dir))
        run_cmd = (
            f"set -euo pipefail; cd {remote_dir_q}; npm run sim:month -- --scenario {args.scenario}"
        )

        output = ""
        run_command_error = ""
        try:
            output = run_remote(client, run_cmd, "Remote simulation run")
        except Exception as exc:
            run_command_error = str(exc)

        runs_after = list_remote_runs(client, args.remote_dir)
        runs_after_set = set(runs_after)
        new_runs = sorted(runs_after_set - runs_before)
        run_id = parse_run_id_from_output(output)
        if not run_id:
            if new_runs:
                run_id = new_runs[-1]
            elif runs_after:
                run_id = sorted(runs_after)[-1]

        if not run_id:
            if run_command_error:
                raise RuntimeError(
                    f"{run_command_error} Also could not locate any simulation run output under {args.remote_dir}/output/simulations."
                )
            raise RuntimeError(
                "Remote simulation finished but runId was not found in output and no run directory was detected."
            )

        manifest_path = posixpath.join(
            args.remote_dir, "output", "simulations", run_id, "run-manifest.json"
        )
        manifest_text = run_remote(client, f"cat {sh_quote(manifest_path)}", "Read remote run manifest", stream=False)
        manifest = json.loads(manifest_text)
        status = str(manifest.get("status", ""))
        if status != "completed":
            command_suffix = f" command_error={run_command_error}" if run_command_error else ""
            raise RuntimeError(
                f"Remote simulation run failed. runId={run_id}, status={status}, error={manifest.get('error', '')}{command_suffix}"
            )

        report_path = posixpath.join(
            args.remote_dir, "output", "simulations", run_id, "final-report.md"
        )
        print("")
        print("REMOTE_SIMULATION_OK")
        print(f"RUN_ID={run_id}")
        print(f"MANIFEST_PATH={manifest_path}")
        print(f"REPORT_PATH={report_path}")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
