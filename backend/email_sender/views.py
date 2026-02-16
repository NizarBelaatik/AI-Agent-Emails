# email_sender/views.py

import uuid
import threading
import logging
from datetime import datetime

from django.utils import timezone
from django.db.models import Q, F
from django.db import transaction
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from email_generation.models import GeneratedEmail
from .models import SentEmail, SendingBatch 
from email_generation.models import EmailSendingQueue
from .serializers import GeneratedEmailSerializer, EmailSendingQueueSerializer

from .services import send_emails_batch  # ← ADD THIS LINE

logger = logging.getLogger(__name__)


class CustomPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


# ────────────────────────────────────────────────
# 1. List emails ready / pending to be sent
# ────────────────────────────────────────────────
class ReadyEmailsListView(APIView):
    """
    GET /email-sender/emails/ready/
    List emails in 'ready' or 'generated' status with optional filters + pagination
    """
    def get(self, request):
        queryset = GeneratedEmail.objects.filter(
            status__in=['generated', 'ready']
        ).select_related('recipient').order_by('-generated_at')
        # Filters
        search = request.query_params.get('search', '').strip()
        category = request.query_params.get('category', '')

        if search:
            queryset = queryset.filter(
                Q(recipient__name__icontains=search) |
                Q(recipient__email__icontains=search) |
                Q(subject__icontains=search)
            )

        if category:
            queryset = queryset.filter(category_name=category)

        # Pagination
        paginator = CustomPagination()
        page = paginator.paginate_queryset(queryset, request)

        # Use serializer (much better than manual dicts)
        serializer = GeneratedEmailSerializer(page, many=True)

        return paginator.get_paginated_response(serializer.data)
    

# ────────────────────────────────────────────────
# 2. Start sending batch (main endpoint)
# ────────────────────────────────────────────────
class SendBatchView(APIView):
    """
    POST /api/email-sender/send-batch/
    Lance l'envoi des emails sélectionnés en arrière-plan
    """
    def post(self, request):
        data = request.data
        logger.info(f"[SEND-BATCH] Payload reçu : {data}")

        email_ids = data.get('email_ids', [])
        send_speed_raw = data.get('send_speed')
        use_time_window = data.get('use_time_window', False)
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        batch_name = data.get('batch_name') or f"Envoi {timezone.now():%Y-%m-%d %H:%M}"

        if not email_ids or not isinstance(email_ids, list):
            logger.warning("email_ids invalide ou vide")
            return Response({"success": False, "error": "Aucun email sélectionné"}, status=400)

        try:
            send_speed = int(send_speed_raw) if send_speed_raw is not None else 3600
        except (ValueError, TypeError):
            logger.warning(f"send_speed invalide: {send_speed_raw}")
            return Response({"success": False, "error": "Vitesse d'envoi invalide"}, status=400)

        if use_time_window:
            if not start_time or not end_time:
                return Response({"success": False, "error": "Heures début/fin requises"}, status=400)
            try:
                datetime.strptime(start_time, "%H:%M")
                datetime.strptime(end_time, "%H:%M")
            except ValueError:
                return Response({"success": False, "error": "Format heure invalide (HH:MM)"}, status=400)

        # FIX PRINCIPAL : Récupérer les emails READY AVANT de modifier quoi que ce soit
        ready_emails = GeneratedEmail.objects.filter(
            id__in=email_ids,
            status='ready'
        ).select_related('recipient')

        count = ready_emails.count()
        if count == 0:
            logger.warning(f"Aucun email 'ready' parmi {len(email_ids)} IDs sélectionnés")
            return Response({"success": False, "error": "Aucun email prêt à envoyer"}, status=400)

        # CAPTURER LES IDs MAINTENANT (pendant qu'ils sont encore 'ready')
        email_ids_to_send = list(ready_emails.values_list('id', flat=True))
        logger.info(f"[SEND-BATCH] {count} emails prêts trouvés → IDs envoyés au thread : {email_ids_to_send}")

        task_id = str(uuid.uuid4())

        queue = EmailSendingQueue.objects.create(
            task_id=task_id,
            name=batch_name,
            total_emails=count,
            status='pending',
            scheduled_at=timezone.now(),
        )

        # MARQUER 'sending' SEULEMENT APRÈS avoir capturé les IDs
        ready_emails.update(
            status='sending',
            sending_task_id=task_id,
            updated_at=timezone.now()
        )

        # Lancer le thread avec les IDs déjà capturés
        logger.info(f"IDs FINALS passés au thread : {email_ids_to_send}")
        thread = threading.Thread(
            target=send_emails_batch,
            args=(email_ids_to_send, send_speed, use_time_window, start_time, end_time, queue),
            daemon=True
        )
        thread.start()

        return Response({
            "success": True,
            "batch_id": task_id,
            "queue_id": queue.id,
            "total": count,
            "message": f"Envoi démarré pour {count} emails"
        }, status=status.HTTP_202_ACCEPTED)
        
        

