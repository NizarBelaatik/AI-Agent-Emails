# backend/app/management/commands/check_scheduled_emails.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from app.models import GeneratedEmail
from app.services.email_service import EmailService
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Check and send scheduled emails'
    
    def handle(self, *args, **options):
        self.stdout.write('Checking scheduled emails...')
        
        now = timezone.now()
        due_emails = GeneratedEmail.objects.filter(
            status='scheduled',
            scheduled_for__lte=now
        ).select_related('recipient')
        
        if not due_emails.exists():
            self.stdout.write('No emails due for sending')
            return
        
        self.stdout.write(f'Found {due_emails.count()} emails to send')
        
        email_service = EmailService()
        sent_count = 0
        failed_count = 0
        
        for email in due_emails:
            try:
                result = email_service.send_email(
                    email.recipient.email,
                    email.subject,
                    email.body_html,
                    email.body_text
                )
                
                if result['success']:
                    email.status = 'sent'
                    email.sent_at = now
                    email.ses_message_id = result['message_id']
                    email.save()
                    sent_count += 1
                    self.stdout.write(f'✓ Sent email to {email.recipient.email}')
                else:
                    email.status = 'failed'
                    email.error_message = result['error']
                    email.save()
                    failed_count += 1
                    self.stdout.write(f'✗ Failed to send to {email.recipient.email}: {result["error"]}')
                    
            except Exception as e:
                failed_count += 1
                self.stdout.write(f'✗ Error sending to {email.recipient.email}: {str(e)}')
        
        self.stdout.write(self.style.SUCCESS(
            f'Completed: {sent_count} sent, {failed_count} failed'
        ))