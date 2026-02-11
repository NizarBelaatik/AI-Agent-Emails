from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from rest_framework.pagination import PageNumberPagination

from .models import SourcePartner, Recipient
from .serializers import SourcePartnerSerializer
import logging

logger = logging.getLogger(__name__)


class CustomPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class SourceStatsView(APIView):
    def get(self, request):
        qs = SourcePartner.objects.using('source_db')
        try:
            total = qs.count()
            with_email = qs.filter(active=True, email__isnull=False).exclude(email='').count()
        except Exception as e:
            logger.error(f"Stats error: {e}")
            return Response({'success': False, 'error': str(e)}, status=500)

        return Response({
            'success': True,
            'stats': {
                'total': total,
                'with_email': with_email,
            }
        })


class BrowseSourceView(APIView):
    def get(self, request):
        # Exclude already imported partners
        imported_ids = set(Recipient.objects.values_list('source_id', flat=True))

        queryset = SourcePartner.objects.using('source_db').order_by('-id').exclude(id__in=imported_ids)

        search = request.query_params.get('search', '').strip()
        x_activitec = request.query_params.get('x_activitec', '').strip()
        active_only = request.query_params.get('active_only', 'true').lower() == 'true'
        has_email = request.query_params.get('has_email', 'true').lower() == 'true'

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(complete_name__icontains=search) |
                Q(email__icontains=search) |
                Q(city__icontains=search)
            )

        if x_activitec:
            queryset = queryset.filter(x_activitec=x_activitec)

        if active_only:
            queryset = queryset.filter(active=True)

        if has_email:
            queryset = queryset.filter(email__isnull=False).exclude(email='')

        paginator = CustomPagination()
        page_obj = paginator.paginate_queryset(queryset, request)

        serializer = SourcePartnerSerializer(page_obj, many=True)

        return paginator.get_paginated_response(serializer.data)


