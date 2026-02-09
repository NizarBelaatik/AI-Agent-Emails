from django.contrib import admin
from .models import (
    Recipient, GeneratedEmail, EmailTemplate, 
    EmailLog, EmailCampaign, Setting
)

@admin.register(Recipient)
class RecipientAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'x_activitec', 'city', 'is_active', 'imported_at')
    list_filter = ('x_activitec', 'city', 'is_active', 'company')
    search_fields = ('email', 'full_name', 'city')
    ordering = ('-imported_at',)
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('email', 'full_name', 'x_activitec', 'city')
        }),
        ('Status', {
            'fields': ('is_active', 'company', 'last_interaction')
        }),
        ('Source Info', {
            'fields': ('source_id', 'imported_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(GeneratedEmail)
class GeneratedEmailAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'status', 'subject_preview', 'generated_at', 'sent_at')
    list_filter = ('status', 'priority', 'generated_at')
    search_fields = ('subject', 'recipient__email', 'recipient__full_name')
    ordering = ('-generated_at',)
    
    def subject_preview(self, obj):
        return obj.subject[:50] + '...' if len(obj.subject) > 50 else obj.subject
    subject_preview.short_description = 'Subject'

@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'template_type', 'is_active', 'created_at')
    list_filter = ('template_type', 'is_active')
    search_fields = ('name', 'description')

@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'performed_by', 'email_link', 'performed_at')
    list_filter = ('action', 'performed_by', 'performed_at')
    search_fields = ('details', 'performed_by')
    ordering = ('-performed_at',)
    
    def email_link(self, obj):
        if obj.email:
            return f'Email #{obj.email.id}'
        return '-'
    email_link.short_description = 'Email'

@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'recipient_count', 'email_count', 'created_at')
    list_filter = ('status', 'created_at')

@admin.register(Setting)
class SettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'value_preview', 'updated_at')
    search_fields = ('key', 'value', 'description')
    ordering = ('key',)
    
    def value_preview(self, obj):
        return obj.value[:50] + '...' if len(obj.value) > 50 else obj.value
    value_preview.short_description = 'Value'

# Optional: Custom admin site header
admin.site.site_header = 'Email Automation Admin'
admin.site.site_title = 'Email Automation System'
admin.site.index_title = 'Dashboard'
