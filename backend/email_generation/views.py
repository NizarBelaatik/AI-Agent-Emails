# views.py
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings
from celery.result import AsyncResult

from data_importer.models import Recipient
from .models import EmailTemplate, GeneratedEmail, EmailGenerationTask
from .serializers import (
    RecipientForGenerationSerializer,
    EmailTemplateSerializer,
    EmailGenerationTaskSerializer
)
from .tasks import generate_emails_task
from .services import (
    render_email,
    get_or_generate_template,
    generate_emails_for_recipients,  # This is now available!
    create_generation_queue,
    get_queue_status,
    get_dashboard_stats
)



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

        serializer = RecipientForGenerationSerializer(page_obj, many=True)
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
# CATEGORY LIST
# ============================================================



# ============================================================
# EMAIL GENERATION (ASYNC WITH THREADING)
# ============================================================
import threading
import uuid
from django.http import JsonResponse
from .models import EmailGenerationTask, GeneratedEmail
from .services import generate_emails_for_recipients

class GenerateEmailsView(APIView):
    def post(self, request):
        print("=" * 50)
        print("[GENERATE] POST started - ASYNC MODE")
        print("=" * 50)

        recipient_ids = request.data.get("recipient_ids", [])
        selected_category = request.data.get("category_name", 'auto')
        
        print(f"[GENERATE] Received {len(recipient_ids)} IDs")
        print(f"[GENERATE] Selected category: {selected_category}")

        if not recipient_ids:
            return Response(
                {"success": False, "error": "Aucun destinataire sélectionné"}, 
                status=400
            )

        # Verify recipients exist
        recipients_count = Recipient.objects.filter(id__in=recipient_ids).count()
        if recipients_count == 0:
            return Response(
                {"success": False, "error": "Destinataires introuvables"}, 
                status=404
            )

        # Create task record
        task_id = str(uuid.uuid4())
        
        # Create generation queue
        queue = create_generation_queue(
            task_id=task_id,
            recipient_ids=recipient_ids,
            name=f"Génération {len(recipient_ids)} emails"
        )
        
        # Create task
        task = EmailGenerationTask.objects.create(
            task_id=task_id,
            recipient_ids=json.dumps(recipient_ids),
            selected_category=selected_category,
            total_recipients=len(recipient_ids),
            status='PENDING',
            queue=queue
        )

        # Start background thread
        thread = threading.Thread(
            target=self._run_generation_task,
            args=(task_id, recipient_ids, selected_category)
        )
        thread.daemon = True
        thread.start()

        return Response({
            "success": True,
            "task_id": task_id,
            "queue_id": queue.id,
            "message": "Génération démarrée en arrière-plan",
            "recipient_count": len(recipient_ids)
        })
    
    def _run_generation_task(self, task_id, recipient_ids, selected_category):
        """Run generation task in background thread"""
        try:
            task = EmailGenerationTask.objects.get(task_id=task_id)
            queue = task.queue
            
            task.status = 'PROGRESS'
            task.started_at = timezone.now()
            task.save()
            
            if queue:
                queue.status = 'processing'
                queue.started_at = timezone.now()
                queue.save()
            
            # Generate emails
            result = generate_emails_for_recipients(
                recipient_ids=recipient_ids,
                selected_category=selected_category,
                task=task,
                queue=queue
            )
            
            # IMPORTANT: Mark as READY for sending
            GeneratedEmail.objects.filter(
                recipient_id__in=recipient_ids,
                status='generated'  # only freshly generated ones
            ).update(status='ready')
            
            # Update task with success
            task.status = 'SUCCESS'
            task.result = result
            task.completed_at = timezone.now()
            task.save()
            
            if queue:
                queue.status = 'completed'
                queue.completed_at = timezone.now()
                queue.processed_emails = result.get('generated', 0)
                queue.failed_emails = len(result.get('errors', {}))
                queue.save()
            
            print(f"[TASK:{task_id}] Completed successfully - {result.get('generated', 0)} emails marked READY")
            
        except Exception as e:
            print(f"[TASK:{task_id}] Error: {e}")
            try:
                task = EmailGenerationTask.objects.get(task_id=task_id)
                task.status = 'FAILURE'
                task.error_message = str(e)
                task.completed_at = timezone.now()
                task.save()
                
                if task.queue:
                    task.queue.status = 'failed'
                    task.queue.completed_at = timezone.now()
                    task.queue.save()
            except:
                pass

            
