# email_sender/services.py
import requests
import json
import time
import logging
from datetime import datetime
from django.conf import settings
from django.utils import timezone

from email_generation.models import GeneratedEmail, EmailSendingQueue

logger = logging.getLogger(__name__)

TURBO_API_URL = "https://api.turbo-smtp.com/api/v2/mail/send"


# Update the send_via_turbosmtp_api function with better debugging

def send_via_turbosmtp_api(email_obj: GeneratedEmail, max_retries: int = 2) -> tuple[bool, str | None]:
    """
    Envoie un email via l'API REST TurboSMTP v2
    """
    if not all([settings.TURBOSMTP_CONSUMER_KEY, settings.TURBOSMTP_CONSUMER_SECRET]):
        logger.error("[TURBO] Clés TurboSMTP manquantes (authuser/authpass)")
        return False, "Clés TurboSMTP manquantes dans les settings"

    payload = {
        "authuser": settings.TURBOSMTP_CONSUMER_KEY,
        "authpass": settings.TURBOSMTP_CONSUMER_SECRET,
        "from": settings.DEFAULT_FROM_EMAIL,
        "from_name": settings.DEFAULT_FROM_NAME or "BMM",
        "to": email_obj.recipient.email,
        "subject": email_obj.subject or "(Sans objet)",
        "html_content": email_obj.body_html or "<p>Contenu vide</p>",
        "text_content": email_obj.body_text or "Contenu texte vide",
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    # Log the authuser (first few chars only for security)
    auth_user_prefix = settings.TURBOSMTP_CONSUMER_KEY[:8] if settings.TURBOSMTP_CONSUMER_KEY else "None"
    logger.info(f"[TURBO] Attempting to send with authuser starting with: {auth_user_prefix}...")
    logger.info(f"[TURBO] To email: {email_obj.recipient.email}")

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                TURBO_API_URL,
                data=json.dumps(payload),
                headers=headers,
                timeout=15
            )

            # Log full response for debugging
            logger.info(f"[TURBO] Response status: {response.status_code}")
            logger.info(f"[TURBO] Response body: {response.text[:500]}")

            if response.status_code in (200, 202):
                data = response.json()
                email_obj.turbo_message_id = data.get("message_id", "")
                email_obj.turbo_api_response = data
                email_obj.save(update_fields=['turbo_message_id', 'turbo_api_response'])
                logger.info(f"Email envoyé avec succès à {email_obj.recipient.email} - Message ID: {email_obj.turbo_message_id}")
                return True, None

            err = response.text[:400]
            logger.warning(f"TurboSMTP erreur (tentative {attempt}): {response.status_code} - {err}")

            # Special handling for account inactive error
            if response.status_code == 401:
                error_data = response.json()
                if error_data.get("error") == 3 and "inactive" in error_data.get("message", ""):
                    logger.error("🚨 TurboSMTP ACCOUNT IS INACTIVE! Check your account status in TurboSMTP dashboard.")
                    return False, "Compte TurboSMTP inactif - Veuillez vérifier votre compte sur TurboSMTP"

            if attempt < max_retries and response.status_code in (429, 500, 502, 503, 504):
                time.sleep(3 * attempt)
                continue

            return False, f"HTTP {response.status_code} — {err}"

        except requests.RequestException as e:
            logger.error(f"Erreur réseau TurboSMTP (tentative {attempt}): {e}", exc_info=True)
            if attempt < max_retries:
                time.sleep(3 * attempt)
                continue
            return False, str(e)

    return False, f"Échec après {max_retries} tentatives"



def send_emails_batch(
    email_ids: list[int],
    send_speed: int = 3600,           # emails par heure (0 = illimité)
    use_time_window: bool = False,
    start_time_str: str | None = None,
    end_time_str: str | None = None,
    queue: EmailSendingQueue = None
):
    """
    Fonction background pour envoyer un batch d'emails.
    Met à jour GeneratedEmail + EmailSendingQueue.
    """
    logger.info(f"[SEND BATCH START] {len(email_ids)} IDs reçus : {email_ids}")
    
    if not email_ids:
        logger.warning("Batch vide - rien à envoyer")
        if queue:
            queue.status = 'completed'
            queue.completed_at = timezone.now()
            queue.save()
        return

    sent = 0
    failed = 0
    total = len(email_ids)

    if queue:
        queue.status = 'processing'
        queue.started_at = timezone.now()
        queue.save(update_fields=['status', 'started_at'])

    start_time = None
    end_time = None
    if use_time_window and start_time_str and end_time_str:
        try:
            start_time = datetime.strptime(start_time_str, "%H:%M").time()
            end_time = datetime.strptime(end_time_str, "%H:%M").time()
        except ValueError:
            logger.error("Format heure invalide dans la fenêtre")
            start_time = end_time = None

    for idx, email_id in enumerate(email_ids, 1):
        try:
            email = GeneratedEmail.objects.select_related('recipient').get(id=email_id)
            if not email:
                logger.error(f"[SEND] Email ID {email_id} n'existe plus dans la base")
                failed += 1
                continue

            logger.info(f"[SEND] Traitement ID {email_id} - Statut: {email.status}")

            if email.status not in ['ready', 'sending']:#!= 'ready':
                logger.warning(f"[SEND] Email ID {email_id} non prêt (statut: {email.status})")
                failed += 1
                continue
            
            # Respecter la fenêtre horaire
            if start_time and end_time:
                while True:
                    now = timezone.localtime().time()
                    if start_time <= now <= end_time:
                        break
                    time.sleep(30)

            success, error_msg = send_via_turbosmtp_api(email)

            if success:
                email.status = 'sent'
                email.sent_at = timezone.now()
                email.save(update_fields=['status', 'sent_at'])
                sent += 1
            else:
                email.status = 'failed_sending'
                email.error_message = error_msg
                email.retry_count += 1
                email.save(update_fields=['status', 'error_message', 'retry_count'])
                failed += 1

            # Update queue tous les 10 ou à la fin
            if queue and (idx % 10 == 0 or idx == total):
                queue.sent_emails = sent
                queue.failed_emails = failed
                queue.save(update_fields=['sent_emails', 'failed_emails'])

            # Rate limiting
            if send_speed > 0:
                delay_sec = 3600.0 / send_speed
                time.sleep(delay_sec)

        except GeneratedEmail.DoesNotExist:
            failed += 1
            logger.warning(f"Email ID {email_id} introuvable")
        except Exception as e:
            failed += 1
            logger.exception(f"Erreur critique email ID {email_id}")

    if queue:
        queue.status = 'completed' if failed == 0 else 'failed' if sent == 0 else 'completed_with_errors'
        queue.completed_at = timezone.now()
        queue.save(update_fields=['status', 'completed_at'])

    logger.info(f"Batch terminé - {sent}/{total} envoyés, {failed} échoués")
    
    
    


