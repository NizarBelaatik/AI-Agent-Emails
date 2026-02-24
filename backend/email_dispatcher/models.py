from django.db import models
from django.utils import timezone
import uuid

class DispatchEmail(models.Model):
    """
    Simple model for emails to be sent
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('queued', 'Dans la file'),
        ('sending', 'En cours'),
        ('sent', 'Envoyé'),
        ('failed', 'Échoué'),
    ]
    
    # Store recipient data from imported emails
    recipient_id = models.IntegerField()  # ID from data_importer Recipient
    recipient_name = models.CharField(max_length=255)
    recipient_email = models.EmailField()
    recipient_data = models.JSONField(default=dict)  # Store all recipient data
    
    # Email content
    subject = models.CharField(max_length=255)
    body_html = models.TextField(blank=True)
    body_text = models.TextField(blank=True)
    
    # Sending configuration
    from_email = models.EmailField()
    from_name = models.CharField(max_length=255, blank=True)
    reply_to = models.EmailField()
    reply_to_name = models.CharField(max_length=255, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Tracking
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    message_id = models.CharField(max_length=255, blank=True)
    
    # Batch tracking
    batch_id = models.CharField(max_length=100, blank=True, db_index=True)
    batch_name = models.CharField(max_length=255, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['batch_id']),
            models.Index(fields=['recipient_email']),
        ]
    
    def __str__(self):
        return f"{self.recipient_email} - {self.subject[:30]}"


class DispatchBatch(models.Model):
    """
    Group of emails sent together
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('sending', 'En cours'),
        ('completed', 'Terminé'),
        ('paused', 'En pause'),
        ('cancelled', 'Annulé'),
    ]
    
    batch_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    
    # Sending settings
    send_speed = models.IntegerField(
        default=50,
        help_text="Emails per hour"
    )
    use_time_window = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    
    # Stats
    total_emails = models.IntegerField(default=0)
    sent_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Timeline
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
    
    @property
    def progress(self):
        if self.total_emails == 0:
            return 0
        return int((self.sent_count + self.failed_count) / self.total_emails * 100)


class DispatchLog(models.Model):
    """
    Simple log for sent emails
    """
    email = models.ForeignKey(DispatchEmail, on_delete=models.CASCADE, related_name='logs')
    batch = models.ForeignKey(DispatchBatch, on_delete=models.CASCADE, null=True)
    
    status = models.CharField(max_length=20)
    message_id = models.CharField(max_length=255, blank=True)
    response = models.TextField(blank=True)
    error = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']