# ============================================================
# TASK STATUS
# ============================================================
class TaskStatusView(APIView):
    def get(self, request, task_id):
        try:
            # Try to get from our database first
            task = EmailGenerationTask.objects.get(task_id=task_id)
            serializer = EmailGenerationTaskSerializer(task)
            
            # If task is still pending, check Celery for more details
            if task.status in ['PENDING', 'PROGRESS']:
                celery_result = AsyncResult(task_id)
                
                if celery_result.state == 'PROGRESS' and celery_result.info:
                    # Update progress info
                    task.progress_info = celery_result.info
                    task.save()
                    
            return Response(serializer.data)
            
        except EmailGenerationTask.DoesNotExist:
            # Fallback to Celery directly
            celery_result = AsyncResult(task_id)
            
            if celery_result.pending:
                return Response({
                    "task_id": task_id,
                    "status": "PENDING",
                    "state": "PENDING",
                    "progress_info": {"status": "En attente..."}
                })
            elif celery_result.failed():
                return Response({
                    "task_id": task_id,
                    "status": "FAILURE",
                    "state": "FAILURE",
                    "error": str(celery_result.info)
                })
            elif celery_result.successful():
                return Response({
                    "task_id": task_id,
                    "status": "SUCCESS",
                    "state": "SUCCESS",
                    "result": celery_result.result
                })
            else:
                return Response({
                    "task_id": task_id,
                    "status": celery_result.state,
                    "state": celery_result.state,
                    "progress_info": celery_result.info
                })


# ============================================================
# TASK LIST
# ============================================================
class TaskListView(APIView):
    def get(self, request):
        tasks = EmailGenerationTask.objects.all().order_by('-created_at')[:20]
        serializer = EmailGenerationTaskSerializer(tasks, many=True)
        return Response(serializer.data)


# ============================================================
# CANCEL TASK
# ============================================================
class CancelTaskView(APIView):
    def post(self, request, task_id):
        try:
            task = EmailGenerationTask.objects.get(task_id=task_id)
            
            # Cancel Celery task
            celery_result = AsyncResult(task_id)
            celery_result.revoke(terminate=True)
            
            # Update task status
            task.status = 'CANCELLED'
            task.save()
            
            return Response({"success": True, "message": "Tâche annulée"})
            
        except EmailGenerationTask.DoesNotExist:
            return Response(
                {"success": False, "error": "Tâche introuvable"}, 
                status=404
            )
            
            
            
from .models import EmailCategory
from .serializers import EmailCategorySerializer
    
class CategoryListView(APIView):
    """
    GET /api/email-generation/categories/
    List all email categories
    """
    def get(self, request):
        categories = EmailCategory.objects.all().order_by('name')
        serializer = EmailCategorySerializer(categories, many=True)
        return Response(serializer.data)
            
            
            
            
            
            
            
            
            
            
# ============================================================
# DASHBOARD
# ============================================================
       
# Add these imports to your existing imports
from .models import EmailGenerationTask, EmailGenerationQueue, EmailSendingQueue, DailyStats
from .services import (
    generate_emails_for_recipients, 
    create_generation_queue, 
    get_queue_status, 
    get_dashboard_stats
)
import threading
import uuid
import json
from datetime import datetime, timedelta
from django.utils import timezone


