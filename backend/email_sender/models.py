# email_sender/models.py
from django.db import models
from django.utils import timezone
from email_generation.models import GeneratedEmail

class SentEmail(models.Model):
    """
    Track emails that have been sent via TurboSMTP
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('sending', 'En cours'),
        ('sent', 'Envoyé'),
        ('failed', 'Échoué'),
    ]
    
    generated_email = models.OneToOneField(
        GeneratedEmail, 
        on_delete=models.CASCADE,
        related_name='sending_info'
    )
    
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Sending info
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Tracking from TurboSMTP
    message_id = models.CharField(max_length=255, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['generated_email']),
        ]
    
    def __str__(self):
        return f"{self.recipient_email} - {self.status}"


class SendingBatch(models.Model):
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
    
    name = models.CharField(max_length=255, blank=True)
    total_emails = models.IntegerField(default=0)
    sent_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Settings
    send_speed = models.IntegerField(default=3600, help_text="Emails par heure")
    use_time_window = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    
    # Timeline
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Batch {self.id} - {self.status}"
    
    @property
    def progress(self):
        if self.total_emails == 0:
            return 0
        return int((self.sent_count + self.failed_count) / self.total_emails * 100)


class EmailSendLog(models.Model):
    generated_email = models.ForeignKey(
        GeneratedEmail,
        on_delete=models.CASCADE,
        related_name='send_logs'
    )
    queue = models.ForeignKey(
        'email_generation.EmailSendingQueue',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='send_logs'
    )
    attempt_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=30, default='pending')
    message_id = models.CharField(max_length=255, blank=True, null=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Journal d'envoi"
        verbose_name_plural = "Journaux d'envoi"
        ordering = ['-created_at']

    def __str__(self):
        return f"Log {self.generated_email_id} - Attempt {self.attempt_number}"



