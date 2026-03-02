# services.py
import ollama
import jinja2
import json
import re
import time
from datetime import datetime
from django.utils import timezone
from django.conf import settings
from django.db import transaction, IntegrityError
from django.db.models import Q, Count

from .models import (EmailTemplate, 
                     GeneratedEmail, 
                     EmailGenerationQueue, 
                     EmailGenerationTask)

from data_importer.models import Recipient


# ============================================================
# TEMPLATE GENERATION
# ============================================================

def get_or_generate_template(category_name: str, force=False):
    """
    Récupère un template existant ou en génère un nouveau via Ollama.
    """
    # Clean the category name
    category_name = category_name.strip() if category_name else "Général"
    
    print(f"[TEMPLATE] Looking for template with category: '{category_name}'")
    
    template = EmailTemplate.objects.filter(category_name=category_name).first()

    if template and not force:
        print(f"[TEMPLATE] Found existing template for '{category_name}'")
        return template
    
    print(f"[TEMPLATE] No template found for '{category_name}', generating...")

    prompt2 = f"""
Tu es un expert copywriter B2B au Maroc.

Catégorie d'activité : {category_name}

Génère un template email professionnel en français spécifique pour cette catégorie.

**RÈGLE STRICTE** : utilise UNIQUEMENT des accolades simples comme ceci : 
{{ recipient.name }}, {{ recipient.company_name }}, {{ recipient.city }}

Variables disponibles :
{{ recipient.name }}
{{ recipient.company_name }}
{{ recipient.city }}
{{ recipient.x_activitec }}

Réponds UNIQUEMENT en JSON valide :
{{
  "subject": "Sujet avec {{ recipient.name }} pour {category_name}",
  "body": "<p>Corps en HTML avec {{ recipient.name }} et {{ recipient.city }} - Spécialiste {category_name}</p>"
}}
"""


    prompt = f"""
Tu es un expert en copywriting B2B sur le marché marocain, travaillant pour BMM (Business Meeting Maroc).
Ta mission est de rédiger un email de prospection (cold email) court et percutant.

**L'Offre de BMM :**
BMM est le spécialiste de la prospection et de la génération d'opportunités d'affaires. Nous aidons les entreprises à remplacer le hasard commercial par une machine à revenus prédictible en leur fournissant des rendez-vous B2B ultra-qualifiés.

**Contexte de la cible :**
Tu t'adresses à un décideur dans le secteur : {category_name}.
Activité spécifique ou sous-secteur : {{ recipient.x_activitec }}
Ville : {{ recipient.city }}

**Structure obligatoire de l'email (Méthode BMM) :**
1. L'accroche : Brise la glace de manière hyper-personnalisée pour son secteur ({category_name}).
2. Le problème : Soulève le défi de trouver des clients qualifiés ou de stabiliser les revenus dans son domaine. Utilise "vous" et "vos enjeux", JAMAIS "je", "nous" ou "notre" dans cette partie.
3. La solution : Présente BMM subtilement comme la solution pour automatiser sa prospection et obtenir des rendez-vous sans effort.
4. Le Call to Action (CTA) "Low Friction" : Propose UNIQUEMENT un échange rapide de 10 à 15 minutes. Ne vends rien d'autre.

**RÈGLES STRICTES DE FORMATAGE :**
- Ton email doit être chaleureux, direct, et professionnel.
- Tu DOIS utiliser ces variables exactes, avec des doubles accolades simples : 
  {{ recipient.name }} (Nom du contact)
  {{ recipient.company_name }} (Nom de son entreprise)
  {{ recipient.city }} (Ville)
  {{ recipient.x_activitec }} (Activité)
- Le corps de l'email doit être en HTML simple (utilise uniquement <p>, <br>, et <strong>).

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, et sans blocs de code markdown. Format exact :
{{
  "subject": "Le sujet court et intrigant ici",
  "body": "<p>Bonjour {{ recipient.name }},</p><p>Le contenu ici...</p>"
}}
"""


    print(f"[OLLAMA] Generating template for: '{category_name}'")

    try:
        response = ollama.chat(
            model=settings.OLLAMA_MODEL_NAME or "phi3:mini",
            messages=[{'role': 'user', 'content': prompt}],
            format="json",
        )
        
        raw_content = response['message']['content']
        # Strip markdown formatting if the model disobeys
        clean_content = raw_content.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_content)
        #data = json.loads(response['message']['content'])
        print(f"[OLLAMA] Successfully generated template for '{category_name}'")
    except Exception as e:
        print(f"[OLLAMA ERROR] {e}")
        # Fallback template
        data = {
            "subject": f"Bonjour {{{{ recipient.name }}}},",
            "body": f"<p>Message personnalisé pour {{{{ recipient.name }}}} à {{{{ recipient.city }}}} - {category_name}</p>"
        }

    try:
        with transaction.atomic():
            template = EmailTemplate.objects.create(
                category_name=category_name,
                subject_template=data["subject"],
                body_template=data["body"],
                is_generated=True,
                generated_at=timezone.now(),
                model_used=settings.OLLAMA_MODEL_NAME or "phi3:mini",
                prompt_used=prompt
            )
            print(f"[TEMPLATE CREATED] '{category_name}' - ID: {template.id}")
            return template
    except IntegrityError:
        template = EmailTemplate.objects.get(category_name=category_name)
        print(f"[TEMPLATE ALREADY EXISTS] '{category_name}' - ID: {template.id}")
        return template


