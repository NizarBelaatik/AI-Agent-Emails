# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
import threading
import uuid
import logging

from .models import SourcePartner, Recipient, ImportTask
from .serializers import SourcePartnerSerializer
from .utils import validate_recipient_batch
#from .tasks import import_recipients_task
from .utils_import import run_import_background


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
        limit = int(request.data.get('limit', 5000))

        if not selected_ids:
            return Response({'success': False, 'error': 'No ids selected'}, status=400)

        selected_ids = selected_ids[:limit]
        
        # Create import task
        task_id = str(uuid.uuid4())
        task = ImportTask.objects.create(
            task_id=task_id,
            selected_ids=selected_ids,
            total_recipients=len(selected_ids),
            status='PENDING'
        )

        # Start background thread
        thread = threading.Thread(
            target=run_import_background,
            args=(task_id, selected_ids)
        )
        thread.daemon = True
        thread.start()

        return Response({
            'success': True,
            'task_id': task_id,
            'message': 'Import démarré en arrière-plan',
            'total': len(selected_ids)
        }, status=status.HTTP_202_ACCEPTED)
        
        


class ImportTaskStatusView(APIView):
    def get(self, request, task_id):
        try:
            task = ImportTask.objects.get(task_id=task_id)
            return Response({
                'task_id': task.task_id,
                'status': task.status,
                'progress': task.progress,
                'processed': task.processed,
                'total': task.total_recipients,
                'result': task.result,
                'error': task.error_message,
                'created_at': task.created_at,
                'started_at': task.started_at,
                'completed_at': task.completed_at
            })
        except ImportTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=404)


class ImportTasksListView(APIView):
    def get(self, request):
        tasks = ImportTask.objects.all().order_by('-created_at')[:20]
        return Response([
            {
                'task_id': t.task_id,
                'status': t.status,
                'progress': t.progress,
                'processed': t.processed,
                'total': t.total_recipients,
                'created_at': t.created_at,
                'completed_at': t.completed_at
            } for t in tasks
        ])


class CancelImportTaskView(APIView):
    def post(self, request, task_id):
        try:
            task = ImportTask.objects.get(task_id=task_id)
            if task.status in ['PENDING', 'PROGRESS']:
                # Revoke Celery task
                from celery.task.control import revoke
                revoke(task_id, terminate=True)
                
                task.status = 'CANCELLED'
                task.completed_at = timezone.now()
                task.save()
                
                return Response({'success': True, 'message': 'Task cancelled'})
            else:
                return Response({'success': False, 'error': 'Task cannot be cancelled'}, status=400)
        except ImportTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=404)


class ImportedRecipientsView(APIView):
    def get(self, request):
        queryset = Recipient.objects.all().order_by('-created_at')
        
        # Add filters
        search = request.query_params.get('search', '').strip()
        x_activitec = request.query_params.get('x_activitec', '').strip()
        date_from = request.query_params.get('date_from', '')
        date_to = request.query_params.get('date_to', '')
        
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(complete_name__icontains=search) |
                Q(email__icontains=search) |
                Q(company_name__icontains=search) |
                Q(city__icontains=search)
            )
        
        if x_activitec:
            queryset = queryset.filter(x_activitec=x_activitec)
        
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        paginator = CustomPagination()
        page_obj = paginator.paginate_queryset(queryset, request)

        serializer = SourcePartnerSerializer(page_obj, many=True)

        return paginator.get_paginated_response(serializer.data)
    
    
class InvalidRecipientsView(APIView):
    """
    Get recipients that failed validation from recent imports
    """
    def get(self, request):
        # Get recent import tasks with invalid recipients
        recent_tasks = ImportTask.objects.filter(
            status='SUCCESS',
            result__has_key='invalid_details'
        ).order_by('-completed_at')[:5]
        
        invalid_recipients = []
        for task in recent_tasks:
            if task.result and 'invalid_details' in task.result:
                invalid_recipients.extend(task.result['invalid_details'])
        
        # Remove duplicates by ID
        seen = set()
        unique_invalid = []
        for r in invalid_recipients:
            if r['id'] not in seen:
                seen.add(r['id'])
                unique_invalid.append(r)
        
        return Response({
            'success': True,
            'invalid_recipients': unique_invalid[:100]  # Limit to 100
        })