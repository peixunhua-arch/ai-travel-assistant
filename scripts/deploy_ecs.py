#!/usr/bin/env python3
"""Deploy tuling server to Aliyun ECS via SSH password auth."""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import paramiko
import urllib.request

HOST = "47.99.246.14"
USER = "root"
REMOTE_DIR = "/root/ai-travel-assistant"
BRANCH = "TT"
REPO = "https://github.com/peixunhua-arch/ai-travel-assistant.git"
ROOT = Path(__file__).resolve().parents[1]


def _safe_print(text: str) -> None:
    enc = getattr(sys.stdout, "encoding", None) or "utf-8"
    sys.stdout.buffer.write((text + ("\n" if not text.endswith("\n") else "")).encode(enc, errors="replace"))
    sys.stdout.flush()


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> str:
    _safe_print(f"$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        _safe_print(out)
    if err.strip():
        _safe_print(err)
    if code != 0:
        raise RuntimeError(f"remote exit {code}: {cmd}\n{out[-2000:]}\n{err[-2000:]}")
    return out


def sftp_put(ssh: paramiko.SSHClient, local: Path, remote: str) -> None:
    print(f"scp {local} -> {remote}")
    sftp = ssh.open_sftp()
    sftp.put(str(local), remote)
    sftp.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--password", required=True)
    args = ap.parse_args()

    env_file = ROOT / "apps" / "server" / ".env"
    bootstrap = ROOT / "scripts" / "ecs-bootstrap.sh"
    if not env_file.exists():
        raise SystemExit(f"missing {env_file}")
    if not bootstrap.exists():
        raise SystemExit(f"missing {bootstrap}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"connecting {USER}@{HOST} ...")
    ssh.connect(HOST, username=USER, password=args.password, timeout=20, allow_agent=False, look_for_keys=False)

    run(
        ssh,
        "export DEBIAN_FRONTEND=noninteractive; "
        "apt-get update -qq; "
        "apt-get install -y -qq git curl ca-certificates >/dev/null",
    )
    run(
        ssh,
        f"if [ ! -d {REMOTE_DIR}/.git ]; then "
        f"git clone -b {BRANCH} {REPO} {REMOTE_DIR}; "
        f"else cd {REMOTE_DIR} && git fetch origin && git checkout {BRANCH} && "
        f"git pull --ff-only origin {BRANCH} || true; fi",
    )
    run(ssh, f"mkdir -p {REMOTE_DIR}/scripts {REMOTE_DIR}/apps/server")
    sftp_put(ssh, env_file, f"{REMOTE_DIR}/apps/server/.env")
    sftp_put(ssh, bootstrap, f"{REMOTE_DIR}/scripts/ecs-bootstrap.sh")
    run(ssh, f"sed -i 's/\\r$//' {REMOTE_DIR}/scripts/ecs-bootstrap.sh && chmod +x {REMOTE_DIR}/scripts/ecs-bootstrap.sh")
    run(ssh, f"bash {REMOTE_DIR}/scripts/ecs-bootstrap.sh", timeout=1200)

    ssh.close()
    time.sleep(2)
    try:
        with urllib.request.urlopen(f"http://{HOST}:3000/health", timeout=10) as r:
            body = r.read().decode()
            print("public health:", body)
    except Exception as e:
        print("public health failed:", e)
        return 2
    print("DEPLOY OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
