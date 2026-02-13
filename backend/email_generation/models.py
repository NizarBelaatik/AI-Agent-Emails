# models.py
from django.db import models
from django.utils import timezone
from datetime import timedelta
from data_importer.models import Recipient

# Try to import JSONField based on Django version
try:
    from django.db.models import JSONField
except ImportError:
    from django.contrib.postgres.fields import JSONField


class EmailCategory(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Catégorie")
    description = models.TextField(blank=True, verbose_name="Description")
    created_at = models.DateTimeField(auto_now_add=True)
    email_count = models.IntegerField(default=0, verbose_name="Nombre d'emails")
    last_generated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"

    def __str__(self):
        return self.name
    
    def update_stats(self):
        self.email_count = GeneratedEmail.objects.filter(category_name=self.name).count()
        last = GeneratedEmail.objects.filter(category_name=self.name).order_by('-generated_at').first()
        if last:
            self.last_generated_at = last.generated_at
        self.save()


class EmailTemplate(models.Model):
    category_name = models.CharField(max_length=255, unique=True)
    subject_template = models.CharField(max_length=500)
    body_template = models.TextField()
    is_generated = models.BooleanField(default=False)
    generated_at = models.DateTimeField(null=True, blank=True)
    model_used = models.CharField(max_length=100, default="llama3.1")
    prompt_used = models.TextField(blank=True)
    
    # Template stats
    usage_count = models.IntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Template d'email"
        verbose_name_plural = "Templates d'email"

    def __str__(self):
        return f"Template - {self.category_name}"
    
    def update_usage(self):
        self.usage_count += 1
        self.last_used_at = timezone.now()
        self.save()


class GeneratedEmail(models.Model):
    STATUS_CHOICES = [
        ('pending_generation', 'En attente de génération'),
        ('generating', 'Génération en cours'),
        ('generated', 'Généré'),
        ('ready', 'Prêt à envoyer'),
        ('sending', 'Envoi en cours'),
        ('sent', 'Envoyé'),
        ('failed_generation', 'Échec génération'),
        ('failed_sending', 'Échec envoi'),
        ('cancelled', 'Annulé'),
    ]

    recipient = models.ForeignKey(Recipient, on_delete=models.CASCADE, related_name='generated_emails')
    category_name = models.CharField(max_length=255, blank=True, null=True)
    template = models.ForeignKey(EmailTemplate, on_delete=models.SET_NULL, null=True, blank=True)

    subject = models.CharField(max_length=500, blank=True)
    body_html = models.TextField(blank=True)
    body_text = models.TextField(blank=True)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending_generation')
    
    # Queue tracking
    queue_position = models.IntegerField(null=True, blank=True)
    generation_task_id = models.CharField(max_length=100, blank=True, null=True)
    sending_task_id = models.CharField(max_length=100, blank=True, null=True)
    
    # Timestamps
    generated_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Error tracking
    error_message = models.TextField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ('recipient', 'category_name')  # This prevents duplicates
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['status', 'generated_at']),
            models.Index(fields=['recipient', 'status']),
        ]
        verbose_name = "Email généré"
        verbose_name_plural = "Emails générés"


    def __str__(self):
        recipient_name = self.recipient.name if self.recipient else "Inconnu"
        return f"Email #{self.id} - {recipient_name} - {self.get_status_display()}"
    
    def mark_generated(self, subject, body_html):
        self.subject = subject
        self.body_html = body_html
        self.status = 'generated'
        self.generated_at = timezone.now()
        self.save()
        
        # Update template usage
        if self.template:
            self.template.update_usage()
    
    def mark_ready(self):
        self.status = 'ready'
        self.save()
    
    def mark_sending(self):
        self.status = 'sending'
        self.save()
    
    def mark_sent(self):
        self.status = 'sent'
        self.sent_at = timezone.now()
        self.save()
    
    def mark_failed(self, error, stage='generation'):
        self.status = f'failed_{stage}'
        self.error_message = str(error)[:500]
        self.save()
        
    @property
    def status_display(self):
        """Get French status display"""
        status_map = {
            'pending_generation': 'En attente',
            'generating': 'Génération...',
            'generated': 'Généré',
            'ready': 'Prêt',
            'sending': 'Envoi...',
            'sent': 'Envoyé',
            'failed_generation': 'Échec',
            'failed_sending': 'Échec envoi',
            'cancelled': 'Annulé',
        }
        return status_map.get(self.status, self.status)


