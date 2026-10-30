from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone
import time

class Command(BaseCommand):
    help = 'Executes a database check ping (SELECT 1) and reports connection health and latency'

    def handle(self, *args, **options):
        self.stdout.write(f'[{timezone.now().isoformat()}] Starting database health check...')
        start = time.time()
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1;')
                row = cursor.fetchone()
            latency = round((time.time() - start) * 1000, 2)
            self.stdout.write(self.style.SUCCESS(
                f'[{timezone.now().isoformat()}] Database OK: result={row[0]}, latency={latency}ms'
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'[{timezone.now().isoformat()}] Database FAILED: {e}'
            ))
            raise
