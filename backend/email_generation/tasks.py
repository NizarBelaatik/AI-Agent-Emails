# tasks.py
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache
import time

from data_importer.models import Recipient
from .models import EmailTemplate, GeneratedEmail, EmailGenerationTask
from .services import get_or_generate_template, render_email


@shared_task(bind=True, soft_time_limit=3600, time_limit=4000)
def generate_emails_task(self, recipient_ids, selected_category='auto', task_id=None):
    """
    Background task to generate emails for multiple recipients
    """
    task_id = task_id or self.request.id
    print(f"[TASK:{task_id}] Starting generation for {len(recipient_ids)} recipients")
    
    # Update task in database
    if task_id:
        try:
            task = EmailGenerationTask.objects.get(task_id=task_id)
            task.status = 'PROGRESS'
            task.started_at = timezone.now()
            task.save()
        except EmailGenerationTask.DoesNotExist:
            task = None
    
    try:
        # Get recipients
        recipients = Recipient.objects.filter(id__in=recipient_ids)
        
        # Group recipients by category
        recipients_by_category = {}
        for recipient in recipients:
            if selected_category and selected_category != 'auto':
                category = selected_category
            else:
                category = recipient.x_activitec or "Général"
                category = category.strip()
            
            if category not in recipients_by_category:
                recipients_by_category[category] = []
            recipients_by_category[category].append(recipient)
        
        total_categories = len(recipients_by_category)
        total_generated = 0
        results_per_category = {}
        skipped_per_category = {}
        errors_per_category = {}
        
        # Update task with categories info
        if task:
            task.total_categories = total_categories
            task.save()
        
        # Process each category
        current_category_idx = 0
        for category_name, category_recipients in recipients_by_category.items():
            current_category_idx += 1
            
            # Update progress
            progress_info = {
                'current_category': current_category_idx,
                'total_categories': total_categories,
                'category': category_name,
                'recipients_in_category': len(category_recipients),
                'status': f'Traitement de {category_name}...'
            }
            
            self.update_state(
                state='PROGRESS',
                meta=progress_info
            )
            
            # Update task in database
            if task:
                task.current_category = category_name
                task.progress_info = progress_info
                task.save()
            
            print(f"[TASK:{task_id}] Processing category {current_category_idx}/{total_categories}: {category_name}")
            
            try:
                # Get or generate template
                template = get_or_generate_template(category_name)
                
                if not template:
                    errors_per_category[category_name] = "Échec génération template"
                    continue
                
                # Check existing emails
                category_recipient_ids = [r.id for r in category_recipients]
                existing_ids = set(
                    GeneratedEmail.objects.filter(
                        recipient_id__in=category_recipient_ids,
                        category_name=category_name
                    ).values_list("recipient_id", flat=True)
                )
                
                skipped_per_category[category_name] = len(existing_ids)
                
                # Generate new emails
                new_emails = []
                total_in_category = len(category_recipients)
                
                for idx, recipient in enumerate(category_recipients):
                    if recipient.id in existing_ids:
                        continue
                    
                    # Update progress every 10 recipients
                    if idx % 10 == 0:
                        self.update_state(
                            state='PROGRESS',
                            meta={
                                **progress_info,
                                'current_recipient': idx,
                                'total_recipients_in_category': total_in_category
                            }
                        )
                    
                    try:
                        subject, body_html = render_email(template, recipient)
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
                    except Exception as e:
                        print(f"[TASK:{task_id}] Render error for recipient {recipient.id}: {e}")
                        continue
                
                # Bulk create
                if new_emails:
                    GeneratedEmail.objects.bulk_create(new_emails, batch_size=100)
                    total_generated += len(new_emails)
                    results_per_category[category_name] = len(new_emails)
                    
            except Exception as e:
                print(f"[TASK:{task_id}] Category error {category_name}: {e}")
                errors_per_category[category_name] = str(e)
        
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
        
        # Update task in database
        if task:
            task.status = 'SUCCESS'
            task.completed_at = timezone.now()
            task.result = result
            task.save()
        
        print(f"[TASK:{task_id}] Completed - Generated: {total_generated}")
        return result
        
    except SoftTimeLimitExceeded:
        print(f"[TASK:{task_id}] Timeout exceeded")
        if task:
            task.status = 'FAILURE'
            task.error_message = "La génération a pris trop de temps"
            task.save()
        raise
        
    except Exception as e:
        print(f"[TASK:{task_id}] Fatal error: {e}")
        if task:
            task.status = 'FAILURE'
            task.error_message = str(e)
            task.save()
        raise