# ============================================================
# RENDER EMAIL
# ============================================================

def render_email(template: EmailTemplate, recipient: Recipient):
    """
    Rend le template avec conversion des accolades simples vers Jinja2.
    """
    import re
    
    def normalize_template(raw_text):
        """
        Convertit les deux formats possibles en Jinja2 valide.
        """
        if not raw_text:
            return ""
        
        # Si déjà au format {{ var }} (avec doubles accolades et espaces)
        if '{{' in raw_text and '}}' in raw_text:
            return raw_text
        
        # Si au format {var} (accolades simples)
        if re.search(r'\{[^}]+\}', raw_text):
            return re.sub(r'\{([^}]+)\}', r'{{ \1 }}', raw_text)
        
        return raw_text

    # Normaliser les templates
    subject_raw = normalize_template(template.subject_template)
    body_raw = normalize_template(template.body_template)

    context = {
        "recipient": recipient,
        "name": recipient.name or recipient.complete_name or "",
        "company_name": recipient.company_name or recipient.name or "",
        "city": recipient.city or "",
        "x_activitec": getattr(recipient, "x_activitec", ""),
        "x_forme_juridique": getattr(recipient, "x_forme_juridique", ""),
        "x_ice": getattr(recipient, "x_ice", ""),
    }

    env = jinja2.Environment(autoescape=True)

    try:
        subject = env.from_string(subject_raw).render(**context)
        body_html = env.from_string(body_raw).render(**context)
        return subject.strip(), body_html.strip()
    except jinja2.exceptions.TemplateSyntaxError as e:
        print(f"[JINJA ERROR] {e}")
        return "Erreur de rendu sujet", "<p>Erreur lors du rendu du template</p>"
    except Exception as e:
        print(f"[RENDER ERROR] {e}")
        return "Erreur de rendu sujet", "<p>Erreur lors du rendu du template</p>"


# ============================================================
# MAIN GENERATION FUNCTION - This is what you're missing!
# ============================================================

