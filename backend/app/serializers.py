from rest_framework import serializers
from .models import Recipient, GeneratedEmail, EmailTemplate, EmailLog, EmailCampaign, Setting
from django.utils import timezone

class RecipientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recipient
        fields = '__all__'
        read_only_fields = ['imported_at']

class GeneratedEmailSerializer(serializers.ModelSerializer):
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True)
    recipient_category = serializers.CharField(source='recipient.category', read_only=True)
    recipient_subcategory = serializers.CharField(source='recipient.subcategory', read_only=True)
    recipient_company = serializers.CharField(source='recipient.company', read_only=True)
    can_send_now = serializers.SerializerMethodField()
    
    class Meta:
        model = GeneratedEmail
        fields = [
            'id', 'recipient', 'recipient_email', 'recipient_name',
            'recipient_category', 'recipient_subcategory', 'recipient_company',
            'subject', 'body_html', 'body_text', 'status', 'priority',
            'generated_at', 'approved_by', 'approved_at', 'edited_by',
            'edited_at', 'scheduled_for', 'sent_at', 'ses_message_id',
            'error_message', 'tags', 'can_send_now'
        ]
        read_only_fields = ['generated_at', 'approved_at', 'edited_at', 'sent_at']
    
    def get_can_send_now(self, obj):
        return obj.can_be_sent()

class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = '__all__'

class EmailCampaignSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = EmailCampaign
        fields = '__all__'
        read_only_fields = ['created_at', 'completed_at']
    
    def get_progress(self, obj):
        if obj.email_count == 0:
            return 0
        return round((obj.email_count / obj.recipient_count) * 100, 1)

class EmailLogSerializer(serializers.ModelSerializer):
    email_subject = serializers.CharField(source='email.subject', read_only=True)
    recipient_email = serializers.EmailField(source='email.recipient.email', read_only=True)
    
    class Meta:
        model = EmailLog
        fields = '__all__'

class SettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Setting
        fields = '__all__'

class BulkActionSerializer(serializers.Serializer):
    """Serializer for bulk actions"""
    email_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True
    )
    action = serializers.ChoiceField(
        choices=['approve', 'reject', 'send', 'regenerate', 'delete', 'schedule', 'archive'],
        required=True
    )
    data = serializers.JSONField(required=False, default=dict)
    
    def validate(self, attrs):
        action = attrs.get('action')
        data = attrs.get('data', {})
        
        if action == 'schedule' and 'scheduled_for' not in data:
            raise serializers.ValidationError({
                'data': 'scheduled_for is required for schedule action'
            })
        
        return attrs

class ImportSelectionSerializer(serializers.Serializer):
    """Serializer for importing recipients"""
    selection_type = serializers.ChoiceField(
        choices=['all', 'filtered', 'selected'],
        default='selected'
    )
    filters = serializers.JSONField(required=False, default=dict)
    selected_emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        default=list
    )
    limit = serializers.IntegerField(min_value=1, max_value=1000, required=False, default=100)

class EmailGenerationSerializer(serializers.Serializer):
    """Serializer for generating emails"""
    selection_type = serializers.ChoiceField(
        choices=['all', 'filtered', 'selected'],
        default='selected'
    )
    filters = serializers.JSONField(required=False, default=dict)
    selected_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list
    )
    template_id = serializers.IntegerField(required=True)
    batch_name = serializers.CharField(required=False, default='')