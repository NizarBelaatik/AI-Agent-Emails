import uuid
from datetime import datetime, timedelta
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


class EmailListView(APIView):
    """
    GET /api/email-dispatcher/emails/
    List all emails with filters
    """
    def get(self, request):
        # Check if we should include sent emails
        include_sent = request.query_params.get('include_sent', 'false').lower() == 'true'
        
        if include_sent:
            # Include all emails
            queryset = DispatchEmail.objects.all().order_by('-created_at')
        else:
            # Exclude sent emails (default behavior)
            queryset = DispatchEmail.objects.exclude(
                status='sent'
            ).order_by('-created_at')
        
        # Filters
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search', '').strip()
        batch_id = request.query_params.get('batch_id')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
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
    
    

class AllEmailsListView(APIView):
    """
    GET /api/email-dispatcher/all-emails/
    List ALL emails including sent ones
    """
    def get(self, request):
        queryset = DispatchEmail.objects.all().order_by('-created_at')
        
        # Filters
        status = request.query_params.get('status')
        search = request.query_params.get('search', '').strip()
        
        if status:
            queryset = queryset.filter(status=status)
        
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


class CreateEmailsFromRecipientsView(APIView):
    """
    POST /api/email-dispatcher/create-from-recipients/
    Create emails from selected recipients
    """
    def post(self, request):
        serializer = CreateEmailsFromRecipientsSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.error(f"Create emails validation errors: {serializer.errors}")
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


class SendEmailsView(APIView):
    """
    POST /api/email-dispatcher/send/
    Send selected emails with intelligent scheduling
    """
    def post(self, request):
        logger.info(f"SendEmailsView received data: {request.data}")
        
        serializer = SendBatchSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.error(f"Send emails validation errors: {serializer.errors}")
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
            invalid_emails = list(DispatchEmail.objects.filter(
                id__in=email_ids
            ).exclude(
                status__in=['pending', 'queued']
            ).values('id', 'status'))
            
            logger.warning(f"Invalid status emails: {invalid_emails}")
            
            return Response({
                'success': False,
                'error': 'Certains emails ne sont pas en attente (déjà envoyés ou en cours)',
                'invalid_emails': invalid_emails
            }, status=400)
        
        # Calculate estimated time
        total_emails = len(email_ids)
        send_speed = data['send_speed']
        estimated_minutes = 0
        
        if data['use_time_window'] and data['start_time'] and data['end_time']:
            # Calculate window duration
            start = datetime.combine(timezone.now().date(), data['start_time'])
            end = datetime.combine(timezone.now().date(), data['end_time'])
            if end <= start:
                end = end + timedelta(days=1)
            window_minutes = (end - start).total_seconds() / 60
            
            if data.get('distribution_method') == 'spread':
                estimated_minutes = window_minutes
            else:
                delay = data.get('fixed_delay_seconds', 1)
                estimated_minutes = (total_emails * delay) / 60
        else:
            if send_speed > 0:
                estimated_minutes = (total_emails / send_speed) * 60
            else:
                estimated_minutes = total_emails * 0.5  # Rough estimate for unlimited
        
        # Start batch sending
        batch = send_emails_batch(
            email_ids=email_ids,
            batch_name=data.get('batch_name', ''),
            send_speed=data['send_speed'],
            use_time_window=data['use_time_window'],
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            distribution_method=data.get('distribution_method', 'spread'),
            fixed_delay_seconds=data.get('fixed_delay_seconds', 1)
        )
        
        return Response({
            'success': True,
            'message': f"Envoi démarré pour {total_emails} emails",
            'batch_id': str(batch.batch_id),
            'batch': DispatchBatchSerializer(batch).data,
            'estimated_time': f"{estimated_minutes:.0f} minutes"
        }, status=status.HTTP_202_ACCEPTED)


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


class AvailableRecipientsView(APIView):
    """
    GET /api/email-dispatcher/available-recipients/
    Get recipients from data_importer that can be used
    """
    def get(self, request):
        try:
            # Get all recipients with email that haven't been dispatched yet
            queryset = Recipient.objects.filter(
                email__isnull=False,
                email_dispatched=False
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
                    'already_used': recipient.email_dispatched,
                    'dispatch_count': recipient.email_dispatch_count,
                    'dispatched_at': recipient.email_dispatched_at,
                })
            
            return paginator.get_paginated_response(result)
            
        except Exception as e:
            logger.error(f"Error in AvailableRecipientsView: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                'count': 0,
                'next': None,
                'previous': None,
                'results': []
            })


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


class DebugEmailStatusView(APIView):
    """
    GET /api/email-dispatcher/debug-status/
    Debug endpoint to check email statuses
    """
    def get(self, request):
        total = DispatchEmail.objects.count()
        status_counts = {
            'pending': DispatchEmail.objects.filter(status='pending').count(),
            'queued': DispatchEmail.objects.filter(status='queued').count(),
            'sending': DispatchEmail.objects.filter(status='sending').count(),
            'sent': DispatchEmail.objects.filter(status='sent').count(),
            'failed': DispatchEmail.objects.filter(status='failed').count(),
        }
        
        # Get sample of recent emails
        recent = list(DispatchEmail.objects.order_by('-created_at')[:10].values(
            'id', 'status', 'recipient_email', 'subject', 'created_at'
        ))
        
        return Response({
            'total': total,
            'status_counts': status_counts,
            'recent_emails': recent
        })