#!/usr/bin/env bash
# Script to set up and run the Django backend on Linux
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================="
echo " Starting PharmaTrack Backend on Linux"
echo "=========================================="

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "==> Creating Python virtual environment (venv)..."
    python3 -m venv venv || python -m venv venv
fi

# Activate virtual environment
echo "==> Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "==> Installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt

# Run migrations
echo "==> Applying database migrations..."
python manage.py migrate

# Initialize admin account
if python manage.py help initadmin >/dev/null 2>&1; then
    echo "==> Ensuring super admin user exists..."
    python manage.py initadmin || true
fi

# Start Django development server
PORT="${PORT:-8000}"
echo "=========================================="
echo " Backend running at http://0.0.0.0:$PORT"
echo " Press Ctrl+C to stop"
echo "=========================================="
exec python manage.py runserver 0.0.0.0:$PORT

