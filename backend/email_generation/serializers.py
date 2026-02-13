# serializers.py
from rest_framework import serializers
from data_importer.models import Recipient
from .models import  EmailTemplate, GeneratedEmail, EmailGenerationTask


class RecipientForGenerationSerializer(serializers.ModelSerializer):
    has_generated_email = serializers.SerializerMethodField()
    
    class Meta:
        model = Recipient
        fields = [
            'id', 'name', 'complete_name', 'email', 'city', 
            'x_activitec', 'company_name', 'has_generated_email'
        ]
    
    def get_has_generated_email(self, obj):
        return hasattr(obj, 'generated_emails') and obj.generated_emails.exists()




class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = '__all__'


class EmailGenerationTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailGenerationTask
        fields = [
            'task_id', 'recipient_ids', 'selected_category', 
            'total_recipients', 'total_categories', 'current_category',
            'status', 'progress_info', 'result', 'error_message',
            'created_at', 'started_at', 'completed_at', 'progress_percentage'
        ]