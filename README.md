# Pharmacy Attendance — React + Django + SQLite
Starter MVP: React/Vite, Django REST Framework, JWT, SQLite, three roles, GPS shop registration, 50m default geofence, count-based employee accounts, camera-only selfie capture, attendance and evidence review.

## Run
Backend (Python 3.10+):
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations accounts shops attendance auditlog
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```
Set the superuser role using `python manage.py shell`:
```python
from accounts.models import User
u=User.objects.get(username="YOUR_USERNAME")
u.role="SUPER_ADMIN"; u.must_change_password=False; u.save()
```
Frontend (Node 18+), in another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. Sign in with the superuser.

## Rules
- Shop creators: Super Admin and Manager. Browser geolocation fetches shop coordinates at creation; creator should be physically at the shop and confirm permission.
- Radius defaults to 50m and is editable per shop (20–500m). 50m is a reasonable starting value for compact shops, not a universal guarantee. Test actual phones and shop environments. Attendance is rejected if GPS accuracy is worse than 35m; tune after field testing.
- Employee IDs: first created shop gets S1001 onward, second S2001 onward, etc. This initial scheme supports nine shop prefixes; extend before scaling beyond nine.
- Employee temporary password is 1234; change is mandatory at first login. Passwords are stored hashed.
- Attendance requires a fresh GPS reading and live camera JPEG. No gallery/file input is included in the UI. Check-in and check-out both require selfie evidence.
- Selfies are compressed then stored as Base64 data URLs in SQLite for this starter. Base64 itself increases size; for production use private object storage such as Supabase Storage and store only the private object key in PostgreSQL.
- GPS can be inaccurate or spoofed, and browser camera capture cannot prove a genuine camera sensor on a compromised device. This is not a certified anti-fraud system.
- Use HTTPS in deployment. Set a strong SECRET_KEY, production hosts/CORS, backups, retention policy, privacy notice and access controls before real use. SQLite is for prototype/small initial use; use PostgreSQL/Supabase for concurrent production workloads.