def generate_emails_for_recipients(recipient_ids, selected_category='auto', task=None, queue=None):
    """
    Main function to generate emails for multiple recipients.
    Fixed to prevent duplicates and properly update status.
    """
    print(f"[GENERATE] Starting generation for {len(recipient_ids)} recipients")
    
    # Get recipients
    recipients = Recipient.objects.filter(id__in=recipient_ids)
    
    # Group recipients by category
    recipients_by_category = {}
    categories_found = set()
    
    for recipient in recipients:
        if selected_category and selected_category != 'auto':
            category = selected_category
        else:
            category = recipient.x_activitec or "Général"
            category = category.strip()
        
        categories_found.add(category)
        
        if category not in recipients_by_category:
            recipients_by_category[category] = []
        recipients_by_category[category].append(recipient)
    
    print(f"[GENERATE] Found {len(categories_found)} distinct categories: {list(categories_found)}")
    
    total_generated = 0
    results_per_category = {}
    skipped_per_category = {}
    errors_per_category = {}
    
    # Update queue with total categories
    if queue:
        queue.total_categories = len(recipients_by_category)
        queue.save()
    
    # Process each category
    category_index = 0
    for category_name, category_recipients in recipients_by_category.items():
        category_index += 1
        
        print(f"[PROCESS] Processing category: '{category_name}' with {len(category_recipients)} recipients")
        
        # Update task progress
        if task:
            task.current_category = category_name
            task.progress_info = {
                'current_category': category_index,
                'total_categories': len(recipients_by_category),
                'category': category_name,
                'status': f'Processing {category_name}...'
            }
            task.save()
        
        if queue:
            queue.current_category = category_name
            queue.save()
        
        try:
            # Get or generate template
            template = get_or_generate_template(category_name)
            
            if not template:
                errors_per_category[category_name] = "Template generation failed"
                continue
            
            # Check for EXISTING emails - IMPORTANT: Use unique_together constraint
            category_recipient_ids = [r.id for r in category_recipients]
            
            # First, delete any duplicate pending emails for these recipients
            # This fixes the duplicate issue
            duplicates = GeneratedEmail.objects.filter(
                recipient_id__in=category_recipient_ids,
                category_name=category_name,
                status='pending_generation'
            )
            if duplicates.exists():
                print(f"[CLEANUP] Deleting {duplicates.count()} duplicate pending emails")
                duplicates.delete()
            
            # Now check for existing successful emails
            existing_ids = set(
                GeneratedEmail.objects.filter(
                    recipient_id__in=category_recipient_ids,
                    category_name=category_name,
                    status__in=['generated', 'ready', 'sent']
                ).values_list("recipient_id", flat=True)
            )
            
            skipped_per_category[category_name] = len(existing_ids)
            
            # Generate new emails
            new_emails = []
            for recipient in category_recipients:
                if recipient.id in existing_ids:
                    print(f"[SKIP] Recipient {recipient.id} already has email for {category_name}")
                    continue
                
                try:
                    subject, body_html = render_email(template, recipient)
                    
                    # Create or update - prevent duplicates
                    email, created = GeneratedEmail.objects.update_or_create(
                        recipient=recipient,
                        category_name=category_name,
                        defaults={
                            'template': template,
                            'subject': subject,
                            'body_html': body_html,
                            'status': 'generated',  # Direct to generated, skip pending
                            'generated_at': timezone.now(),
                            'metadata': {
                                'queue_id': queue.id if queue else None,
                                'task_id': task.task_id if task else None,
                                'generation_time': timezone.now().isoformat()
                            }
                        }
                    )
                    
                    if created:
                        new_emails.append(email)
                        print(f"[GENERATED] Email for {recipient.name}")
                    else:
                        print(f"[UPDATED] Email for {recipient.name}")
                    
                except Exception as e:
                    print(f"[RENDER ERROR] Failed for recipient {recipient.id}: {e}")
                    errors_per_category[category_name] = str(e)
                    continue
            
            if new_emails:
                total_generated += len(new_emails)
                results_per_category[category_name] = len(new_emails)
                
                # Update template usage
                template.usage_count += len(new_emails)
                template.last_used_at = timezone.now()
                template.save()
                
                # Update queue progress
                if queue:
                    queue.processed_emails += len(new_emails)
                    queue.save()
                
        except Exception as e:
            print(f"[CATEGORY ERROR] Failed to process category '{category_name}': {e}")
            errors_per_category[category_name] = str(e)
            continue
    
    # Prepare result
    result = {
        'success': True,
        'generated': total_generated,
        'by_category': results_per_category,
        'skipped_by_category': skipped_per_category,
        'total_skipped': sum(skipped_per_category.values()),
        'errors': errors_per_category,
        'categories_processed': list(recipients_by_category.keys())
    }
    
    print(f"[GENERATE] Completed - Generated: {total_generated}")
    return result

# ============================================================
# QUEUE MANAGEMENT
# ============================================================

