import uuid
from django.utils import timezone
from django.db.models import Q, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from data_importer.models import Recipient
from .models import DispatchEmail, DispatchBatch, DispatchLog
from .serializers import (
    DispatchEmailSerializer, DispatchEmailDetailSerializer,
    DispatchBatchSerializer, CreateEmailsFromRecipientsSerializer,
    SendBatchSerializer
)
from .services import (
    create_emails_from_recipients,
    send_emails_batch,
    cancel_batch
)

import logging
logger = logging.getLogger(__name__)


class CustomPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


# ============================================================
# EMAIL MANAGEMENT
# ============================================================

class EmailListView(APIView):
    """
    GET /api/email-dispatcher/emails/
    List all emails with filters
    """
    def get(self, request):
        queryset = DispatchEmail.objects.all().order_by('-created_at')
        
        # Filters
        status = request.query_params.get('status')
        search = request.query_params.get('search', '').strip()
        batch_id = request.query_params.get('batch_id')
        
        if status:
            queryset = queryset.filter(status=status)
        
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        
        if search:
            queryset = queryset.filter(
                Q(recipient_name__icontains=search) |
                Q(recipient_email__icontains=search) |
                Q(subject__icontains=search)
            )
        
        # Pagination
        paginator = CustomPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = DispatchEmailSerializer(page, many=True)
        
        return paginator.get_paginated_response(serializer.data)


class EmailDetailView(APIView):
    """
    GET /api/email-dispatcher/emails/<id>/
    Get email details
    """
    def get(self, request, pk):
        try:
            email = DispatchEmail.objects.get(pk=pk)
            serializer = DispatchEmailDetailSerializer(email)
            return Response(serializer.data)
        except DispatchEmail.DoesNotExist:
            return Response(
                {'error': 'Email not found'},
                status=404
            )


class EmailStatsView(APIView):
    """
    GET /api/email-dispatcher/emails/stats/
    Get email statistics
    """
    def get(self, request):
        total = DispatchEmail.objects.count()
        pending = DispatchEmail.objects.filter(status='pending').count()
        queued = DispatchEmail.objects.filter(status='queued').count()
        sending = DispatchEmail.objects.filter(status='sending').count()
        sent = DispatchEmail.objects.filter(status='sent').count()
        failed = DispatchEmail.objects.filter(status='failed').count()
        
        # Today's stats
        today = timezone.now().date()
        sent_today = DispatchEmail.objects.filter(
            status='sent',
            sent_at__date=today
        ).count()
        
        return Response({
            'total': total,
            'pending': pending,
            'queued': queued,
            'sending': sending,
            'sent': sent,
            'failed': failed,
            'sent_today': sent_today,
        })


# ============================================================
# CREATE EMAILS FROM RECIPIENTS
# ============================================================

class CreateEmailsFromRecipientsView(APIView):
    """
    POST /api/email-dispatcher/create-from-recipients/
    Create emails from selected recipients
    """
    def post(self, request):
        serializer = CreateEmailsFromRecipientsSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                {'success': False, 'errors': serializer.errors},
                status=400
            )
        
        data = serializer.validated_data
        
        # Create emails
        emails, error = create_emails_from_recipients(
            data['recipient_ids'],
            data
        )
        
        if error:
            return Response(
                {'success': False, 'error': error},
                status=400
            )
        
        return Response({
            'success': True,
            'message': f"{len(emails)} emails créés avec succès",
            'count': len(emails),
            'email_ids': [e.id for e in emails]
        })


# ============================================================
# SEND EMAILS
# ============================================================

class SendEmailsView(APIView):
    """
    POST /api/email-dispatcher/send/
    Send selected emails
    """
    def post(self, request):
        serializer = SendBatchSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                {'success': False, 'errors': serializer.errors},
                status=400
            )
        
        data = serializer.validated_data
        email_ids = data['email_ids']
        
        # Check if emails exist
        existing = DispatchEmail.objects.filter(id__in=email_ids).count()
        if existing != len(email_ids):
            return Response(
                {'success': False, 'error': 'Certains emails sont introuvables'},
                status=400
            )
        
        # Check if all are pending/queued
        invalid_status = DispatchEmail.objects.filter(
            id__in=email_ids
        ).exclude(
            status__in=['pending', 'queued']
        ).count()
        
        if invalid_status > 0:
            return Response({
                'success': False,
                'error': 'Certains emails ne sont pas en attente (déjà envoyés ou en cours)'
            }, status=400)
        
        # Start batch sending
        batch = send_emails_batch(
            email_ids=email_ids,
            batch_name=data.get('batch_name', ''),
            send_speed=data['send_speed'],
            use_time_window=data['use_time_window'],
            start_time=data.get('start_time'),
            end_time=data.get('end_time')
        )
        
        return Response({
            'success': True,
            'message': f"Envoi démarré pour {len(email_ids)} emails",
            'batch_id': batch.batch_id,
            'batch': DispatchBatchSerializer(batch).data
        }, status=status.HTTP_202_ACCEPTED)


# ============================================================
# BATCH MANAGEMENT
# ============================================================

