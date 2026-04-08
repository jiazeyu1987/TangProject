#!/usr/bin/env python3
import argparse
import json
import os
import posixpath
import sys
import time
from pathlib import Path

import paramiko


REQUIRED_ROOT_FILES = [
    ".dockerignore",
    "Dockerfile",
    "docker-compose.yml",
    "package.json",
    "package-lock.json",
    "server.js",
    "README.md",
]
REQUIRED_PUBLIC_FILES = [
    "public/index.html",
    "public/app.js",
    "public/styles.css",
]
REQUIRED_DATA_FILES = [
    "data/intake-schema.json",
    "data/seed-store.json",
]


def sh_quote(text: str) -> str:
    return "'" + text.replace("'", "'\"'\"'") + "'"


def run_remote_checked(client: paramiko.SSHClient, command: str, context: str) -> str:
    code, out, err = run_remote(client, command, log_command=True)
    if out:
        print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)
    if code != 0:
        raise RuntimeError(f"{context} failed with exit code {code}.")
    return out


def run_remote(client: paramiko.SSHClient, command: str, log_command: bool = False) -> tuple[int, str, str]:
    if log_command:
        print(f"> [remote] {command}")
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


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


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    ensure_remote_dir(sftp, posixpath.dirname(remote))
    sftp.put(str(local), remote)
    print(f"> [upload] {local} -> {remote}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy TangProject to Aliyun via Paramiko (password auth).")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--deploy-env-file", required=True)
    parser.add_argument("--server-host", required=True)
    parser.add_argument("--ssh-port", type=int, default=22)
    parser.add_argument("--server-user", default="root")
    parser.add_argument("--remote-dir", required=True)
    parser.add_argument("--service-port", type=int, default=3000)
    parser.add_argument("--password-env-var", default="ALIYUN_SSH_PASSWORD")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    deploy_env_file = Path(args.deploy_env_file).resolve()
    password = os.environ.get(args.password_env_var, "")
    if not password:
        raise RuntimeError(
            f"Missing SSH password in environment variable {args.password_env_var}."
        )

    all_files = REQUIRED_ROOT_FILES + REQUIRED_PUBLIC_FILES + REQUIRED_DATA_FILES
    for rel in all_files:
        path = repo_root / rel
        if not path.is_file():
            raise RuntimeError(f"Missing required file before upload: {path}")
    if not deploy_env_file.is_file():
        raise RuntimeError(f"Missing deploy env file before upload: {deploy_env_file}")

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())

    try:
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

        remote_dir_q = sh_quote(args.remote_dir)
        prep_cmd = (
            "set -euo pipefail; "
            "command -v docker >/dev/null 2>&1 || { echo 'ERROR: docker is required on remote host.' >&2; exit 31; }; "
            "docker compose version >/dev/null 2>&1 || { echo 'ERROR: docker compose plugin is required on remote host.' >&2; exit 32; }; "
            "command -v curl >/dev/null 2>&1 || { echo 'ERROR: curl is required on remote host.' >&2; exit 33; }; "
            f"mkdir -p {remote_dir_q}/public {remote_dir_q}/data"
        )
        run_remote_checked(client, prep_cmd, "Remote prerequisite check")

        sftp = client.open_sftp()
        try:
            for rel in REQUIRED_ROOT_FILES:
                upload_file(sftp, repo_root / rel, posixpath.join(args.remote_dir, rel))
            for rel in REQUIRED_PUBLIC_FILES:
                remote = posixpath.join(args.remote_dir, rel.replace("\\", "/"))
                upload_file(sftp, repo_root / rel, remote)
            for rel in REQUIRED_DATA_FILES:
                remote = posixpath.join(args.remote_dir, rel.replace("\\", "/"))
                upload_file(sftp, repo_root / rel, remote)
            upload_file(sftp, deploy_env_file, posixpath.join(args.remote_dir, ".env.deploy"))
        finally:
            sftp.close()

        deploy_cmd = (
            "set -euo pipefail; "
            f"cd {remote_dir_q}; "
            "cp .env.deploy .env.example; "
            "docker compose build --no-cache tang-project; "
            "docker compose up -d --force-recreate tang-project; "
            "docker compose ps tang-project"
        )
        run_remote_checked(client, deploy_cmd, "Remote deploy")

        internal_health_cmd = f"curl -fsS http://127.0.0.1:{args.service_port}/api/health"
        internal_health_raw = ""
        for attempt in range(1, 13):
            print(f"> [remote] {internal_health_cmd} (attempt {attempt}/12)")
            code, out, err = run_remote(client, internal_health_cmd, log_command=False)
            if code == 0:
                internal_health_raw = out.strip()
                break
            if err:
                print(err, end="", file=sys.stderr)
            if attempt == 12:
                raise RuntimeError(
                    f"Remote internal health check failed after 12 attempts (last exit code {code})."
                )
            time.sleep(5)
        if not internal_health_raw:
            raise RuntimeError("Remote internal health check returned empty body.")
        internal_health = json.loads(internal_health_raw)
        if not internal_health.get("configured"):
            raise RuntimeError(
                "Remote internal health check failed: configured=false, "
                f"authStatus={internal_health.get('authStatus', '')}"
            )

        print("INTERNAL_HEALTH_OK")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