class EmailGenerationQueue(models.Model):
    """
    Queue for email generation - shows all emails waiting to be generated
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('processing', 'En cours'),
        ('completed', 'Terminé'),
        ('failed', 'Échec'),
        ('cancelled', 'Annulé'),
    ]
    
    task_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255, verbose_name="Nom de la tâche")
    
    # Queue stats
    total_emails = models.IntegerField(default=0)
    processed_emails = models.IntegerField(default=0)
    failed_emails = models.IntegerField(default=0)
    total_categories = models.IntegerField(default=0)
    current_category = models.CharField(max_length=255, blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Categories being processed
    categories = models.JSONField(default=list, blank=True)
    
    # Timeline
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # User who started the queue
    created_by = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        verbose_name = "File de génération"
        verbose_name_plural = "Files de génération"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Queue #{self.id} - {self.name} - {self.get_status_display()}"
    
    @property
    def progress_percentage(self):
        if self.total_emails == 0:
            return 0
        return int((self.processed_emails / self.total_emails) * 100)
    
    @property
    def duration(self):
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        elif self.started_at:
            return (timezone.now() - self.started_at).total_seconds()
        return 0


class EmailSendingQueue(models.Model):
    """
    Queue for email sending - shows all emails waiting to be sent
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('processing', 'Envoi en cours'),
        ('completed', 'Terminé'),
        ('failed', 'Échec'),
        ('cancelled', 'Annulé'),
    ]
    
    task_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255, verbose_name="Nom de la campagne")
    
    # Queue stats
    total_emails = models.IntegerField(default=0)
    sent_emails = models.IntegerField(default=0)
    failed_emails = models.IntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Email configuration
    email_subject = models.CharField(max_length=500, blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "File d'envoi"
        verbose_name_plural = "Files d'envoi"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Campagne #{self.id} - {self.name} - {self.get_status_display()}"
    
    @property
    def progress_percentage(self):
        if self.total_emails == 0:
            return 0
        return int((self.sent_emails / self.total_emails) * 100)


class EmailGenerationTask(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'En attente'),
        ('PROGRESS', 'En cours'),
        ('SUCCESS', 'Terminé'),
        ('FAILURE', 'Échec'),
        ('CANCELLED', 'Annulé'),
    ]
    
    task_id = models.CharField(max_length=100, unique=True)
    recipient_ids = models.TextField(default='[]')  # Store as JSON string
    selected_category = models.CharField(max_length=255, blank=True, null=True)
    total_recipients = models.IntegerField(default=0)
    total_categories = models.IntegerField(default=0)
    current_category = models.CharField(max_length=255, blank=True, null=True)
    
    # Link to queue
    queue = models.ForeignKey(EmailGenerationQueue, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    progress_info = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "Tâche de génération"
        verbose_name_plural = "Tâches de génération"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Task {self.task_id[:8]} - {self.get_status_display()}"
    
    @property
    def progress_percentage(self):
        if self.total_categories == 0:
            return 0
        if self.progress_info and 'current_category' in self.progress_info:
            return int((self.progress_info['current_category'] / self.total_categories) * 100)
        return 0
    
    def get_recipient_ids_list(self):
        """Convert recipient_ids string to list"""
        import json
        try:
            return json.loads(self.recipient_ids)
        except:
            return []
    
    def set_recipient_ids_list(self, ids_list):
        """Convert list to JSON string for storage"""
        import json
        self.recipient_ids = json.dumps(ids_list)


class DailyStats(models.Model):
    """
    Daily statistics for dashboard
    """
    date = models.DateField(unique=True)
    
    # Recipients
    recipients_imported = models.IntegerField(default=0)
    total_recipients = models.IntegerField(default=0)
    
    # Generation
    emails_generated = models.IntegerField(default=0)
    emails_failed_generation = models.IntegerField(default=0)
    emails_in_queue = models.IntegerField(default=0)
    
    # Sending
    emails_sent = models.IntegerField(default=0)
    emails_failed_sending = models.IntegerField(default=0)
    emails_ready = models.IntegerField(default=0)
    
    # Categories
    categories_used = models.JSONField(default=dict, blank=True)
    
    # Performance
    avg_generation_time = models.FloatField(default=0)  # in seconds
    avg_sending_time = models.FloatField(default=0)  # in seconds
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Statistique quotidienne"
        verbose_name_plural = "Statistiques quotidiennes"
        ordering = ['-date']
    
    def __str__(self):
        return f"Stats - {self.date}"
    
    @classmethod
    def update_today_stats(cls):
        today = timezone.now().date()
        stats, created = cls.objects.get_or_create(date=today)
        
        # Update all stats
        stats.recipients_imported = Recipient.objects.filter(created_at__date=today).count()
        stats.total_recipients = Recipient.objects.count()
        
        stats.emails_generated = GeneratedEmail.objects.filter(
            generated_at__date=today, 
            status__in=['generated', 'ready', 'sent']
        ).count()
        
        stats.emails_failed_generation = GeneratedEmail.objects.filter(
            created_at__date=today,
            status='failed_generation'
        ).count()
        
        stats.emails_sent = GeneratedEmail.objects.filter(
            sent_at__date=today,
            status='sent'
        ).count()
        
        stats.emails_failed_sending = GeneratedEmail.objects.filter(
            updated_at__date=today,
            status='failed_sending'
        ).count()
        
        stats.emails_ready = GeneratedEmail.objects.filter(status='ready').count()
        stats.emails_in_queue = GeneratedEmail.objects.filter(
            status__in=['pending_generation', 'generating']
        ).count()
        
        # Category distribution
        category_stats = {}
        for email in GeneratedEmail.objects.filter(generated_at__date=today)[:1000]:  # Limit for performance
            cat = email.category_name or 'Général'
            category_stats[cat] = category_stats.get(cat, 0) + 1
        stats.categories_used = category_stats
        
        stats.save()
        return stats