# ============================================================
# DASHBOARD STATS VIEW
# ============================================================
class DashboardStatsView(APIView):
    """
    Get comprehensive dashboard statistics
    """
    def get(self, request):
        try:
            stats = get_dashboard_stats()
            return Response(stats)
        except Exception as e:
            print(f"[DASHBOARD ERROR] {e}")
            return Response(
                {"success": False, "error": str(e)},
                status=500
            )


# ============================================================
# GENERATION QUEUE VIEW
# ============================================================
class GenerationQueueView(APIView):
    """
    View all emails in generation queue
    """
    def get(self, request):
        try:
            # Get queue statistics
            pending_emails = GeneratedEmail.objects.filter(
                status='pending_generation'
            ).select_related('recipient').order_by('created_at')[:50]
            
            generating_emails = GeneratedEmail.objects.filter(
                status='generating'
            ).select_related('recipient').order_by('-updated_at')[:20]
            
            total_in_queue = GeneratedEmail.objects.filter(
                status__in=['pending_generation', 'generating']
            ).count()
            
            # Format the response
            data = {
                'pending': [
                    {
                        'id': email.id,
                        'recipient': email.recipient.name if email.recipient else 'Inconnu',
                        'email': email.recipient.email if email.recipient else '',
                        'category': email.category_name or 'Général',
                        'queued_at': email.created_at,
                        'queue_position': i + 1,
                        'status': email.status,
                    } for i, email in enumerate(pending_emails)
                ],
                'generating': [
                    {
                        'id': email.id,
                        'recipient': email.recipient.name if email.recipient else 'Inconnu',
                        'email': email.recipient.email if email.recipient else '',
                        'category': email.category_name or 'Général',
                        'started_at': email.updated_at,
                        'status': email.status,
                    } for email in generating_emails
                ],
                'stats': {
                    'total_in_queue': total_in_queue,
                    'pending_count': pending_emails.count(),
                    'generating_count': generating_emails.count(),
                    'estimated_time': self._estimate_queue_time(pending_emails.count()),
                }
            }
            
            return Response(data)
            
        except Exception as e:
            print(f"[QUEUE ERROR] {e}")
            return Response({
                'pending': [],
                'generating': [],
                'stats': {
                    'total_in_queue': 0,
                    'pending_count': 0,
                    'generating_count': 0,
                    'estimated_time': '0 secondes',
                }
            })
    
    def _estimate_queue_time(self, queue_size):
        seconds = queue_size * 2
        if seconds < 60:
            return f"{seconds} secondes"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''}"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours}h {minutes}min"
        
# ============================================================
# SENDING QUEUE VIEW
# ============================================================
class SendingQueueView(APIView):
    """
    View all emails in sending queue
    """
    def get(self, request):
        try:
            # Get emails ready to send
            ready_emails = GeneratedEmail.objects.filter(
                status='ready'
            ).select_related('recipient').order_by('generated_at')[:50]
            
            # Get emails currently sending
            sending_emails = GeneratedEmail.objects.filter(
                status='sending'
            ).select_related('recipient').order_by('-updated_at')[:20]
            
            # Get active sending campaigns
            active_campaigns = EmailSendingQueue.objects.filter(
                status__in=['pending', 'processing']
            ).order_by('-created_at')[:5]
            
            data = {
                'ready_to_send': [
                    {
                        'id': email.id,
                        'recipient': email.recipient.name if email.recipient else 'Unknown',
                        'email': email.recipient.email if email.recipient else '',
                        'subject': email.subject[:50] if email.subject else '',
                        'category': email.category_name,
                        'generated_at': email.generated_at,
                        'status': email.status,
                    } for email in ready_emails
                ],
                'sending': [
                    {
                        'id': email.id,
                        'recipient': email.recipient.name if email.recipient else 'Unknown',
                        'email': email.recipient.email if email.recipient else '',
                        'subject': email.subject[:50] if email.subject else '',
                        'category': email.category_name,
                        'started_at': email.updated_at,
                        'status': email.status,
                    } for email in sending_emails
                ],
                'active_campaigns': [
                    {
                        'id': campaign.id,
                        'name': campaign.name,
                        'total': campaign.total_emails,
                        'sent': campaign.sent_emails,
                        'progress': campaign.progress_percentage,
                        'status': campaign.status,
                        'scheduled_at': campaign.scheduled_at,
                    } for campaign in active_campaigns
                ],
                'stats': {
                    'total_ready': ready_emails.count(),
                    'total_sending': sending_emails.count(),
                    'estimated_time': f"{ready_emails.count() * 1} secondes",
                }
            }
            
            return Response(data)
            
        except Exception as e:
            print(f"[SENDING QUEUE ERROR] {e}")
            return Response(
                {"success": False, "error": str(e)},
                status=500
            )


