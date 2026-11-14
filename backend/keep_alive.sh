#!/usr/bin/env bash
# Script to run the keep-alive daemon in the background
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

SERVER_URL="${1:-http://127.0.0.1:8000}"
LOG_FILE="$DIR/keep_alive.log"

echo "=========================================================="
echo " Starting Keep-Alive Daemon in Background..."
echo " Target URL : $SERVER_URL"
echo " Log file   : $LOG_FILE"
echo "=========================================================="

# Check if already running
if pgrep -f "keep_alive.py" > /dev/null; then
    echo "Keep-alive is already running! (PID: $(pgrep -f "keep_alive.py"))"
    echo "To view logs: tail -f $LOG_FILE"
    exit 0
fi

nohup python3 keep_alive.py "$SERVER_URL" > "$LOG_FILE" 2>&1 &
PID=$!

echo "Started successfully with PID $PID"
echo "To monitor live logs, run: tail -f $LOG_FILE"
echo "To stop: kill $PID"

