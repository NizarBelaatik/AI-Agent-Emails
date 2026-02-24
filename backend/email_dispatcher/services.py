import time
import logging
import json
import threading
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from django.conf import settings
import requests

from data_importer.models import Recipient
from .models import DispatchEmail, DispatchBatch, DispatchLog

logger = logging.getLogger(__name__)

# TurboSMTP API
TURBO_API_URL = "https://api.turbo-smtp.com/api/v2/mail/send"


def send_via_turbosmtp(email):
    """
    Send a single email via TurboSMTP
    Returns (success, message_id, error)
    """
    try:
        payload = {
            "authuser": settings.TURBOSMTP_CONSUMER_KEY,
            "authpass": settings.TURBOSMTP_CONSUMER_SECRET,
            "from": email.from_email,
            "from_name": email.from_name or email.from_email,
            "to": email.recipient_email,
            "subject": email.subject,
            "html_content": email.body_html or "<p>Contenu vide</p>",
            "text_content": email.body_text or "Contenu texte vide",
            "reply_to": email.reply_to,
            "reply_to_name": email.reply_to_name or email.reply_to,
        }
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        logger.info(f"[TURBO] Sending to {email.recipient_email}")
        
        response = requests.post(
            TURBO_API_URL,
            json=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code in (200, 202):
            data = response.json()
            message_id = data.get("message_id", "")
            
            # Log success
            DispatchLog.objects.create(
                email=email,
                status='sent',
                message_id=message_id,
                response=response.text[:500]
            )
            
            return True, message_id, None
        else:
            error = f"HTTP {response.status_code}: {response.text[:200]}"
            
            # Log error
            DispatchLog.objects.create(
                email=email,
                status='failed',
                error=error,
                response=response.text[:500]
            )
            
            return False, None, error
            
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        
        # Log error
        DispatchLog.objects.create(
            email=email,
            status='failed',
            error=str(e)
        )
        
        return False, None, str(e)


def create_emails_from_recipients(recipient_ids, data):
    """
    Create DispatchEmail objects from recipient IDs
    """
    recipients = Recipient.objects.filter(id__in=recipient_ids)
    
    if not recipients.exists():
        return [], f"Aucun destinataire trouvé pour les IDs: {recipient_ids}"
    
    emails = []
    
    with transaction.atomic():
        for recipient in recipients:
            # Prepare recipient data
            recipient_data = {
                'name': recipient.name,
                'complete_name': recipient.complete_name,
                'email': recipient.email,
                'company_name': recipient.company_name,
                'city': recipient.city,
                'x_activitec': recipient.x_activitec,
                'x_source': recipient.x_source,
                'is_company': recipient.is_company,
                'phone': recipient.phone,
                'mobile': recipient.mobile,
                'website': recipient.website,
            }
            
            # Create email
            email = DispatchEmail.objects.create(
                recipient_id=recipient.id,
                recipient_name=recipient.name or recipient.complete_name or "Inconnu",
                recipient_email=recipient.email,
                recipient_data=recipient_data,
                subject=data['subject'],
                body_html=data['body_html'],
                body_text=data.get('body_text', ''),
                from_email=data['from_email'],
                from_name=data.get('from_name', ''),
                reply_to=data['reply_to'],
                reply_to_name=data.get('reply_to_name', ''),
                status='pending'
            )
            emails.append(email)
    
    return emails, None


def send_emails_batch(email_ids, batch_name, send_speed=50, 
                      use_time_window=False, start_time=None, end_time=None):
    """
    Send emails in background with rate limiting
    """
    # Create batch record
    batch = DispatchBatch.objects.create(
        name=batch_name or f"Envoi {timezone.now().strftime('%Y-%m-%d %H:%M')}",
        send_speed=send_speed,
        use_time_window=use_time_window,
        start_time=start_time,
        end_time=end_time,
        total_emails=len(email_ids),
        status='sending',
        started_at=timezone.now()
    )
    
    # Update emails with batch info
    DispatchEmail.objects.filter(id__in=email_ids).update(
        batch_id=batch.batch_id,
        batch_name=batch.name,
        status='queued'
    )
    
    # Start sending thread
    thread = threading.Thread(
        target=_send_emails_worker,
        args=(batch, email_ids),
        daemon=True
    )
    thread.start()
    
    return batch


def _send_emails_worker(batch, email_ids):
    """
    Worker thread that sends emails with rate limiting
    """
    logger.info(f"[BATCH:{batch.batch_id}] Started with {len(email_ids)} emails")
    
    sent = 0
    failed = 0
    
    for idx, email_id in enumerate(email_ids, 1):
        try:
            # Check if batch was cancelled
            batch.refresh_from_db()
            if batch.status == 'cancelled':
                logger.info(f"[BATCH:{batch.batch_id}] Cancelled")
                DispatchEmail.objects.filter(id__in=email_ids).update(
                    status='cancelled'
                )
                break
            
            # Get email
            try:
                email = DispatchEmail.objects.get(id=email_id)
            except DispatchEmail.DoesNotExist:
                failed += 1
                continue
            
            # Update status
            email.status = 'sending'
            email.save(update_fields=['status'])
            
            # Respect time window
            if batch.use_time_window and batch.start_time and batch.end_time:
                while True:
                    now = timezone.localtime().time()
                    if batch.start_time <= now <= batch.end_time:
                        break
                    time.sleep(30)  # Check every 30 seconds
            
            # Send email
            success, message_id, error = send_via_turbosmtp(email)
            
            if success:
                email.status = 'sent'
                email.sent_at = timezone.now()
                email.message_id = message_id
                email.save(update_fields=['status', 'sent_at', 'message_id'])
                sent += 1
            else:
                email.status = 'failed'
                email.error_message = error
                email.save(update_fields=['status', 'error_message'])
                failed += 1
            
            # Update batch stats
            batch.sent_count = sent
            batch.failed_count = failed
            batch.save(update_fields=['sent_count', 'failed_count'])
            
            # Rate limiting
            if batch.send_speed > 0:
                # Calculate delay in seconds between emails
                delay = 3600.0 / batch.send_speed
                if idx < len(email_ids):  # Don't sleep after last email
                    time.sleep(delay)
            
        except Exception as e:
            logger.error(f"Error sending email {email_id}: {e}")
            failed += 1
    
    # Mark batch as completed
    batch.status = 'completed'
    batch.completed_at = timezone.now()
    batch.save(update_fields=['status', 'completed_at'])
    
    logger.info(f"[BATCH:{batch.batch_id}] Completed - Sent: {sent}, Failed: {failed}")


def cancel_batch(batch_id):
    """
    Cancel a sending batch
    """
    try:
        batch = DispatchBatch.objects.get(batch_id=batch_id)
        
        if batch.status in ['pending', 'sending']:
            batch.status = 'cancelled'
            batch.completed_at = timezone.now()
            batch.save()
            
            # Update emails
            DispatchEmail.objects.filter(batch_id=batch_id).update(
                status='cancelled'
            )
            
            return True, "Batch cancelled"
        else:
            return False, f"Cannot cancel batch with status {batch.status}"
            
    except DispatchBatch.DoesNotExist:
        return False, "Batch not found"