# ────────────────────────────────────────────────
# 3. Batch status (polling endpoint)
# ────────────────────────────────────────────────
class BatchStatusView(APIView):
    """
    GET /email-sender/batches/<task_id>/
    """
    def get(self, request, batch_id):  # batch_id = task_id (uuid string)
        try:
            queue = EmailSendingQueue.objects.get(task_id=batch_id)
            serializer = EmailSendingQueueSerializer(queue)
            return Response({
                "success": True,
                "batch": serializer.data
            })
        except EmailSendingQueue.DoesNotExist:
            return Response({"success": False, "error": "Batch non trouvé"}, status=404)


# ────────────────────────────────────────────────
# 4. Recent batches list
# ────────────────────────────────────────────────
class BatchListView(APIView):
    """
    GET /email-sender/batches/?limit=10
    """
    def get(self, request):
        limit = int(request.query_params.get('limit', 10))
        queues = EmailSendingQueue.objects.order_by('-created_at')[:limit]
        serializer = EmailSendingQueueSerializer(queues, many=True)
        return Response({
            "success": True,
            "batches": serializer.data
        })

# ────────────────────────────────────────────────
# 5. Cancel batch
# ────────────────────────────────────────────────
class BatchCancelView(APIView):
    """
    POST /email-sender/batches/<task_id>/cancel/
    """
    def post(self, request, batch_id):
        try:
            queue = EmailSendingQueue.objects.get(task_id=batch_id)

            if queue.status not in ['pending', 'processing']:
                return Response({"success": False, "error": "Impossible d'annuler un batch terminé ou déjà annulé"}, status=400)

            queue.status = 'cancelled'
            queue.completed_at = timezone.now()
            queue.save()

            GeneratedEmail.objects.filter(
                sending_task_id=batch_id,
                status='sending'
            ).update(status='ready', sending_task_id=None, updated_at=timezone.now())
            
            
            return Response({"success": True, "message": "Batch annulé avec succès"})
        except EmailSendingQueue.DoesNotExist:
            return Response({"success": False, "error": "Batch non trouvé"}, status=404)


# ────────────────────────────────────────────────
# 6. Retry failed in batch
# ────────────────────────────────────────────────
class BatchRetryFailedView(APIView):
    """
    POST /email-sender/batches/<task_id>/retry-failed/
    """
    def post(self, request, batch_id):
        try:
            queue = EmailSendingQueue.objects.get(task_id=batch_id)

            failed = GeneratedEmail.objects.filter(
                sending_task_id=batch_id,
                status='failed_sending'
            )

            count = failed.count()
            if count == 0:
                return Response({"success": False, "message": "Aucun échec à relancer"})

            failed.update(
                status='sending',
                error_message=None,
                retry_count=F('retry_count') + 1,
                updated_at=timezone.now()
            )

            email_ids = list(failed.values_list('id', flat=True))

            thread = threading.Thread(
                target=send_emails_batch,
                args=(email_ids, 1800, False, None, None, queue),  # slower speed for retry
                daemon=True
            )
            thread.start()

            return Response({"success": True, "message": f"{count} emails relancés"})
        except EmailSendingQueue.DoesNotExist:
            return Response({"success": False, "error": "Batch non trouvé"}, status=404)


# ────────────────────────────────────────────────
# 7. Sending dashboard stats
# ────────────────────────────────────────────────
class SendingDashboardStatsView(APIView):
    """
    GET /email-sender/dashboard/stats/
    """
    def get(self, request):
        today = timezone.now().date()

        stats = {
            "ready_to_send": GeneratedEmail.objects.filter(status='ready').count(),
            "sending_now": GeneratedEmail.objects.filter(status='sending').count(),
            "sent_today": GeneratedEmail.objects.filter(status='sent', sent_at__date=today).count(),
            "failed_today": GeneratedEmail.objects.filter(status='failed_sending', updated_at__date=today).count(),
            "active_batches": EmailSendingQueue.objects.filter(status__in=['pending', 'processing']).count(),
        }
        return Response({"success": True, "stats": stats})


# ────────────────────────────────────────────────
# 8. Single email sending status (optional)
# ────────────────────────────────────────────────
class EmailSendingStatusView(APIView):
    """
    GET /email-sender/emails/<int:email_id>/status/
    """
    def get(self, request, email_id):
        try:
            email = GeneratedEmail.objects.select_related('recipient').get(id=email_id)
            serializer = GeneratedEmailSerializer(email)
            return Response({
                "success": True,
                "email": serializer.data
            })
        except GeneratedEmail.DoesNotExist:
            return Response({"success": False, "error": "Email non trouvé"}, status=404)
        


