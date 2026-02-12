# views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from django.db.models import Q, Count
from django.utils import timezone

from data_importer.models import Recipient
from .models import  EmailTemplate, GeneratedEmail
from .serializers import (
    RecipientForGenerationSerializer,
    EmailTemplateSerializer
)

from .services import (
    render_email,
    get_or_generate_template
)

from django.conf import settings


# ============================================================
# PAGINATION
# ============================================================

class CustomPagination(PageNumberPagination):
    page_size = 50
    max_page_size = 200


# ============================================================
# RECIPIENT LIST
# ============================================================

class RecipientListView(APIView):
    def get(self, request):

        queryset = Recipient.objects.all().order_by("-created_at")

        search = request.query_params.get("search", "").strip()

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(complete_name__icontains=search) |
                Q(email__icontains=search) |
                Q(company_name__icontains=search)
            )

        paginator = CustomPagination()
        page_obj = paginator.paginate_queryset(queryset, request)

        serializer = RecipientForGenerationSerializer(
            page_obj,
            many=True
        )

        return paginator.get_paginated_response(serializer.data)





# ============================================================
# TEMPLATE LIST
# ============================================================

class TemplateListView(APIView):
    def get(self, request):
        templates = EmailTemplate.objects.all()
        serializer = EmailTemplateSerializer(templates, many=True)
        return Response(serializer.data)

# ============================================================
# EMAIL GENERATION (WITH CATEGORY GROUPING)
# ============================================================
class GenerateEmailsView(APIView):
    def post(self, request):
        print("[GENERATE] POST started")

        recipient_ids = request.data.get("recipient_ids", [])
        print(f"[GENERATE] Received {len(recipient_ids)} IDs: {recipient_ids}")

        if not recipient_ids:
            return Response({"success": False, "error": "Aucun destinataire sélectionné"}, status=400)

        recipients = Recipient.objects.filter(id__in=recipient_ids)
        count = recipients.count()
        print(f"[GENERATE] Found {count} recipients")

        if count == 0:
            return Response({"success": False, "error": "Destinataires introuvables"}, status=404)

        # Group recipients by category
        recipients_by_category = {}
        for recipient in recipients:
            category = recipient.x_activitec or "Général"
            if category not in recipients_by_category:
                recipients_by_category[category] = []
            recipients_by_category[category].append(recipient)

        print(f"[GENERATE] Found {len(recipients_by_category)} categories: {list(recipients_by_category.keys())}")

        total_generated = 0
        results_per_category = {}
        skipped_per_category = {}

        # Process each category separately
        for category_name, category_recipients in recipients_by_category.items():
            print(f"[GENERATE] Processing category: {category_name} with {len(category_recipients)} recipients")

            # Get or generate template for this specific category
            template = get_or_generate_template(category_name)
            
            # Get IDs for this category
            category_recipient_ids = [r.id for r in category_recipients]
            
            # Check existing emails for this category
            existing_ids = set(
                GeneratedEmail.objects.filter(
                    recipient_id__in=category_recipient_ids,
                    category_name=category_name
                ).values_list("recipient_id", flat=True)
            )
            
            skipped_count = len(existing_ids)
            if skipped_count > 0:
                skipped_per_category[category_name] = skipped_count
                print(f"[GENERATE] {skipped_count} already exist for category {category_name}")

            new_emails = []
            for recipient in category_recipients:
                if recipient.id in existing_ids:
                    continue

                print(f"[RENDER] Starting for {recipient.name} (ID {recipient.id}) - Category: {category_name}")
                subject, body_html = render_email(template, recipient)
                print(f"[RENDER] Done - Subject: {subject[:100]}...")

                new_emails.append(
                    GeneratedEmail(
                        recipient=recipient,
                        category_name=category_name,
                        template=template,
                        subject=subject,
                        body_html=body_html,
                        status="generated"
                    )
                )

            if new_emails:
                print(f"[GENERATE] Creating {len(new_emails)} new emails for category {category_name}...")
                GeneratedEmail.objects.bulk_create(new_emails)
                total_generated += len(new_emails)
                results_per_category[category_name] = len(new_emails)

        print(f"[GENERATE] Finished successfully. Total generated: {total_generated}")
        
        response_data = {
            "success": True,
            "generated": total_generated,
            "by_category": results_per_category
        }
        
        if skipped_per_category:
            response_data["skipped"] = sum(skipped_per_category.values())
            response_data["skipped_by_category"] = skipped_per_category
            
        return Response(response_data)