# ============================================================
# EMAIL STATUS VIEW
# ============================================================
class EmailStatusView(APIView):
    """
    Get status of a specific email or list of emails with filters
    """
    def get(self, request, email_id=None):
        try:
            if email_id:
                # Get single email
                return self._get_single_email(email_id)
            else:
                # Get list of emails with filters
                return self._get_email_list(request)
                
        except Exception as e:
            print(f"[EMAIL STATUS ERROR] {e}")
            return Response(
                {"success": False, "error": str(e)},
                status=500
            )
    
    def _get_single_email(self, email_id):
        """Get detailed status for a single email"""
        try:
            email = GeneratedEmail.objects.select_related(
                'recipient', 'template'
            ).get(id=email_id)
            
            # Get queue info if available
            queue_info = None
            if email.metadata and 'queue_id' in email.metadata:
                try:
                    queue = EmailGenerationQueue.objects.get(id=email.metadata['queue_id'])
                    queue_info = {
                        'queue_id': queue.id,
                        'queue_name': queue.name,
                        'queue_status': queue.status,
                    }
                except EmailGenerationQueue.DoesNotExist:
                    pass
            
            return Response({
                'id': email.id,
                'recipient': {
                    'id': email.recipient.id if email.recipient else None,
                    'name': email.recipient.name if email.recipient else 'Unknown',
                    'email': email.recipient.email if email.recipient else '',
                    'company': email.recipient.company_name if email.recipient else '',
                },
                'category': email.category_name,
                'status': email.status,
                'status_display': self._get_status_display_french(email.status),
                'subject': email.subject,
                'body_preview': email.body_html[:200] + '...' if email.body_html else '',
                'generated_at': email.generated_at,
                'sent_at': email.sent_at,
                'created_at': email.created_at,
                'updated_at': email.updated_at,
                'error': email.error_message,
                'retry_count': email.retry_count,
                'queue_info': queue_info,
                'metadata': email.metadata,
            })
            
        except GeneratedEmail.DoesNotExist:
            return Response(
                {"error": "Email not found"},
                status=404
            )
    
    def _get_email_list(self, request):
        """Get list of emails with filters"""
        # Get filter parameters
        status_filter = request.query_params.get('status')
        category_filter = request.query_params.get('category')
        date_filter = request.query_params.get('date')
        search = request.query_params.get('search', '')
        
        # Base queryset
        queryset = GeneratedEmail.objects.select_related('recipient')
        
        # Apply filters
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if category_filter:
            queryset = queryset.filter(category_name=category_filter)
        if date_filter:
            queryset = queryset.filter(created_at__date=date_filter)
        if search:
            queryset = queryset.filter(
                Q(recipient__name__icontains=search) |
                Q(recipient__email__icontains=search) |
                Q(subject__icontains=search)
            )
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        start = (page - 1) * page_size
        end = start + page_size
        
        total = queryset.count()
        emails = queryset.order_by('-created_at')[start:end]
        
        # Get status counts for filters
        status_counts = {}
        for status in ['pending_generation', 'generating', 'generated', 'ready', 'sending', 'sent', 'failed_generation', 'failed_sending']:
            status_counts[status] = GeneratedEmail.objects.filter(status=status).count()
        
        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
            'status_counts': status_counts,
            'results': [
                {
                    'id': e.id,
                    'recipient_name': e.recipient.name if e.recipient else 'Unknown',
                    'recipient_email': e.recipient.email if e.recipient else '',
                    'category': e.category_name,
                    'status': e.status,
                    'status_display': self._get_status_display_french(e.status),
                    'subject': e.subject[:100] if e.subject else '',
                    'generated_at': e.generated_at,
                    'sent_at': e.sent_at,
                    'created_at': e.created_at,
                    'error': e.error_message[:100] if e.error_message else None,
                } for e in emails
            ]
        })
    
    def _get_status_display_french(self, status):
        """Convert status code to French display text"""
        status_map = {
            'pending_generation': 'En attente de génération',
            'generating': 'Génération en cours',
            'generated': 'Généré',
            'ready': 'Prêt à envoyer',
            'sending': 'Envoi en cours',
            'sent': 'Envoyé',
            'failed_generation': 'Échec génération',
            'failed_sending': 'Échec envoi',
            'cancelled': 'Annulé',
        }
        return status_map.get(status, status)


