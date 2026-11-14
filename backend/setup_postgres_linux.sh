#!/usr/bin/env bash
# ==============================================================================
# Complete Linux Setup: PostgreSQL Database + Django Backend
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " 1. Installing & Configuring PostgreSQL on Linux..."
echo "=========================================================="

# 1. Install PostgreSQL if not installed
if ! command -v psql >/dev/null 2>&1; then
    echo "==> Installing PostgreSQL via apt..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib libpq-dev python3-dev
fi

# 2. Start PostgreSQL service
echo "==> Ensuring PostgreSQL service is running..."
sudo service postgresql start || sudo systemctl start postgresql

# 3. Create Database & User
DB_NAME="pharma_db"
DB_USER="pharma_user"
DB_PASS="pharma_password"

echo "==> Setting up database '$DB_NAME' and user '$DB_USER'..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo "=========================================================="
echo " 2. Setting up Python Environment & Django..."
echo "=========================================================="

# Create .env file for Django
cat <<EOF > .env
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SECRET_KEY=django-insecure-pharma-local-linux-setup-key-2026
DEBUG=True
ALLOWED_HOSTS=*
CORS_ALLOW_ALL_ORIGINS=True
DJANGO_SUPERUSER_USERNAME=faiyas
DJANGO_SUPERUSER_PASSWORD=Admin@1234
DJANGO_SUPERUSER_EMAIL=admin@pharmacy.com
EOF

echo "==> Generated .env file configured for local PostgreSQL."

# Setup Python Virtualenv
if [ ! -d "venv" ]; then
    echo "==> Creating virtual environment..."
    python3 -m venv venv || python -m venv venv
fi

echo "==> Activating virtual environment..."
source venv/bin/activate

echo "==> Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Run migrations against local PostgreSQL
echo "=========================================================="
echo " 3. Applying Database Migrations to PostgreSQL..."
echo "=========================================================="
python manage.py migrate

# Initialize SuperAdmin
echo "==> Creating default Super Admin account..."
python manage.py initadmin || true

echo "=========================================================="
echo " SUCCESS! Database and Backend are fully configured!"
echo "----------------------------------------------------------"
echo " Database Engine : PostgreSQL (localhost:5432/pharma_db)"
echo " API Server URL  : http://0.0.0.0:8000/api/"
echo " Admin Panel     : http://0.0.0.0:8000/admin/"
echo " SuperAdmin User : faiyas"
echo " SuperAdmin Pass : Admin@1234"
echo "=========================================================="
echo " Starting Django Server on 0.0.0.0:8000 (Ctrl+C to stop)..."
exec python manage.py runserver 0.0.0.0:8000
