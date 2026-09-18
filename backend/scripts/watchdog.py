#!/usr/bin/env python3
"""Run a command and exit as soon as its parent process disappears.

This is the safety net that guarantees the Aegis dev servers never outlive the
launcher (dev.sh / dev.ps1), even when the launcher is killed with SIGKILL or
the terminal window is closed abruptly -- neither of which gives the launcher a
chance to clean up after itself.

Usage:
    python watchdog.py                  # starts `uvicorn aegis.main:app`
    python watchdog.py -- node server.js

The parent is watched through a heartbeat file that the launcher refreshes.
When the beat stalls, this process (and the process group the child creates,
where the platform supports it) is shut down.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time

DEFAULT_BEAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".aegis-heartbeat")


def _argv() -> list[str]:
    args = sys.argv[1:]
    if args and args[0] == "--":
        args = args[1:]
    if args:
        return args
    return [
        sys.executable,
        "-m",
        "uvicorn",
        "aegis.main:app",
        "--host",
        os.environ.get("AEGIS_HOST", "0.0.0.0"),
        "--port",
        os.environ.get("AEGIS_PORT", "8000"),
    ]


def _descendants(root: int) -> list[int]:
    """Every transitive child of `root` (best effort; POSIX via ps)."""
    if os.name == "nt":
        return []
    try:
        out = subprocess.run(
            ["ps", "-A", "-o", "pid=,ppid="], capture_output=True, text=True, timeout=5
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    children: dict[int, list[int]] = {}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) != 2:
            continue
        try:
            pid, ppid = int(parts[0]), int(parts[1])
        except ValueError:
            continue
        children.setdefault(ppid, []).append(pid)
    found: list[int] = []
    stack = [root]
    while stack:
        for kid in children.get(stack.pop(), []):
            if kid not in found:
                found.append(kid)
                stack.append(kid)
    return found


def _stop(child: subprocess.Popen) -> None:
    """Terminate the child and every process it spawned."""
    if child.poll() is not None:
        return

    if os.name == "nt":
        try:
            subprocess.run(
                ["taskkill", "/PID", str(child.pid), "/T", "/F"],
                capture_output=True,
                timeout=10,
            )
        except (OSError, subprocess.SubprocessError):
            try:
                child.kill()
            except OSError:
                pass
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        return

    # POSIX: signal the group first (covers shell wrappers), then sweep the
    # descendant tree, since tools like Vite can detach from the group.
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            child.terminate()
        except OSError:
            pass

    deadline = time.time() + 4
    while time.time() < deadline and child.poll() is None:
        time.sleep(0.2)

    for sig in (signal.SIGTERM, signal.SIGKILL):
        for pid in _descendants(child.pid):
            try:
                os.kill(pid, sig)
            except OSError:
                pass
        try:
            os.killpg(child.pid, sig)
        except OSError:
            pass
        try:
            child.wait(timeout=3)
            break
        except subprocess.TimeoutExpired:
            continue


def main() -> int:
    beat_path = os.environ.get("AEGIS_HEARTBEAT", DEFAULT_BEAT)
    timeout = float(os.environ.get("AEGIS_HEARTBEAT_TIMEOUT", "10"))

    # Own process group so the child tree can be signalled as a unit.
    if os.name != "nt":
        try:
            os.setpgrp()
        except OSError:
            pass

    argv = _argv()
    child = subprocess.Popen(argv)

    stop_reason: list[str] = []

    def watch() -> None:
        seen = False
        while True:
            try:
                mtime = os.path.getmtime(beat_path)
                seen = True
            except OSError:
                if seen:
                    stop_reason.append("launcher heartbeat removed")
                    break
                mtime = 0.0
            if seen and (time.time() - mtime) > timeout:
                stop_reason.append("launcher heartbeat stale")
                break
            if child.poll() is not None:
                return
            time.sleep(0.5)
        _stop(child)

    threading.Thread(target=watch, daemon=True).start()

    def forward(signum, _frame):
        stop_reason.append(f"signal {signum}")
        _stop(child)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, forward)
        except (ValueError, OSError):
            pass

    code = child.wait()
    if stop_reason and os.environ.get("AEGIS_WATCHDOG_VERBOSE"):
        print(f"[watchdog] stopped: {stop_reason[0]}", file=sys.stderr)
    return 0 if stop_reason and code < 0 else code


if __name__ == "__main__":
    sys.exit(main())