def create_generation_queue(task_id, recipient_ids, name=None):
    """
    Create a generation queue entry
    """
    from .models import EmailGenerationQueue
    
    queue = EmailGenerationQueue.objects.create(
        task_id=task_id,
        name=name or f"Generation {task_id[:8]}",
        total_emails=len(recipient_ids),
        status='pending',
        created_at=timezone.now()
    )
    
    # Create pending generation records for all recipients
    recipients = Recipient.objects.filter(id__in=recipient_ids)
    pending_emails = []
    
    for recipient in recipients:
        pending_emails.append(
            GeneratedEmail(
                recipient=recipient,
                category_name=recipient.x_activitec or "Général",
                status='pending_generation',
                metadata={'queue_id': queue.id}
            )
        )
    
    if pending_emails:
        GeneratedEmail.objects.bulk_create(pending_emails, batch_size=100)
        queue.total_emails = len(pending_emails)
        queue.save()
    
    return queue


def get_queue_status(queue_id):
    """
    Get detailed status of a generation queue
    """
    from .models import EmailGenerationQueue, GeneratedEmail
    
    try:
        queue = EmailGenerationQueue.objects.get(id=queue_id)
        
        # Get emails in this queue
        emails = GeneratedEmail.objects.filter(metadata__queue_id=queue_id)
        
        status_counts = emails.values('status').annotate(
            count=models.Count('id')
        )
        
        status_dict = {item['status']: item['count'] for item in status_counts}
        
        return {
            'queue_id': queue.id,
            'task_id': queue.task_id,
            'name': queue.name,
            'status': queue.status,
            'total': queue.total_emails,
            'processed': status_dict.get('generated', 0) + status_dict.get('ready', 0),
            'pending': status_dict.get('pending_generation', 0),
            'failed': status_dict.get('failed_generation', 0),
            'progress': queue.progress_percentage,
            'created_at': queue.created_at,
            'started_at': queue.started_at,
            'completed_at': queue.completed_at,
            'duration': queue.duration
        }
    except EmailGenerationQueue.DoesNotExist:
        return None


