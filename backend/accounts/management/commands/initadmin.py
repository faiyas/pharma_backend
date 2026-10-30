import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = "Creates an initial super admin account if none exists."

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "faiyas")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "Admin@1234")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@pharmacy.com")

        if not User.objects.filter(is_superuser=True).exists():
            self.stdout.write(f"Creating default superuser '{username}'...")
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                role="SUPER_ADMIN",
                must_change_password=False,
            )
            user.first_name = "Super"
            user.last_name = "Admin"
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' created successfully!"))
        else:
            self.stdout.write("Superuser already exists. Skipping initialization.")
