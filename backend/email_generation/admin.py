from django.contrib import admin
from .models import  EmailTemplate, GeneratedEmail



@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ('category_name', 'model_used', 'is_generated', 'created_at')
    list_filter = ('is_generated', 'model_used', 'created_at')
    search_fields = ('category_name', 'subject_template')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(GeneratedEmail)
class GeneratedEmailAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'category_name', 'status', 'generated_at', 'sent_at')
    list_filter = ('status', 'generated_at', 'sent_at')
    search_fields = ('recipient__name', 'subject')
    readonly_fields = ('generated_at',)
