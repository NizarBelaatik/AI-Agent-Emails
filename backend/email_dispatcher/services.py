import time
import logging
import threading
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import F
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
        # Ensure we have at least one content type
        if not email.body_text and not email.body_html:
            return False, None, "No email content provided (neither text nor HTML)"
        
        # Prepare payload
        payload = {
            "authuser": settings.TURBOSMTP_CONSUMER_KEY,
            "authpass": settings.TURBOSMTP_CONSUMER_SECRET,
            "from": email.from_email,
            "from_name": email.from_name or email.from_email,
            "to": email.recipient_email,
            "subject": email.subject,
        }
        
        # Handle text content - this is what you primarily use
        if email.body_text:
            # Make sure text content is properly formatted
            text_content = email.body_text.strip()
            
            # Replace any placeholders if needed
            if email.recipient and email.recipient.name:
                text_content = text_content.replace('[Nom]', email.recipient.name)
                text_content = text_content.replace('[nom]', email.recipient.name)
            
            payload["text_content"] = text_content
            
            # If no HTML provided, create a simple HTML version from text
            if not email.body_html:
                # Convert text to simple HTML (replace newlines with <br> and wrap in <p>)
                html_lines = text_content.split('\n\n')
                html_parts = []
                for line in html_lines:
                    if line.strip():
                        # Replace single newlines with <br>
                        line_with_breaks = line.replace('\n', '<br>')
                        html_parts.append(f'<p>{line_with_breaks}</p>')
                
                simple_html = ''.join(html_parts)
                payload["html_content"] = simple_html
                logger.info(f"[TURBO] Created simple HTML from text ({len(simple_html)} chars)")
        
        # Handle HTML content if provided separately
        if email.body_html:
            html_content = email.body_html.strip()
            
            # Replace placeholders in HTML
            if email.recipient and email.recipient.name:
                html_content = html_content.replace('[Nom]', email.recipient.name)
                html_content = html_content.replace('[nom]', email.recipient.name)
            
            payload["html_content"] = html_content
        
        # Add reply-to if different from from
        if email.reply_to and email.reply_to != email.from_email:
            payload["reply_to"] = email.reply_to
            if email.reply_to_name:
                payload["reply_to_name"] = email.reply_to_name
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        logger.info(f"[TURBO] Sending to {email.recipient_email}")
        logger.info(f"[TURBO] Subject: {email.subject}")
        logger.info(f"[TURBO] Text length: {len(payload.get('text_content', ''))}")
        logger.info(f"[TURBO] HTML length: {len(payload.get('html_content', ''))}")
        
        # Log first 100 chars of content for debugging
        if 'text_content' in payload:
            logger.info(f"[TURBO] Text preview: {payload['text_content'][:100]}...")
        
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
            try:
                DispatchLog.objects.create(
                    email=email,
                    batch=email.batch,
                    status='sent',
                    message_id=message_id,
                    response=response.text[:500]
                )
            except:
                pass
            
            return True, message_id, None
        else:
            error = f"HTTP {response.status_code}: {response.text[:200]}"
            logger.error(f"[TURBO] Error: {error}")
            
            # Log error
            try:
                DispatchLog.objects.create(
                    email=email,
                    batch=email.batch,
                    status='failed',
                    error=error,
                    response=response.text[:500]
                )
            except:
                pass
            
            return False, None, error
            
    except Exception as e:
        logger.error(f"Error sending email: {e}")
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
            # Check if recipient already has pending emails
            existing_pending = DispatchEmail.objects.filter(
                recipient=recipient,
                status__in=['pending', 'queued', 'sending']
            ).exists()
            
            if existing_pending:
                logger.warning(f"Recipient {recipient.id} already has pending emails")
                continue
            
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
                recipient=recipient,
                recipient_name=recipient.name or recipient.complete_name or "Inconnu",
                recipient_email=recipient.email,
                recipient_data=recipient_data,
                subject=data['subject'],
                body_html=data.get('body_html', ''),
                body_text=data['body_text'],
                from_email=data['from_email'],
                from_name=data.get('from_name', ''),
                reply_to=data['reply_to'],
                reply_to_name=data.get('reply_to_name', ''),
                status='pending'
            )
            
            # Update recipient status
            recipient.email_dispatched = True
            recipient.email_dispatch_count = F('email_dispatch_count') + 1
            recipient.save(update_fields=['email_dispatched', 'email_dispatch_count'])
            
            emails.append(email)
            logger.info(f"Created email {email.id} for recipient {recipient.id} with status 'pending'")
    
    return emails, None



