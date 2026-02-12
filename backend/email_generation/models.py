from django.db import models
from data_importer.models import Recipient




class EmailTemplate(models.Model):
    category_name = models.CharField(max_length=255, unique=True)
    #category = models.OneToOneField(EmailCategory, on_delete=models.CASCADE, related_name='template')
    subject_template = models.CharField(max_length=500)
    body_template = models.TextField()
    is_generated = models.BooleanField(default=False)
    generated_at = models.DateTimeField(null=True, blank=True)
    model_used = models.CharField(max_length=100, default="llama3.1")
    prompt_used = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Template - {self.category_name}"
    

class GeneratedEmail(models.Model):
    STATUS_CHOICES = [
        ('generated', 'Généré'),
        ('ready', 'Prêt à envoyer'),
        ('sent', 'Envoyé'),
        ('failed', 'Échec'),
    ]

    recipient = models.ForeignKey(Recipient, on_delete=models.CASCADE, related_name='generated_emails')
   #category_name = models.ForeignKey(EmailCategory, on_delete=models.SET_NULL, null=True)
    category_name = models.CharField(max_length=255, blank=True, null=True)
    template = models.ForeignKey(EmailTemplate, on_delete=models.SET_NULL, null=True)

    subject = models.CharField(max_length=500)
    body_html = models.TextField()
    body_text = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generated')
    generated_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('recipient', 'category_name')
        ordering = ['-generated_at']

    def __str__(self):
        return f"Email → {self.recipient.name} ({self.category_name})"