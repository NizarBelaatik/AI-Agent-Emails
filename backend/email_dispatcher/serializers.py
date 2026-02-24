from rest_framework import serializers
from .models import DispatchEmail, DispatchBatch, DispatchLog


class DispatchEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispatchEmail
        fields = [
            'id', 'recipient_id', 'recipient_name', 'recipient_email',
            'subject', 'body_html', 'body_text', 'status',
            'sent_at', 'error_message', 'batch_id', 'batch_name',
            'created_at'
        ]
        read_only_fields = ['sent_at', 'created_at']


class DispatchEmailDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispatchEmail
        fields = '__all__'
        read_only_fields = ['sent_at', 'created_at']


class DispatchBatchSerializer(serializers.ModelSerializer):
    progress = serializers.ReadOnlyField()
    
    class Meta:
        model = DispatchBatch
        fields = [
            'id', 'batch_id', 'name', 'send_speed',
            'use_time_window', 'start_time', 'end_time',
            'total_emails', 'sent_count', 'failed_count',
            'status', 'progress', 'started_at', 'completed_at',
            'created_at'
        ]
        read_only_fields = [
            'total_emails', 'sent_count', 'failed_count',
            'started_at', 'completed_at', 'created_at'
        ]


class CreateEmailsFromRecipientsSerializer(serializers.Serializer):
    """Create emails from selected recipients"""
    recipient_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )
    subject = serializers.CharField(max_length=255)
    body_html = serializers.CharField()
    body_text = serializers.CharField(required=False, allow_blank=True)
    
    # Sender info
    from_email = serializers.EmailField()
    from_name = serializers.CharField(required=False, allow_blank=True)
    reply_to = serializers.EmailField()
    reply_to_name = serializers.CharField(required=False, allow_blank=True)
    
    # Batch info
    batch_name = serializers.CharField(required=False, allow_blank=True)


class SendBatchSerializer(serializers.Serializer):
    """Send a batch of emails"""
    email_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )
    batch_name = serializers.CharField(required=False, allow_blank=True)
    send_speed = serializers.IntegerField(default=50)
    use_time_window = serializers.BooleanField(default=False)
    start_time = serializers.TimeField(required=False, allow_null=True)
    end_time = serializers.TimeField(required=False, allow_null=True)