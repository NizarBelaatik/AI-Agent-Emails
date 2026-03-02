from django.contrib import admin
from django.utils.html import format_html
from .models import DispatchEmail, DispatchBatch, DispatchLog


# ==============================
# Dispatch Log Inline
# ==============================

class DispatchLogInline(admin.TabularInline):
    model = DispatchLog
    extra = 0
    readonly_fields = ("status", "message_id", "response", "error", "created_at")
    can_delete = False


# ==============================
# Dispatch Email Admin
# ==============================

@admin.register(DispatchEmail)
class DispatchEmailAdmin(admin.ModelAdmin):
    list_display = (
        "recipient_email",
        "subject",
        "status",
        "batch_id",
        "sent_at",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
        "sent_at",
        "batch_id",
    )

    search_fields = (
        "recipient_email",
        "recipient_name",
        "subject",
        "message_id",
        "batch_id",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "sent_at",
        "message_id",
        "error_message",
    )

    inlines = [DispatchLogInline]

    ordering = ("-created_at",)

    list_per_page = 50


# ==============================
# Dispatch Batch Admin
# ==============================

@admin.register(DispatchBatch)
class DispatchBatchAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status",
        "total_emails",
        "sent_count",
        "failed_count",
        "progress_bar",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "name",
        "batch_id",
    )

    readonly_fields = (
        "batch_id",
        "created_at",
        "started_at",
        "completed_at",
        "progress_bar",
    )

    ordering = ("-created_at",)

    def progress_bar(self, obj):
        percentage = obj.progress
        color = "green" if percentage == 100 else "orange"
        return format_html(
            '<div style="width:100px; background:#eee;">'
            '<div style="width:{}%; background:{}; color:white; text-align:center;">'
            '{}%</div></div>',
            percentage,
            color,
            percentage,
        )

    progress_bar.short_description = "Progress"


# ==============================
# Dispatch Log Admin
# ==============================

@admin.register(DispatchLog)
class DispatchLogAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "batch",
        "status",
        "message_id",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "email__recipient_email",
        "message_id",
    )

    readonly_fields = (
        "email",
        "batch",
        "status",
        "message_id",
        "response",
        "error",
        "created_at",
    )

    ordering = ("-created_at",)