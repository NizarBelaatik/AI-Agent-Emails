# email_sender/serializers.py
from rest_framework import serializers
from email_generation.models import GeneratedEmail, EmailSendingQueue


class GeneratedEmailSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source='recipient.name', read_only=True)
    recipient_email = serializers.CharField(source='recipient.email', read_only=True)

    class Meta:
        model = GeneratedEmail
        fields = [
            'id', 'recipient_name', 'recipient_email', 'subject',
            'category_name', 'status', 'generated_at', 'sent_at',
            'error_message', 'retry_count'
        ]
        read_only_fields = fields


class EmailSendingQueueSerializer(serializers.ModelSerializer):
    progress = serializers.ReadOnlyField(source='progress_percentage')

    class Meta:
        model = EmailSendingQueue
        fields = [
            'id', 'task_id', 'name', 'status',
            'total_emails', 'sent_emails', 'failed_emails',
            'progress', 'started_at', 'completed_at'
        ]
        read_only_fields = fields