def send_via_turbosmtp_api_0(email_obj: GeneratedEmail, max_retries: int = 2) -> tuple[bool, str | None]:
    """
    Envoie un email via l'API REST TurboSMTP v2
    """
    if not all([settings.TURBOSMTP_CONSUMER_KEY, settings.TURBOSMTP_CONSUMER_SECRET]):
        logger.error("[TURBO] Clés TurboSMTP manquantes (authuser/authpass)")
        return False, "Clés TurboSMTP manquantes dans les settings"

    # Check if the fields exist before trying to save them
    model_fields = [field.name for field in email_obj._meta.fields]
    has_turbo_fields = 'turbo_message_id' in model_fields and 'turbo_api_response' in model_fields
    
    if not has_turbo_fields:
        logger.warning("[TURBO] Les champs turbo_message_id/turbo_api_response n'existent pas dans le modèle")

    payload = {
        "authuser": settings.TURBOSMTP_CONSUMER_KEY,
        "authpass": settings.TURBOSMTP_CONSUMER_SECRET,
        "from": settings.DEFAULT_FROM_EMAIL,
        "from_name": settings.DEFAULT_FROM_NAME or "BMM",
        "to": email_obj.recipient.email,
        "subject": email_obj.subject or "(Sans objet)",
        "html_content": email_obj.body_html or "<p>Contenu vide</p>",
        "text_content": email_obj.body_text or "Contenu texte vide",
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    auth_user_prefix = settings.TURBOSMTP_CONSUMER_KEY[:8] if settings.TURBOSMTP_CONSUMER_KEY else "None"
    logger.info(f"[TURBO] Attempting to send with authuser starting with: {auth_user_prefix}...")
    logger.info(f"[TURBO] To email: {email_obj.recipient.email}")

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                TURBO_API_URL,
                data=json.dumps(payload),
                headers=headers,
                timeout=15
            )

            logger.info(f"[TURBO] Response status: {response.status_code}")
            logger.info(f"[TURBO] Response body: {response.text[:500]}")

            if response.status_code in (200, 202):
                data = response.json()
                
                # Only save turbo fields if they exist
                if has_turbo_fields:
                    email_obj.turbo_message_id = data.get("message_id", "")
                    email_obj.turbo_api_response = data
                    email_obj.save(update_fields=['turbo_message_id', 'turbo_api_response'])
                else:
                    # Just save the email without turbo fields
                    email_obj.save()
                
                logger.info(f"Email envoyé avec succès à {email_obj.recipient.email} - Message ID: {data.get('message_id', 'N/A')}")
                return True, None

            err = response.text[:400]
            logger.warning(f"TurboSMTP erreur (tentative {attempt}): {response.status_code} - {err}")

            if response.status_code == 401:
                error_data = response.json()
                if error_data.get("error") == 3 and "inactive" in error_data.get("message", ""):
                    logger.error("🚨 TurboSMTP ACCOUNT IS INACTIVE! Check your account status in TurboSMTP dashboard.")
                    return False, "Compte TurboSMTP inactif - Veuillez vérifier votre compte sur TurboSMTP"

            if attempt < max_retries and response.status_code in (429, 500, 502, 503, 504):
                time.sleep(3 * attempt)
                continue

            return False, f"HTTP {response.status_code} — {err}"

        except requests.RequestException as e:
            logger.error(f"Erreur réseau TurboSMTP (tentative {attempt}): {e}", exc_info=True)
            if attempt < max_retries:
                time.sleep(3 * attempt)
                continue
            return False, str(e)

    return False, f"Échec après {max_retries} tentatives"