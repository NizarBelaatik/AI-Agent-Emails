from rest_framework import serializers
from data_importer.models import Recipient
from .models import  EmailTemplate, GeneratedEmail


class RecipientForGenerationSerializer(serializers.ModelSerializer):
    has_generated_email = serializers.SerializerMethodField()

    class Meta:
        model = Recipient
        fields = [
            'id', 'name', 'complete_name', 'email', 'company_name', 'city',
            'x_activitec', 'x_forme_juridique', 'x_ice', 'has_generated_email'
        ]

    def get_has_generated_email(self, obj):
        category_id = self.context.get('category_id')
        if not category_id:
            return False
        return GeneratedEmail.objects.filter(recipient=obj, category_id=category_id).exists()




class EmailTemplateSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = EmailTemplate
        fields = ['id', 'category', 'category_name', 'subject_template',
                  'body_template', 'is_generated', 'generated_at', 'model_used']