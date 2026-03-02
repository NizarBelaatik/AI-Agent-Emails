from django.contrib import admin
from .models import SentEmail, SendingBatch, EmailSendLog

@admin.register(SentEmail)
class SentEmailAdmin(admin.ModelAdmin):
    list_display = ('recipient_email', 'subject', 'status', 'sent_at', 'opened_at', 'clicked_at')
    list_filter = ('status', 'sent_at', 'opened_at', 'clicked_at')
    search_fields = ('recipient_email', 'subject', 'message_id')
    readonly_fields = ('created_at', 'updated_at', 'opened_at', 'clicked_at', 'message_id', 'error_message')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(SendingBatch)
class SendingBatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'status', 'total_emails', 'sent_count', 'failed_count', 'progress', 'started_at', 'completed_at')
    list_filter = ('status',)
    search_fields = ('name',)
    readonly_fields = ('created_at', 'started_at', 'completed_at')
    ordering = ('-created_at',)


@admin.register(EmailSendLog)
class EmailSendLogAdmin(admin.ModelAdmin):
    list_display = ('generated_email', 'queue', 'attempt_number', 'status', 'sent_at', 'error_message')
    list_filter = ('status', 'attempt_number')
    search_fields = ('generated_email__subject', 'message_id', 'queue__id')
    readonly_fields = ('created_at', 'sent_at', 'message_id', 'error_message')
    ordering = ('-created_at',)
