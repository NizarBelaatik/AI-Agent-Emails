# backend/app/management/commands/auto_approve.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from app.models import GeneratedEmail, EmailLog
from datetime import timedelta

class Command(BaseCommand):
    help = 'Auto-approve emails that have been in draft for too long'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=24,
            help='Hours after which to auto-approve (default: 24)'
        )
    
    def handle(self, *args, **options):
        hours = options['hours']
        cutoff_time = timezone.now() - timedelta(hours=hours)
        
        old_drafts = GeneratedEmail.objects.filter(
            status='draft',
            generated_at__lte=cutoff_time
        )
        
        if not old_drafts.exists():
            self.stdout.write(f'No drafts older than {hours} hours')
            return
        
        self.stdout.write(f'Found {old_drafts.count()} drafts to auto-approve')
        
        approved_count = 0
        for email in old_drafts:
            email.status = 'approved'
            email.approved_by = 'auto_approve'
            email.approved_at = timezone.now()
            email.save()
            
            EmailLog.objects.create(
                email=email,
                action='approved',
                performed_by='auto_approve',
                details=f'Auto-approved after {hours} hours in draft'
            )
            
            approved_count += 1
        
        self.stdout.write(self.style.SUCCESS(
            f'Auto-approved {approved_count} emails'
        ))