from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from datetime import datetime, timedelta


class Recipient(models.Model):
    """Recipients imported from source database"""
    source_id = models.IntegerField(unique=True, null=True, blank=True, help_text="ID from source database")
    email = models.EmailField()
    full_name = models.CharField(max_length=255)
    x_activitec = models.CharField(max_length=100, blank=True, help_text="Category from source database")
    city = models.CharField(max_length=100, blank=True)
    company = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    last_interaction = models.DateTimeField(null=True, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-imported_at']
        indexes = [
            models.Index(fields=['x_activitec']),
            models.Index(fields=['is_active']),
            models.Index(fields=['email']),
        ]
    
    def __str__(self):
        return f"{self.full_name} <{self.email}>"
    
    
class EmailTemplate(models.Model):
    """Templates for email generation"""
    TEMPLATE_TYPE_CHOICES = [
        ('followup', 'Follow-up'),
        ('newsletter', 'Newsletter'),
        ('promotional', 'Promotional'),
        ('notification', 'Notification'),
    ]
    
    name = models.CharField(max_length=100)
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPE_CHOICES, default='followup')
    category = models.CharField(max_length=100)
    subcategory = models.CharField(max_length=100, blank=True)
    prompt_template = models.TextField(help_text="LLM prompt template with {placeholders}")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()})"

class GeneratedEmail(models.Model):
    """Generated emails with status tracking"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('edited', 'Edited'),
        ('scheduled', 'Scheduled'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('archived', 'Archived'),
    ]
    
    recipient = models.ForeignKey(Recipient, on_delete=models.CASCADE, related_name='emails')
    subject = models.TextField()
    body_html = models.TextField()
    body_text = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    priority = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="1=Lowest, 5=Highest"
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.CharField(max_length=100, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    edited_by = models.CharField(max_length=100, blank=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, help_text="Schedule for future sending")
    sent_at = models.DateTimeField(null=True, blank=True)
    ses_message_id = models.CharField(max_length=100, blank=True)
    error_message = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True, help_text="Tags for categorization")
    
    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['status', 'generated_at']),
            models.Index(fields=['scheduled_for', 'status']),
            models.Index(fields=['priority', 'status']),
        ]
    
    def __str__(self):
        return f"Email to {self.recipient.email} - {self.status}"
    
    def can_be_sent(self):
        """Check if email can be sent"""
        if self.status != 'approved' and self.status != 'scheduled':
            return False
        
        if self.scheduled_for and datetime.now(self.scheduled_for.tzinfo) < self.scheduled_for:
            return False
        
        return True

class EmailCampaign(models.Model):
    """Campaign for batch operations"""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category_filter = models.JSONField(default=dict, blank=True)
    recipient_count = models.IntegerField(default=0)
    email_count = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[
            ('draft', 'Draft'),
            ('running', 'Running'),
            ('completed', 'Completed'),
            ('paused', 'Paused'),
            ('cancelled', 'Cancelled'),
        ],
        default='draft'
    )
    created_by = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.name} ({self.status})"

class EmailLog(models.Model):
    """Audit log for all email actions"""
    ACTION_CHOICES = [
        ('imported', 'Imported'),
        ('generated', 'Generated'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('edited', 'Edited'),
        ('scheduled', 'Scheduled'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('regenerated', 'Regenerated'),
        ('bulk_action', 'Bulk Action'),
    ]
    
    email = models.ForeignKey(GeneratedEmail, on_delete=models.CASCADE, related_name='logs', null=True, blank=True)
    campaign = models.ForeignKey(EmailCampaign, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.CharField(max_length=100)
    performed_at = models.DateTimeField(auto_now_add=True)
    details = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['action', 'performed_at']),
            models.Index(fields=['performed_by', 'performed_at']),
        ]
    
    def __str__(self):
        return f"{self.action} by {self.performed_by}"

class Setting(models.Model):
    """System settings and configurations"""
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['key']
    
    def __str__(self):
        return self.key