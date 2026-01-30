from django.contrib import admin
from .models import (
    Recipient,
    EmailTemplate,
    GeneratedEmail,
    EmailCampaign,
    EmailLog,
    Setting
)


# ---------------- Recipient ----------------
@admin.register(Recipient)
class RecipientAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "full_name",
        "category",
        "subcategory",
        "company",
        "is_active",
        "last_interaction",
        "imported_at",
    )
    list_filter = ("category", "subcategory", "is_active")
    search_fields = ("email", "full_name", "company")
    ordering = ("-imported_at",)
    readonly_fields = ("imported_at",)


# ---------------- EmailTemplate ----------------
@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "template_type",
        "category",
        "subcategory",
        "is_active",
        "created_at",
        "updated_at",
    )
    list_filter = ("template_type", "category", "is_active")
    search_fields = ("name", "category", "subcategory")
    readonly_fields = ("created_at", "updated_at")


# ---------------- EmailLog Inline ----------------
class EmailLogInline(admin.TabularInline):
    model = EmailLog
    extra = 0
    readonly_fields = (
        "action",
        "performed_by",
        "performed_at",
        "details",
        "metadata",
    )
    can_delete = False
    verbose_name = "Log"
    verbose_name_plural = "Logs"


# ---------------- GeneratedEmail ----------------
@admin.register(GeneratedEmail)
class GeneratedEmailAdmin(admin.ModelAdmin):
    list_display = (
        "recipient",
        "status",
        "priority",
        "generated_at",
        "scheduled_for",
        "sent_at",
    )
    list_filter = ("status", "priority", "generated_at", "scheduled_for")
    search_fields = ("recipient__email", "recipient__full_name", "subject")
    ordering = ("-generated_at",)
    readonly_fields = (
        "generated_at",
        "approved_at",
        "edited_at",
        "sent_at",
        "ses_message_id",
        "error_message",
    )
    inlines = [EmailLogInline]


# ---------------- EmailCampaign ----------------
@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status",
        "recipient_count",
        "email_count",
        "created_by",
        "created_at",
        "scheduled_for",
        "completed_at",
    )
    list_filter = ("status", "created_at", "scheduled_for")
    search_fields = ("name", "description", "created_by")
    readonly_fields = ("created_at", "completed_at")
    inlines = [EmailLogInline]


# ---------------- EmailLog ----------------
@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = (
        "action",
        "performed_by",
        "email",
        "campaign",
        "performed_at",
    )
    list_filter = ("action", "performed_at")
    search_fields = ("performed_by", "details")
    readonly_fields = ("performed_at",)
    ordering = ("-performed_at",)


# ---------------- Settings ----------------
@admin.register(Setting)
class SettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "description", "updated_at")
    search_fields = ("key", "description")
    readonly_fields = ("updated_at",)
