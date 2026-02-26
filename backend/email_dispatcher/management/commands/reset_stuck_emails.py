# email_dispatcher/management/commands/reset_stuck_emails.py
from django.core.management.base import BaseCommand
from email_dispatcher.models import DispatchEmail

class Command(BaseCommand):
    help = 'Reset stuck emails to pending status'

    def add_arguments(self, parser):
        parser.add_argument('--status', type=str, default='queued', 
                          help='Status to reset (default: queued)')

    def handle(self, *args, **options):
        status = options['status']
        
        # Reset emails that are stuck in certain statuses
        updated = DispatchEmail.objects.filter(
            status=status
        ).update(status='pending')
        
        self.stdout.write(
            self.style.SUCCESS(f'Reset {updated} emails from {status} to pending')
        )