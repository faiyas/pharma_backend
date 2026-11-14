#!/usr/bin/env bash
# ==============================================================================
# Start PharmaTrack Django Backend + Keep-Alive Daemon in Background
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# 1. Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 2. Ensure PostgreSQL service is active
sudo service postgresql start || sudo systemctl start postgresql 2>/dev/null || true

# 3. Apply any pending database migrations
python manage.py migrate --no-input

# 4. Stop any old lingering processes on port 8000
pkill -f "gunicorn.*config.wsgi" 2>/dev/null || true
pkill -f "python.*manage.py.*runserver" 2>/dev/null || true
pkill -f "keep_alive.py" 2>/dev/null || true
sleep 1

# 5. Start Gunicorn in background on 0.0.0.0:8000
echo "==> Starting Gunicorn production server on 0.0.0.0:8000 in background..."
nohup gunicorn --bind 0.0.0.0:8000 --workers 3 --timeout 120 config.wsgi:application > django.log 2>&1 &
DJANGO_PID=$!
echo "    Gunicorn started (PID: $DJANGO_PID). Log: django.log"

# 6. Start 1-minute Keep-Alive daemon in background
echo "==> Starting 1-minute Keep-Alive daemon in background..."
chmod +x keep_alive.py
nohup python3 keep_alive.py "http://127.0.0.1:8000" > keep_alive.log 2>&1 &
KEEP_PID=$!
echo "    Keep-Alive started (PID: $KEEP_PID). Log: keep_alive.log"

sleep 2
echo "=========================================================="
echo " SUCCESS: Backend and Keep-Alive are running in background!"
echo " Public URL : https://8000-agq5qlr2uletnjyzudtddvxrdq.instabox.tech"
echo " Health API : https://8000-agq5qlr2uletnjyzudtddvxrdq.instabox.tech/api/health/"
echo " Admin URL  : https://8000-agq5qlr2uletnjyzudtddvxrdq.instabox.tech/admin/"
echo " View Logs  : tail -f django.log  OR  tail -f keep_alive.log"
echo "=========================================================="
