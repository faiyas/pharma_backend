#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
elif [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
fi

if [ -d "backend" ]; then
    cd backend
fi

echo "==> Collecting static files..."
python manage.py collectstatic --no-input

echo "==> Applying database migrations..."
python manage.py migrate

if python manage.py help initadmin >/dev/null 2>&1; then
    echo "==> Initializing superuser if needed..."
    python manage.py initadmin || true
fi

echo "==> Build complete!"
