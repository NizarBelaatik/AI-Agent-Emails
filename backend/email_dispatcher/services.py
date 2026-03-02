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
        
        # Debug: Log the content before sending
        logger.info(f"[TURBO] Email ID: {email.id}")
        logger.info(f"[TURBO] Recipient: {email.recipient_email}")
        logger.info(f"[TURBO] Subject: {email.subject}")
        logger.info(f"[TURBO] Body text length: {len(email.body_text) if email.body_text else 0}")
        logger.info(f"[TURBO] Body text preview: {email.body_text[:200] if email.body_text else 'EMPTY'}")
        
        # Prepare payload - Note: TurboSMTP might expect different field names
        payload = {
            "authuser": settings.TURBOSMTP_CONSUMER_KEY,
            "authpass": settings.TURBOSMTP_CONSUMER_SECRET,
            "from": email.from_email,
            "from_name": email.from_name or email.from_email,
            "to": email.recipient_email,
            "subject": email.subject,
        }
        
        # IMPORTANT: Some email APIs use 'text' instead of 'text_content'
        # Let's try both to be safe
        if email.body_text:
            # Make sure text content is properly formatted
            text_content = email.body_text.strip()
            
            # Replace any placeholders if needed
            if email.recipient and email.recipient.name:
                text_content = text_content.replace('[Nom]', email.recipient.name)
                text_content = text_content.replace('[nom]', email.recipient.name)
            
            # Try different field names that TurboSMTP might expect
            payload["text"] = text_content  # Some APIs use 'text'
            payload["text_content"] = text_content  # Your current field
            
            # Also include as plain_text for some APIs
            payload["plain_text"] = text_content
            
            logger.info(f"[TURBO] Text content set, length: {len(text_content)}")
        
        # Handle HTML content if provided
        if email.body_html:
            html_content = email.body_html.strip()
            
            # Replace placeholders in HTML
            if email.recipient and email.recipient.name:
                html_content = html_content.replace('[Nom]', email.recipient.name)
                html_content = html_content.replace('[nom]', email.recipient.name)
            
            payload["html"] = html_content  # Some APIs use 'html'
            payload["html_content"] = html_content  # Your current field
            
            logger.info(f"[TURBO] HTML content set, length: {len(html_content)}")
        elif email.body_text:
            # If no HTML provided but we have text, create a simple HTML version
            # Convert text to simple HTML
            html_lines = text_content.split('\n\n')
            html_parts = []
            for line in html_lines:
                if line.strip():
                    # Replace single newlines with <br>
                    line_with_breaks = line.replace('\n', '<br>')
                    html_parts.append(f'<p>{line_with_breaks}</p>')
            
            simple_html = ''.join(html_parts)
            payload["html"] = simple_html
            payload["html_content"] = simple_html
            logger.info(f"[TURBO] Created simple HTML from text ({len(simple_html)} chars)")
        
        # CRITICAL FIX: Set reply-to to the @bmm.ma address
        # Even if from_email is @mail-bmm.ma, replies should go to @bmm.ma
        reply_to_address = "Contact@bmm.ma"  # Replace with actual @bmm.ma address
        reply_to_name = "BMM"  # Replace with actual name
        
        # Always set reply-to to the @bmm.ma address
        payload["reply_to"] = reply_to_address

        payload["reply_to_name"] = reply_to_name
        
        # Also set the standard Reply-To header field that some APIs expect
        payload["reply-to"] = reply_to_address
        payload["Reply-To"] = reply_to_address
        payload["headers"] = {
            "Reply-To": reply_to_address
        }
        logger.info(f"[TURBO] From: {email.from_email} (@mail-bmm.ma)")
        logger.info(f"[TURBO] Reply-To: {reply_to_address} (@bmm.ma)")
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Log the full payload (excluding sensitive auth)
        log_payload = payload.copy()
        log_payload.pop('authuser', None)
        log_payload.pop('authpass', None)
        logger.info(f"[TURBO] Payload: {log_payload}")
        
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
            
            logger.info(f"[TURBO] Email sent successfully to {email.recipient_email}")
            return True, message_id, None
        else:
            error = f"HTTP {response.status_code}: {response.text[:200]}"
            logger.error(f"[TURBO] Error: {error}")
            logger.error(f"[TURBO] Response body: {response.text}")
            
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
        import traceback
        traceback.print_exc()
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
            
            # IMPORTANT: Force reply_to to be @bmm.ma even if from_email is @mail-bmm.ma
            from_email = data['from_email']  # This should be @mail-bmm.ma
            reply_to = "contact@bmm.ma"  # Replace with actual @bmm.ma address
            reply_to_name = "BMM"  # Replace with actual name
            
            # Log the configuration
            logger.info(f"Creating email - From: {from_email}, Reply-To: {reply_to}")
            
            # Create email
            email = DispatchEmail.objects.create(
                recipient=recipient,
                recipient_name=recipient.name or recipient.complete_name or "Inconnu",
                recipient_email=recipient.email,
                recipient_data=recipient_data,
                subject=data['subject'],
                body_html=data.get('body_html', ''),
                body_text=data['body_text'],
                from_email=from_email,  # Send from @mail-bmm.ma
                from_name=data.get('from_name', ''),
                reply_to=reply_to,  # Force replies to go to @bmm.ma
                reply_to_name=reply_to_name,
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