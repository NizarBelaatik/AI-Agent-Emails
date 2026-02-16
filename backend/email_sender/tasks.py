# email_sender/tasks.py
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.utils import timezone
from django.db import transaction
import logging
import time

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, soft_time_limit=60, time_limit=120)
def send_campaign_email(self, campaign_email_id):
    """
    Send a single campaign email with retry logic
    """
    from .models import CampaignEmail, SendingLog
    from .services.smtp_service import EmailServiceFactory, EmailSendingError
    
    try:
        campaign_email = CampaignEmail.objects.select_related(
            'campaign', 
            'campaign__smtp_config'
        ).get(id=campaign_email_id)
        
        campaign = campaign_email.campaign
        smtp_config = campaign.smtp_config
        
        # Check if already sent
        if campaign_email.status in ['sent', 'opened', 'clicked']:
            return {'status': 'already_sent', 'id': campaign_email_id}
        
        # Update status
        campaign_email.status = 'sending'
        campaign_email.attempts += 1
        campaign_email.last_attempt_at = timezone.now()
        campaign_email.save()
        
        # Get email service
        service = EmailServiceFactory.get_service(smtp_config)
        
        # Send email
        result = service.send(
            to_email=campaign_email.recipient_email,
            subject=campaign_email.subject,
            html_content=campaign_email.body_html,
            from_email=campaign.sender_email or smtp_config.default_from_email,
            from_name=campaign.sender_name or smtp_config.default_from_name,
            reply_to=campaign.reply_to or smtp_config.default_reply_to
        )
        
        # Update success
        campaign_email.mark_sent(result.get('message_id'))
        campaign_email.tracking_id = result.get('tracking_id')
        campaign_email.save()
        
        # Update SMTP stats
        if smtp_config:
            with transaction.atomic():
                smtp_config.emails_sent_today += 1
                smtp_config.emails_sent_total += 1
                smtp_config.save()
        
        # Create log
        SendingLog.objects.create(
            campaign=campaign,
            campaign_email=campaign_email,
            level='success',
            message=f"Email sent to {campaign_email.recipient_email}"
        )
        
        return {
            'success': True,
            'id': campaign_email_id,
            'message_id': result.get('message_id')
        }
        
    except CampaignEmail.DoesNotExist:
        logger.error(f"Campaign email {campaign_email_id} not found")
        return {'error': 'Campaign email not found'}
        
    except EmailSendingError as e:
        logger.error(f"Sending error for {campaign_email_id}: {e}")
        
        # Handle retry
        if campaign_email.attempts < campaign_email.max_attempts:
            countdown = 60 * (2 ** (campaign_email.attempts - 1))
            self.retry(countdown=countdown)
        else:
            campaign_email.mark_failed(str(e))
            
            SendingLog.objects.create(
                campaign=campaign_email.campaign,
                campaign_email=campaign_email,
                level='error',
                message=f"Failed after {campaign_email.attempts} attempts: {str(e)}"
            )
        
        return {'error': str(e)}
        
    except SoftTimeLimitExceeded:
        logger.warning(f"Task timeout for {campaign_email_id}")
        self.retry(countdown=60)
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        campaign_email.mark_failed(str(e))
        raise


@shared_task(bind=True, soft_time_limit=3600, time_limit=4000)
def process_campaign(self, campaign_id):
    """
    Process a campaign by sending emails in batches
    """
    from .models import Campaign, CampaignEmail, SendingLog
    from django.db.models import Q
    
    try:
        campaign = Campaign.objects.select_related('smtp_config').get(id=campaign_id)
        
        # Check campaign status
        if campaign.status not in ['sending', 'scheduled']:
            logger.info(f"Campaign {campaign_id} is not active: {campaign.status}")
            return {'status': 'stopped', 'campaign_id': campaign_id}
        
        # If scheduled, check if it's time to start
        if campaign.status == 'scheduled' and campaign.scheduled_at:
            if timezone.now() < campaign.scheduled_at:
                delay = (campaign.scheduled_at - timezone.now()).total_seconds()
                process_campaign.apply_async(args=[campaign_id], countdown=delay)
                return {'status': 'scheduled', 'campaign_id': campaign_id}
        
        # Update campaign status
        if campaign.status != 'sending':
            campaign.status = 'sending'
            campaign.started_at = timezone.now()
            campaign.save()
        
        # Calculate rate limit
        if campaign.sending_speed > 0:
            emails_per_second = campaign.sending_speed / 3600
            delay_between_emails = 1.0 / emails_per_second if emails_per_second > 0 else 0
        else:
            delay_between_emails = 0
        
        # Get next batch
        pending_emails = CampaignEmail.objects.filter(
            campaign=campaign,
            status='pending'
        ).order_by('priority', 'created_at')[:campaign.batch_size]
        
        if not pending_emails.exists():
            # Check if campaign is complete
            remaining = CampaignEmail.objects.filter(
                campaign=campaign,
                status='pending'
            ).count()
            
            if remaining == 0:
                campaign.status = 'completed'
                campaign.completed_at = timezone.now()
                campaign.save()
                
                SendingLog.objects.create(
                    campaign=campaign,
                    level='success',
                    message=f"Campaign completed. Sent: {campaign.sent_count}, Failed: {campaign.failed_count}"
                )
            
            return {'status': 'complete', 'campaign_id': campaign_id}
        
        # Send batch
        sent_count = 0
        for email in pending_emails:
            if delay_between_emails > 0:
                time.sleep(delay_between_emails)
            
            send_campaign_email.delay(email.id)
            email.status = 'queued'
            email.queued_at = timezone.now()
            email.save()
            sent_count += 1
        
        # Schedule next batch
        remaining = CampaignEmail.objects.filter(
            campaign=campaign,
            status='pending'
        ).count()
        
        if remaining > 0:
            # Calculate delay
            if campaign.sending_speed > 0:
                batch_delay = max(1, int(campaign.batch_size / emails_per_second))
            else:
                batch_delay = 1
            
            if campaign.pause_between_batches > 0:
                batch_delay += campaign.pause_between_batches
            
            process_campaign.apply_async(args=[campaign_id], countdown=batch_delay)
        
        return {
            'status': 'in_progress',
            'sent': sent_count,
            'remaining': remaining,
            'campaign_id': campaign_id
        }
        
    except Campaign.DoesNotExist:
        logger.error(f"Campaign {campaign_id} not found")
        return {'error': 'Campaign not found'}
        
    except SoftTimeLimitExceeded:
        logger.warning(f"Campaign {campaign_id} processing timeout")
        process_campaign.apply_async(args=[campaign_id], countdown=60)
        return {'status': 'timeout'}


@shared_task
def reset_daily_limits():
    """Reset daily email limits for all SMTP settings"""
    from .models import SMTPSetting
    SMTPSetting.objects.all().update(emails_sent_today=0, last_reset_at=timezone.now())
    logger.info("Daily email limits reset")