class BatchListView(APIView):
    """
    GET /api/email-dispatcher/batches/
    List all batches
    """
    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        batches = DispatchBatch.objects.all().order_by('-created_at')[:limit]
        serializer = DispatchBatchSerializer(batches, many=True)
        return Response(serializer.data)


class BatchDetailView(APIView):
    """
    GET /api/email-dispatcher/batches/<batch_id>/
    Get batch details with emails
    """
    def get(self, request, batch_id):
        try:
            batch = DispatchBatch.objects.get(batch_id=batch_id)
            
            # Get emails in this batch
            emails = DispatchEmail.objects.filter(batch_id=batch_id)
            email_serializer = DispatchEmailSerializer(emails, many=True)
            
            # Get logs
            logs = DispatchLog.objects.filter(batch=batch)[:50]
            
            return Response({
                'batch': DispatchBatchSerializer(batch).data,
                'emails': email_serializer.data,
                'logs': [
                    {
                        'email': log.email.recipient_email,
                        'status': log.status,
                        'message_id': log.message_id,
                        'error': log.error,
                        'created_at': log.created_at
                    }
                    for log in logs
                ]
            })
            
        except DispatchBatch.DoesNotExist:
            return Response(
                {'error': 'Batch not found'},
                status=404
            )


class BatchCancelView(APIView):
    """
    POST /api/email-dispatcher/batches/<batch_id>/cancel/
    Cancel a sending batch
    """
    def post(self, request, batch_id):
        success, message = cancel_batch(batch_id)
        
        if success:
            return Response({
                'success': True,
                'message': message
            })
        else:
            return Response({
                'success': False,
                'error': message
            }, status=400)


class BatchEmailsView(APIView):
    """
    GET /api/email-dispatcher/batches/<batch_id>/emails/
    Get emails in a batch
    """
    def get(self, request, batch_id):
        emails = DispatchEmail.objects.filter(batch_id=batch_id).order_by('-created_at')
        
        # Pagination
        paginator = CustomPagination()
        page = paginator.paginate_queryset(emails, request)
        serializer = DispatchEmailSerializer(page, many=True)
        
        return paginator.get_paginated_response(serializer.data)


# ============================================================
# SENT EMAILS
# ============================================================

class SentEmailsListView(APIView):
    """
    GET /api/email-dispatcher/sent/
    List sent emails
    """
    def get(self, request):
        queryset = DispatchEmail.objects.filter(
            status='sent'
        ).order_by('-sent_at')
        
        # Filters
        search = request.query_params.get('search', '').strip()
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if search:
            queryset = queryset.filter(
                Q(recipient_name__icontains=search) |
                Q(recipient_email__icontains=search) |
                Q(subject__icontains=search)
            )
        
        if date_from:
            queryset = queryset.filter(sent_at__date__gte=date_from)
        
        if date_to:
            queryset = queryset.filter(sent_at__date__lte=date_to)
        
        # Pagination
        paginator = CustomPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = DispatchEmailSerializer(page, many=True)
        
        return paginator.get_paginated_response(serializer.data)


# ============================================================
# AVAILABLE RECIPIENTS (from data_importer)
# ============================================================

class AvailableRecipientsView(APIView):
    """
    GET /api/email-dispatcher/available-recipients/
    Get recipients from data_importer that can be used
    """
    def get(self, request):
        # Get all recipients with email
        queryset = Recipient.objects.filter(
            email__isnull=False
        ).exclude(
            email=''
        ).order_by('-created_at')
        
        # Basic filters
        search = request.query_params.get('search', '').strip()
        x_activitec = request.query_params.get('x_activitec', '').strip()
        city = request.query_params.get('city', '').strip()
        
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(complete_name__icontains=search) |
                Q(email__icontains=search) |
                Q(company_name__icontains=search)
            )
        
        if x_activitec:
            queryset = queryset.filter(x_activitec=x_activitec)
        
        if city:
            queryset = queryset.filter(city__icontains=city)
        
        # Check if already used
        used_recipient_ids = set(
            DispatchEmail.objects.values_list('recipient_id', flat=True)
        )
        
        # Pagination
        paginator = CustomPagination()
        page = paginator.paginate_queryset(queryset, request)
        
        result = []
        for recipient in page:
            result.append({
                'id': recipient.id,
                'name': recipient.name or recipient.complete_name or 'Inconnu',
                'email': recipient.email,
                'company_name': recipient.company_name,
                'city': recipient.city,
                'x_activitec': recipient.x_activitec,
                'already_used': recipient.id in used_recipient_ids
            })
        
        return paginator.get_paginated_response({
            'count': paginator.page.paginator.count,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
            'results': result
        })


# ============================================================
# ACTIVITIES LIST (for filters)
# ============================================================

class ActivitiesListView(APIView):
    """
    GET /api/email-dispatcher/activities/
    Get unique activities from recipients
    """
    def get(self, request):
        activities = Recipient.objects.filter(
            x_activitec__isnull=False
        ).exclude(
            x_activitec=''
        ).values_list('x_activitec', flat=True).distinct().order_by('x_activitec')
        
        return Response(list(activities))