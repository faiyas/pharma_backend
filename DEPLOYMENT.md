# Pharmacy Attendance — Live Production Deployment Guide

This guide walks you step-by-step through deploying your Pharmacy Attendance fullstack application to live production:
- **Database**: [Supabase](https://supabase.com) (PostgreSQL)
- **Backend API**: [Render](https://render.com) (Django + Gunicorn + WhiteNoise)
- **Frontend App**: [Vercel](https://vercel.com) (React + Vite)

---

## 1. Step 1: Set Up Supabase Database (PostgreSQL)

1. Go to **[https://supabase.com](https://supabase.com)** and sign in / sign up.
2. Click **"New project"**.
3. Fill in:
   - **Name**: `pharmacy-attendance`
   - **Database Password**: Choose a strong password (save this, you will need it).
   - **Region**: Choose the closest region (e.g. *South Asia (Mumbai)* or *Singapore*).
4. Click **"Create new project"** and wait ~1 minute for provisioning.
5. In your project dashboard:
   - Go to **Project Settings** (gear icon) ➔ **Database**.
   - Scroll down to **Connection parameters** or **Connection string**.
   - Select the **URI** tab.
   - Choose **Transaction pooler** (recommended for serverless/Render) or **Session**:
     ```text
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - Replace `[YOUR-PASSWORD]` with your actual Supabase database password.
   - **Copy this URL** — this is your `DATABASE_URL`.

---

## 2. Step 2: Push Code to GitHub

Render and Vercel automatically build and deploy from GitHub.

Open your terminal in the project root (`pharmacy_attendance_fullstack`) and run:

```bash
# Initialize git
git init

# Stage all files (.gitignore is already set up to exclude node_modules and .venv)
git add .

# Commit
git commit -m "Initial commit for production deployment"

# Link to your GitHub repository (create a new private or public repository on GitHub first)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/pharmacy-attendance.git
git branch -M main
git push -u origin main
```

---

## 3. Step 3: Deploy Backend on Render

1. Sign in to **[https://render.com](https://render.com)**.
2. Click **"New +"** ➔ **"Web Service"**.
3. Connect your GitHub repository (`pharmacy-attendance`).
4. Configure the Web Service:
   - **Name**: `pharmacy-attendance-api` (or your choice)
   - **Region**: Same or nearest region to your Supabase DB (e.g. *Singapore* or *Frankfurt*)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     chmod +x build.sh && ./build.sh
     ```
     *(or: `pip install -r requirements.txt && python manage.py collectstatic --no-input && python manage.py migrate && python manage.py initadmin`)*
   - **Start Command**:
     ```bash
     gunicorn config.wsgi:application
     ```
   - **Instance Type**: `Free`

5. In **Environment Variables**, add the following keys:

| Key | Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres...` | Your Supabase connection string from Step 1 |
| `SECRET_KEY` | *(generate random 50 chars)* | Django secret key |
| `DEBUG` | `False` | Production mode |
| `ALLOWED_HOSTS` | `*` | Or `.onrender.com` |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | Allows Vercel frontend |
| `DJANGO_SUPERUSER_USERNAME` | `faiyas` | Default Super Admin username |
| `DJANGO_SUPERUSER_PASSWORD` | `YourSecurePassword123` | Default Super Admin password |
| `DJANGO_SUPERUSER_EMAIL` | `admin@pharmacy.com` | Admin email |

6. Click **"Deploy Web Service"**.
7. Watch the Render build logs. It will:
   - Install dependencies (`psycopg2-binary`, `whitenoise`, `gunicorn`, etc.)
   - Collect static files
   - Run migrations on your Supabase Postgres database
   - Automatically create your `faiyas` Super Admin account via `initadmin`
8. Once finished, copy your Render live URL:
   `https://pharmacy-attendance-api.onrender.com`

---

## 4. Step 4: Deploy Frontend on Vercel

1. Sign in to **[https://vercel.com](https://vercel.com)**.
2. Click **"Add New..."** ➔ **"Project"**.
3. Import your GitHub repository (`pharmacy-attendance`).
4. In the project setup screen:
   - **Project Name**: `pharmacy-attendance`
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`frontend`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:

| Key | Value |
|---|---|
| `VITE_API_BASE` | `https://pharmacy-attendance-api.onrender.com` *(your Render backend URL from Step 3 without trailing slash)* |

6. Click **"Deploy"**.
7. In ~30 seconds, your site will be live at:
   `https://pharmacy-attendance.vercel.app` (or similar).

---

## 5. Step 5: Test & Verify Live Deployment

1. Open your Vercel URL on your mobile phone or laptop browser:
   `https://pharmacy-attendance.vercel.app`
2. Since Vercel serves on genuine **HTTPS**, your mobile browser (Android Chrome, iOS Safari) will natively allow:
   - **Camera Permission**: Live face capture with guidance oval.
   - **GPS Geolocation Permission**: Exact branch distance calculation.
3. Sign in with your Super Admin account:
   - **Username**: `faiyas` (or whatever you configured in Render)
   - **Password**: The password you set in `DJANGO_SUPERUSER_PASSWORD`
4. Register your pharmacy shop, generate employee accounts, and punch attendance!