# ============================================================
# STATISTICS
# ============================================================
def get_dashboard_stats():
    """
    Get comprehensive dashboard statistics
    """
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Count, Q
    from .models import GeneratedEmail, EmailTemplate, EmailGenerationQueue, EmailGenerationTask
    from data_importer.models import Recipient
    
    today = timezone.now().date()
    week_ago = today - timedelta(days=7)
    
    # Quick stats
    total_recipients = Recipient.objects.count()
    total_emails_generated = GeneratedEmail.objects.filter(
        status__in=['generated', 'ready', 'sent']
    ).count()
    total_emails_sent = GeneratedEmail.objects.filter(status='sent').count()
    active_templates = EmailTemplate.objects.filter(is_generated=True).count()
    
    # Today's stats
    recipients_imported_today = Recipient.objects.filter(created_at__date=today).count()
    emails_generated_today = GeneratedEmail.objects.filter(
        generated_at__date=today,
        status__in=['generated', 'ready', 'sent']
    ).count()
    emails_sent_today = GeneratedEmail.objects.filter(
        sent_at__date=today,
        status='sent'
    ).count()
    emails_failed_today = GeneratedEmail.objects.filter(
        updated_at__date=today,
        status__contains='failed'
    ).count()
    
    # Queue status
    pending_generation = GeneratedEmail.objects.filter(
        status='pending_generation'
    ).count()
    generating = GeneratedEmail.objects.filter(
        status='generating'
    ).count()
    ready_to_send = GeneratedEmail.objects.filter(
        status='ready'
    ).count()
    sending = GeneratedEmail.objects.filter(
        status='sending'
    ).count()
    
    # Active queues
    active_queues = EmailGenerationQueue.objects.filter(
        status__in=['pending', 'processing']
    ).count()
    
    # Last 7 days activity
    last_7_days = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_stats = {
            'date': day.strftime('%Y-%m-%d'),
            'day': day.strftime('%A')[:3],
            'generated': GeneratedEmail.objects.filter(
                generated_at__date=day,
                status__in=['generated', 'ready', 'sent']
            ).count(),
            'sent': GeneratedEmail.objects.filter(
                sent_at__date=day,
                status='sent'
            ).count(),
            'imported': Recipient.objects.filter(created_at__date=day).count(),
        }
        last_7_days.append(day_stats)
    
    # Categories distribution
    categories = []
    for template in EmailTemplate.objects.filter(is_generated=True)[:10]:
        total = GeneratedEmail.objects.filter(
            category_name=template.category_name,
            status__in=['generated', 'ready', 'sent']
        ).count()
        today_count = GeneratedEmail.objects.filter(
            category_name=template.category_name,
            generated_at__date=today
        ).count()
        
        categories.append({
            'name': template.category_name,
            'total': total,
            'generated_today': today_count,
        })
    
    # Add "Général" category if not present
    if not any(c['name'] == 'Général' for c in categories):
        general_total = GeneratedEmail.objects.filter(
            category_name='Général',
            status__in=['generated', 'ready', 'sent']
        ).count()
        general_today = GeneratedEmail.objects.filter(
            category_name='Général',
            generated_at__date=today
        ).count()
        categories.append({
            'name': 'Général',
            'total': general_total,
            'generated_today': general_today,
        })
    
    # Recent activity
    recent_activity = []
    
    # Recent generations
    for email in GeneratedEmail.objects.filter(
        status__in=['generated', 'ready']
    ).select_related('recipient').order_by('-generated_at')[:5]:
        if email.generated_at and email.recipient:
            recent_activity.append({
                'type': 'generation',
                'recipient': email.recipient.name or email.recipient.complete_name or 'Inconnu',
                'category': email.category_name or 'Général',
                'time': email.generated_at.isoformat(),
                'status': 'success'
            })
    
    # Recent sends
    for email in GeneratedEmail.objects.filter(
        status='sent'
    ).select_related('recipient').order_by('-sent_at')[:5]:
        if email.sent_at and email.recipient:
            recent_activity.append({
                'type': 'sending',
                'recipient': email.recipient.name or email.recipient.complete_name or 'Inconnu',
                'category': email.category_name or 'Général',
                'time': email.sent_at.isoformat(),
                'status': 'success'
            })
    
    # Recent failures
    for email in GeneratedEmail.objects.filter(
        status__contains='failed'
    ).select_related('recipient').order_by('-updated_at')[:3]:
        if email.recipient:
            recent_activity.append({
                'type': 'error',
                'recipient': email.recipient.name or email.recipient.complete_name or 'Inconnu',
                'category': email.category_name or 'Général',
                'time': email.updated_at.isoformat(),
                'status': 'failed',
                'error': email.error_message or 'Erreur inconnue'
            })
    
    # Sort and limit recent activity
    recent_activity.sort(key=lambda x: x['time'], reverse=True)
    recent_activity = recent_activity[:10]
    
    # Performance metrics
    success_rate = calculate_success_rate()
    
    return {
        'quick_stats': {
            'total_recipients': total_recipients,
            'total_emails_generated': total_emails_generated,
            'total_emails_sent': total_emails_sent,
            'active_templates': active_templates,
        },
        'today': {
            'recipients_imported': recipients_imported_today,
            'emails_generated': emails_generated_today,
            'emails_sent': emails_sent_today,
            'emails_failed': emails_failed_today,
            'emails_in_queue': pending_generation + generating,
            'emails_ready': ready_to_send,
        },
        'queue_status': {
            'generation_queues': active_queues,
            'pending_generation': pending_generation,
            'generating': generating,
            'ready_to_send': ready_to_send,
            'sending': sending,
        },
        'last_7_days': last_7_days,
        'categories': categories,
        'recent_activity': recent_activity,
        'performance': {
            'avg_generation_time': 2.5,  # Default value
            'avg_sending_time': 1.2,      # Default value
            'success_rate': success_rate,
            'peak_hours': [{'hour': 10, 'count': 5}, {'hour': 14, 'count': 8}, {'hour': 16, 'count': 6}],
        }
    }


def calculate_success_rate():
    """
    Calculate email generation success rate
    """
    total = GeneratedEmail.objects.exclude(
        status__in=['pending_generation']
    ).count()
    
    if total == 0:
        return 100
    
    successful = GeneratedEmail.objects.filter(
        status__in=['generated', 'ready', 'sent']
    ).count()
    
    return round((successful / total) * 100, 1)