# ============================================================
# TASK MANAGEMENT VIEWS (If you don't have these)
# ============================================================

class TaskStatusView(APIView):
    """
    Get status of a generation task
    """
    def get(self, request, task_id):
        try:
            task = EmailGenerationTask.objects.get(task_id=task_id)
            
            # Get queue info if exists
            queue_info = None
            if task.queue:
                queue_info = {
                    'id': task.queue.id,
                    'name': task.queue.name,
                    'status': task.queue.status,
                    'progress': task.queue.progress_percentage,
                }
            
            return Response({
                'task_id': task.task_id,
                'status': task.status,
                'state': task.status,
                'progress_info': task.progress_info,
                'result': task.result,
                'error': task.error_message,
                'created_at': task.created_at,
                'started_at': task.started_at,
                'completed_at': task.completed_at,
                'queue': queue_info,
                'progress_percentage': task.progress_percentage,
            })
            
        except EmailGenerationTask.DoesNotExist:
            return Response(
                {"error": "Task not found"},
                status=404
            )


class TaskListView(APIView):
    """
    List recent generation tasks
    """
    def get(self, request):
        tasks = EmailGenerationTask.objects.all().order_by('-created_at')[:20]
        
        return Response([
            {
                'task_id': t.task_id,
                'status': t.status,
                'total_recipients': t.total_recipients,
                'total_categories': t.total_categories,
                'created_at': t.created_at,
                'started_at': t.started_at,
                'completed_at': t.completed_at,
                'progress_percentage': t.progress_percentage,
                'generated': t.result.get('generated', 0) if t.result else 0,
            } for t in tasks
        ])


class CancelTaskView(APIView):
    """
    Cancel a generation task
    """
    def post(self, request, task_id):
        try:
            task = EmailGenerationTask.objects.get(task_id=task_id)
            
            # Update task status
            task.status = 'CANCELLED'
            task.save()
            
            # Update queue if exists
            if task.queue:
                task.queue.status = 'cancelled'
                task.queue.completed_at = timezone.now()
                task.queue.save()
            
            # Update pending emails
            if task.recipient_ids:
                recipient_ids = json.loads(task.recipient_ids) if isinstance(task.recipient_ids, str) else task.recipient_ids
                GeneratedEmail.objects.filter(
                    recipient_id__in=recipient_ids,
                    status='pending_generation'
                ).update(status='cancelled')
            
            return Response({
                "success": True,
                "message": "Tâche annulée avec succès"
            })
            
        except EmailGenerationTask.DoesNotExist:
            return Response(
                {"success": False, "error": "Tâche introuvable"},
                status=404
            )
            