class ImportRecipientsView(APIView):
    def post(self, request):
        selected_ids = request.data.get('selected_ids', [])
        limit = int(request.data.get('limit', 500))
        update_existing = request.data.get('update_existing', True)

        if not selected_ids:
            return Response({'success': False, 'error': 'No ids selected'}, status=400)

        selected_ids = selected_ids[:limit]
        source_partners = SourcePartner.objects.using('source_db').filter(id__in=selected_ids)

        imported = updated = failed = 0

        for sp in source_partners:
            try:
                _, created = Recipient.objects.update_or_create(
                    source_id=sp.id,
                    defaults={
                        # Core / common fields
                        'name': sp.name,
                        'complete_name': sp.complete_name,
                        'email': sp.email,
                        'phone': sp.phone,
                        'mobile': sp.mobile,
                        'city': sp.city,
                        'street': sp.street,
                        'street2': sp.street2,
                        'zip': sp.zip,
                        'active': sp.active,
                        'is_company': sp.is_company,

                        # Your custom x_ fields (using correct lowercase Python names)
                        'x_activitec': sp.x_activitec,
                        'x_ice': sp.x_ice,
                        'x_source': sp.x_source,
                        'x_capital': sp.x_capital,
                        'x_effectif': sp.x_effectif,
                        'x_forme_juridique': sp.x_forme_juridique,
                        'x_rc': sp.x_rc,
                        'x_if': sp.x_if,

                        # All remaining Odoo fields from your list
                        'company_id': sp.company_id,
                        'create_date': sp.create_date,
                        'title': sp.title,
                        'parent_id': sp.parent_id,
                        'user_id': sp.user_id,
                        'state_id': sp.state_id,
                        'country_id': sp.country_id,
                        'industry_id': sp.industry_id,
                        'color': sp.color,
                        'commercial_partner_id': sp.commercial_partner_id,
                        'create_uid': sp.create_uid,
                        'write_uid': sp.write_uid,
                        'ref': sp.ref,
                        'lang': sp.lang,
                        'tz': sp.tz,
                        'vat': sp.vat,
                        'company_registry': sp.company_registry,
                        'website': sp.website,
                        'function': sp.function,
                        'type': sp.type,
                        'commercial_company_name': sp.commercial_company_name,
                        'company_name': sp.company_name,
                        'barcode': sp.barcode,
                        'comment': sp.comment,
                        'partner_latitude': sp.partner_latitude,
                        'partner_longitude': sp.partner_longitude,
                        'partner_share': sp.partner_share,
                        'write_date': sp.write_date,
                        'message_bounce': sp.message_bounce,
                        'email_normalized': sp.email_normalized,
                        'signup_type': sp.signup_type,
                        'specific_property_product_pricelist': sp.specific_property_product_pricelist,
                        'partner_gid': sp.partner_gid,
                        'additional_info': sp.additional_info,
                        'phone_sanitized': sp.phone_sanitized,
                        'invoice_template_pdf_report_id': sp.invoice_template_pdf_report_id,
                        'supplier_rank': sp.supplier_rank,
                        'customer_rank': sp.customer_rank,
                        'invoice_warn': sp.invoice_warn,
                        'autopost_bills': sp.autopost_bills,
                        'credit_limit': sp.credit_limit,
                        'property_account_payable_id': sp.property_account_payable_id,
                        'property_account_receivable_id': sp.property_account_receivable_id,
                        'property_account_position_id': sp.property_account_position_id,
                        'property_payment_term_id': sp.property_payment_term_id,
                        'property_supplier_payment_term_id': sp.property_supplier_payment_term_id,
                        'trust': sp.trust,
                        'ignore_abnormal_invoice_date': sp.ignore_abnormal_invoice_date,
                        'ignore_abnormal_invoice_amount': sp.ignore_abnormal_invoice_amount,
                        'invoice_sending_method': sp.invoice_sending_method,
                        'invoice_edi_format_store': sp.invoice_edi_format_store,
                        'property_outbound_payment_method_line_id': sp.property_outbound_payment_method_line_id,
                        'property_inbound_payment_method_line_id': sp.property_inbound_payment_method_line_id,
                        'invoice_warn_msg': sp.invoice_warn_msg,
                        'debit_limit': sp.debit_limit,
                        'peppol_endpoint': sp.peppol_endpoint,
                        'peppol_eas': sp.peppol_eas,
                        'sale_warn': sp.sale_warn,
                        'sale_warn_msg': sp.sale_warn_msg,
                        'calendar_last_notif_ack': sp.calendar_last_notif_ack,
                        'website_id': sp.website_id,
                        'is_published': sp.is_published,
                        'date_localization': sp.date_localization,
                        'buyer_id': sp.buyer_id,
                        'purchase_warn': sp.purchase_warn,
                        'property_purchase_currency_id': sp.property_purchase_currency_id,
                        'receipt_reminder_email': sp.receipt_reminder_email,
                        'reminder_date_before_receipt': sp.reminder_date_before_receipt,
                        'purchase_warn_msg': sp.purchase_warn_msg,
                        'is_converted_to_lead': sp.is_converted_to_lead,
                        'lead_conversion_date': sp.lead_conversion_date,
                    }
                )
                if created:
                    imported += 1
                else:
                    updated += 1
            except Exception as e:
                failed += 1
                logger.error(f"Import failed for ID {sp.id}: {e}")

        return Response({
            'success': True,
            'stats': {
                'imported': imported,
                'updated': updated,
                'failed': failed
            }
        }, status=status.HTTP_200_OK)


class ImportedRecipientsView(APIView):
    def get(self, request):
        queryset = Recipient.objects.all().order_by('-created_at')

        paginator = CustomPagination()
        page_obj = paginator.paginate_queryset(queryset, request)

        serializer = SourcePartnerSerializer(page_obj, many=True)  # reuse for now

        return paginator.get_paginated_response(serializer.data)