def send_emails_batch(email_ids, batch_name, send_speed=3600, 
                      use_time_window=False, start_time=None, end_time=None,
                      distribution_method='spread', fixed_delay_seconds=1):
    """
    Send emails in background with rate limiting and intelligent scheduling
    """
    # Create batch record
    batch = DispatchBatch.objects.create(
        name=batch_name or f"Envoi {timezone.now().strftime('%Y-%m-%d %H:%M')}",
        send_speed=send_speed,
        use_time_window=use_time_window,
        start_time=start_time,
        end_time=end_time,
        distribution_method=distribution_method,
        fixed_delay_seconds=fixed_delay_seconds,
        total_emails=len(email_ids),
        status='sending',
        started_at=timezone.now()
    )
    
    # Update emails with batch info
    # Use batch=batch (not batch_id=batch.batch_id)
    DispatchEmail.objects.filter(id__in=email_ids).update(
        batch=batch,  # Set the ForeignKey directly
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
    Worker thread that sends emails with rate limiting and intelligent scheduling
    """
    logger.info(f"[BATCH:{batch.batch_id}] Started with {len(email_ids)} emails")
    
    sent = 0
    failed = 0
    
    # Calculate delays based on settings
    if batch.send_speed > 0:
        # Convert emails per hour to seconds between emails
        base_delay = 3600.0 / batch.send_speed
    else:
        base_delay = 0  # Unlimited
    
    # If using time window, calculate spread
    if batch.use_time_window and batch.start_time and batch.end_time:
        start_dt = datetime.combine(timezone.now().date(), batch.start_time)
        end_dt = datetime.combine(timezone.now().date(), batch.end_time)
        
        # If end time is before start time, assume it's next day
        if end_dt <= start_dt:
            end_dt = end_dt + timedelta(days=1)
        
        window_seconds = (end_dt - start_dt).total_seconds()
        
        if batch.distribution_method == 'spread' and window_seconds > 0:
            # Spread emails evenly across the time window
            delay = window_seconds / len(email_ids)
            logger.info(f"[BATCH:{batch.batch_id}] Spreading {len(email_ids)} emails over {window_seconds}s window, delay: {delay:.2f}s")
        elif batch.distribution_method == 'fixed_delay':
            delay = batch.fixed_delay_seconds
            logger.info(f"[BATCH:{batch.batch_id}] Using fixed delay of {delay}s")
        else:
            delay = base_delay
    else:
        # No time window, use speed-based delay
        delay = base_delay
        logger.info(f"[BATCH:{batch.batch_id}] Using speed-based delay of {delay:.2f}s (based on {batch.send_speed}/h)")
    
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
                    # Wait 30 seconds before checking again
                    logger.info(f"[BATCH:{batch.batch_id}] Outside time window, waiting...")
                    time.sleep(30)
            
            # Send email
            success, message_id, error = send_via_turbosmtp(email)
            
            if success:
                email.status = 'sent'
                email.sent_at = timezone.now()
                email.message_id = message_id
                email.save(update_fields=['status', 'sent_at', 'message_id'])
                
                # Update recipient dispatched_at when email is actually sent
                if email.recipient:
                    email.recipient.email_dispatched_at = timezone.now()
                    email.recipient.save(update_fields=['email_dispatched_at'])
                
                sent += 1
                logger.info(f"[BATCH:{batch.batch_id}] Email {idx}/{len(email_ids)} sent successfully")
            else:
                email.status = 'failed'
                email.error_message = error
                email.save(update_fields=['status', 'error_message'])
                failed += 1
                logger.error(f"[BATCH:{batch.batch_id}] Email {idx}/{len(email_ids)} failed: {error}")
            
            # Update batch stats
            batch.sent_count = sent
            batch.failed_count = failed
            batch.save(update_fields=['sent_count', 'failed_count'])
            
            # Rate limiting - wait between emails
            if delay > 0 and idx < len(email_ids):
                logger.info(f"[BATCH:{batch.batch_id}] Waiting {delay:.2f}s before next email")
                time.sleep(delay)
            
        except Exception as e:
            logger.error(f"Error sending email {email_id}: {e}")
            failed += 1
    
    # Mark batch as completed
    if failed == 0:
        batch.status = 'completed'
    elif sent > 0:
        batch.status = 'completed_with_errors'
    else:
        batch.status = 'failed'
    
    batch.completed_at = timezone.now()
    batch.save(update_fields=['status', 'completed_at', 'sent_count', 'failed_count'])
    
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