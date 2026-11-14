#!/usr/bin/env python3
"""
PharmaTrack Backend Keep-Alive Daemon
Pings the backend health & db-check endpoints every 1 minute to prevent sleeping,
idle timeouts, and cold starts on cloud containers, Render, or Linux VMs.
"""

import sys
import os
import time
import urllib.request
import urllib.error
import json
from datetime import datetime

# Target URL from environment or CLI argument, defaulting to localhost:8000
SERVER_URL = os.environ.get("SERVER_URL")
if not SERVER_URL:
    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        SERVER_URL = sys.argv[1].rstrip("/")
    else:
        SERVER_URL = "http://127.0.0.1:8000"

SERVER_URL = SERVER_URL.rstrip("/")
INTERVAL_SECONDS = int(os.environ.get("KEEP_ALIVE_INTERVAL", "60"))

print("=" * 60)
print("  PharmaTrack Keep-Alive Daemon Started")
print(f"  Target Server : {SERVER_URL}")
print(f"  Ping Interval : {INTERVAL_SECONDS} seconds (1 minute)")
print("=" * 60)

endpoints = [
    f"{SERVER_URL}/api/health/",
    f"{SERVER_URL}/api/db-check/",
    # Maintain Render + Supabase backend active 24/7 so it never sleeps or idles
    "https://pharma-backend-drjq.onrender.com/api/health/",
    "https://pharma-backend-drjq.onrender.com/api/db-check/",
]

def ping(url):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    start = time.time()
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "PharmaTrack-KeepAlive/1.0"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            latency_ms = round((time.time() - start) * 1000, 1)
            status_code = resp.getcode()
            body = resp.read().decode("utf-8")
            try:
                data = json.loads(body)
                service_status = data.get("status", "ok")
                db_status = data.get("database", "")
                details = f"status={service_status}"
                if db_status:
                    details += f", db={db_status}"
            except Exception:
                details = "ok"

            print(f"[{ts}] SUCCESS {status_code} ({latency_ms}ms) -> {url} [{details}]", flush=True)
            return True
    except urllib.error.HTTPError as e:
        latency_ms = round((time.time() - start) * 1000, 1)
        print(f"[{ts}] HTTP ERROR {e.code} ({latency_ms}ms) -> {url}", flush=True)
        return False
    except Exception as e:
        latency_ms = round((time.time() - start) * 1000, 1)
        print(f"[{ts}] FAILED ({latency_ms}ms) -> {url}: {e}", flush=True)
        return False

def main():
    consecutive_failures = 0
    while True:
        success = True
        for ep in endpoints:
            if not ping(ep):
                success = False

        if success:
            consecutive_failures = 0
        else:
            consecutive_failures += 1
            if consecutive_failures >= 3:
                ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                print(f"[{ts}] WARNING: 3 consecutive failed pings! Checking network/service status...", flush=True)

        time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nKeep-alive daemon stopped by user.")
        sys.exit(0)

