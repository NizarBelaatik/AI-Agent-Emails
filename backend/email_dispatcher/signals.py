# email_dispatcher/signals.py
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
import logging
from .models import DispatchEmail

logger = logging.getLogger(__name__)

@receiver(pre_save, sender=DispatchEmail)
def track_email_status_changes(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = DispatchEmail.objects.get(pk=instance.pk)
            if old.status != instance.status:
                logger.info(f"Email {instance.id} status changing from '{old.status}' to '{instance.status}'")
        except DispatchEmail.DoesNotExist:
            pass