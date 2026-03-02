from django.contrib import admin
from .models import SourcePartner, Recipient


@admin.register(SourcePartner)
class SourcePartnerAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "email",
        "phone",
        "mobile",
        "is_company",
        "active",
        "x_ice",
    )
    search_fields = ("name", "email", "phone", "x_ice")
    list_filter = ("active", "is_company")
    ordering = ("id",)

    # Prevent editing Odoo data from Django
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Recipient)
class RecipientAdmin(admin.ModelAdmin):
    list_display = (
        "source_id",
        "name",
        "email",
        "phone",
        "city",
        "is_company",
        "active",
        "created_at",
    )
    search_fields = ("name", "email", "phone", "x_ice")
    list_filter = ("active", "is_company", "created_at")
    ordering = ("-created_at",)
