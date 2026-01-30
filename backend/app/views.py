# backend/app/views.py
from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import connections, transaction
from django.utils import timezone
from django.db.models import Q, Count, F
from django_filters import rest_framework as django_filters
from django.core.paginator import Paginator
from datetime import datetime, timedelta
import json
import requests
import boto3
from botocore.exceptions import ClientError

from .models import (
    Recipient, GeneratedEmail, EmailTemplate, EmailLog, 
    EmailCampaign, Setting
)
from .serializers import (
    RecipientSerializer, GeneratedEmailSerializer, EmailTemplateSerializer,
    EmailLogSerializer, EmailCampaignSerializer, SettingSerializer,
    BulkActionSerializer, ImportSelectionSerializer, EmailGenerationSerializer
)

class SourceRecipientViewSet(viewsets.ViewSet):
    """ViewSet for source database operations"""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    @action(detail=False, methods=['get'])
    def browse(self, request):
        """Browse source recipients with filters and selection options"""
        try:
            # Get filters from query params
            category = request.query_params.get('category')
            subcategory = request.query_params.get('subcategory')
            search = request.query_params.get('search', '')
            min_date = request.query_params.get('min_date')
            max_date = request.query_params.get('max_date')
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 50))
            
            # Build query
            query = """
                SELECT email, full_name, category, subcategory, 
                       last_interaction, company, is_active,
                       COUNT(*) OVER() as total_count
                FROM recipients
                WHERE is_active = TRUE
            """
            
            params = []
            
            if category:
                query += " AND category = %s"
                params.append(category)
            
            if subcategory:
                query += " AND subcategory = %s"
                params.append(subcategory)
            
            if search:
                query += " AND (email ILIKE %s OR full_name ILIKE %s OR company ILIKE %s)"
                params.append(f'%{search}%')
                params.append(f'%{search}%')
                params.append(f'%{search}%')
            
            if min_date:
                query += " AND last_interaction >= %s"
                params.append(min_date)
            
            if max_date:
                query += " AND last_interaction <= %s"
                params.append(max_date)
            
            # Add pagination
            offset = (page - 1) * page_size
            query += f" ORDER BY last_interaction DESC LIMIT {page_size} OFFSET {offset}"
            
            with connections['source_db'].cursor() as cursor:
                cursor.execute(query, params)
                columns = [col[0] for col in cursor.description]
                rows = [
                    dict(zip(columns, row))
                    for row in cursor.fetchall()
                ]
            
            # Get total count from first row
            total_count = rows[0]['total_count'] if rows else 0
            
            # Get available categories for filters
            with connections['source_db'].cursor() as cursor:
                cursor.execute("""
                    SELECT DISTINCT category, subcategory 
                    FROM recipients 
                    WHERE is_active = TRUE 
                    ORDER BY category, subcategory
                """)
                categories = [
                    {'category': row[0], 'subcategory': row[1]}
                    for row in cursor.fetchall()
                ]
            
            return Response({
                'recipients': rows,
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total_count': total_count,
                    'total_pages': (total_count + page_size - 1) // page_size
                },
                'filters': {
                    'categories': categories,
                    'date_range': {
                        'min': min_date,
                        'max': max_date
                    }
                }
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def import_recipients(self, request):
        """Import recipients based on selection type"""
        serializer = ImportSelectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        selection_type = data['selection_type']
        filters = data.get('filters', {})
        selected_emails = data.get('selected_emails', [])
        limit = data.get('limit', 100)
        
        try:
            # Build query based on selection type
            query = """
                SELECT email, full_name, category, subcategory, 
                       last_interaction, company
                FROM recipients
                WHERE is_active = TRUE
            """
            
            params = []
            
            if selection_type == 'selected':
                if not selected_emails:
                    return Response(
                        {'error': 'No emails selected'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                placeholders = ', '.join(['%s'] * len(selected_emails))
                query += f" AND email IN ({placeholders})"
                params.extend(selected_emails)
            
            elif selection_type == 'filtered':
                # Apply filters
                if filters.get('category'):
                    query += " AND category = %s"
                    params.append(filters['category'])
                
                if filters.get('subcategory'):
                    query += " AND subcategory = %s"
                    params.append(filters['subcategory'])
                
                if filters.get('search'):
                    query += " AND (email ILIKE %s OR full_name ILIKE %s)"
                    params.append(f"%{filters['search']}%")
                    params.append(f"%{filters['search']}%")
            
            # Limit results
            query += f" LIMIT {limit}"
            
            with connections['source_db'].cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                imported = []
                errors = []
                
                for row in rows:
                    try:
                        recipient, created = Recipient.objects.update_or_create(
                            email=row[0],
                            defaults={
                                'full_name': row[1],
                                'category': row[2],
                                'subcategory': row[3],
                                'last_interaction': row[4],
                                'company': row[5],
                                'is_active': True,
                            }
                        )
                        imported.append({
                            'email': recipient.email,
                            'name': recipient.full_name,
                            'action': 'created' if created else 'updated'
                        })
                    except Exception as e:
                        errors.append({
                            'email': row[0],
                            'error': str(e)
                        })
            
            # Log the import
            EmailLog.objects.create(
                action='imported',
                performed_by=request.user.username if request.user.is_authenticated else 'system',
                details=f"Imported {len(imported)} recipients",
                metadata={
                    'selection_type': selection_type,
                    'filters': filters,
                    'total_imported': len(imported)
                }
            )
            
            return Response({
                'imported': imported,
                'errors': errors,
                'total_imported': len(imported),
                'total_errors': len(errors),
                'selection_type': selection_type
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get source database statistics"""
        try:
            with connections['source_db'].cursor() as cursor:
                # Total recipients
                cursor.execute("SELECT COUNT(*) FROM recipients WHERE is_active = TRUE")
                total = cursor.fetchone()[0]
                
                # By category
                cursor.execute("""
                    SELECT category, COUNT(*) as count
                    FROM recipients 
                    WHERE is_active = TRUE 
                    GROUP BY category 
                    ORDER BY count DESC
                """)
                by_category = [
                    {'category': row[0], 'count': row[1]}
                    for row in cursor.fetchall()
                ]
                
                # Recent activity
                cursor.execute("""
                    SELECT COUNT(*) as recent_count
                    FROM recipients 
                    WHERE is_active = TRUE 
                    AND last_interaction >= CURRENT_DATE - INTERVAL '30 days'
                """)
                recent = cursor.fetchone()[0]
                
                # Companies
                cursor.execute("""
                    SELECT company, COUNT(*) as count
                    FROM recipients 
                    WHERE is_active = TRUE AND company != ''
                    GROUP BY company 
                    ORDER BY count DESC 
                    LIMIT 10
                """)
                companies = [
                    {'company': row[0], 'count': row[1]}
                    for row in cursor.fetchall()
                ]
            
            return Response({
                'total_recipients': total,
                'by_category': by_category,
                'recent_activity': recent,
                'top_companies': companies
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class RecipientViewSet(viewsets.ModelViewSet):
    """ViewSet for imported recipients"""
    queryset = Recipient.objects.filter(is_active=True).order_by('-imported_at')
    serializer_class = RecipientSerializer
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'subcategory', 'is_active']
    search_fields = ['email', 'full_name', 'company']
    ordering_fields = ['imported_at', 'last_interaction', 'full_name']
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get dashboard statistics"""
        total = self.get_queryset().count()
        
        by_category = Recipient.objects.filter(is_active=True).values(
            'category', 'subcategory'
        ).annotate(
            count=Count('id')
        ).order_by('category', 'subcategory')
        
        recent = Recipient.objects.filter(
            is_active=True,
            imported_at__gte=timezone.now() - timedelta(days=7)
        ).count()
        
        return Response({
            'total': total,
            'by_category': list(by_category),
            'recent_imports': recent
        })
    
    @action(detail=False, methods=['delete'])
    def bulk_delete(self, request):
        """Bulk delete recipients"""
        recipient_ids = request.data.get('ids', [])
        
        if not recipient_ids:
            return Response(
                {'error': 'No recipient IDs provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deleted_count, _ = Recipient.objects.filter(id__in=recipient_ids).delete()
        
        EmailLog.objects.create(
            action='bulk_action',
            performed_by=request.user.username if request.user.is_authenticated else 'system',
            details=f'Bulk deleted {deleted_count} recipients',
            metadata={'action': 'delete', 'count': deleted_count}
        )
        
        return Response({'deleted_count': deleted_count})

class GeneratedEmailViewSet(viewsets.ModelViewSet):
    """ViewSet for generated emails with all features"""
    queryset = GeneratedEmail.objects.all().order_by('-generated_at')
    serializer_class = GeneratedEmailSerializer
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'recipient__category', 'recipient__subcategory', 'priority']
    search_fields = [
        'recipient__email', 'recipient__full_name', 'subject',
        'body_text', 'ses_message_id'
    ]
    ordering_fields = [
        'generated_at', 'scheduled_for', 'sent_at', 
        'priority', 'recipient__full_name'
    ]
    
    def get_queryset(self):
        """Filter queryset based on request parameters"""
        queryset = super().get_queryset()
        
        # Filter by campaign
        campaign_id = self.request.query_params.get('campaign_id')
        if campaign_id:
            # Implementation depends on how campaigns are linked to emails
            pass
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(generated_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(generated_at__lte=end_date)
        
        # Filter by tags
        tags = self.request.query_params.get('tags')
        if tags:
            tag_list = tags.split(',')
            queryset = queryset.filter(tags__overlap=tag_list)
        
        return queryset
    
    def get_llm_service(self):
        """Get LLM service instance"""
        class LLMService:
            def __init__(self):
                self.api_url = "http://ollama:11434"
                self.model = "llama2"
            
            def generate_email(self, recipient, template):
                """Generate email using LLM"""
                prompt = template.prompt_template.format(
                    name=recipient.full_name,
                    company=recipient.company,
                    category=recipient.category,
                    subcategory=recipient.subcategory,
                    last_interaction=recipient.last_interaction.strftime('%d/%m/%Y') if recipient.last_interaction else 'N/A'
                )
                
                try:
                    response = requests.post(
                        f"{self.api_url}/api/generate",
                        json={
                            "model": self.model,
                            "prompt": prompt,
                            "stream": False,
                            "options": {
                                "temperature": 0.7,
                                "max_tokens": 1000
                            }
                        },
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        content = result['response']
                        
                        # Parse response
                        lines = content.strip().split('\n')
                        subject = ''
                        body = []
                        
                        for line in lines:
                            if line.startswith('Subject:'):
                                subject = line.replace('Subject:', '').strip()
                            elif line.startswith('Body:'):
                                body.append(line.replace('Body:', '').strip())
                            else:
                                body.append(line.strip())
                        
                        body_html = '<br>'.join(body)
                        body_text = '\n'.join(body)
                        
                        return {
                            'subject': subject,
                            'body_html': body_html,
                            'body_text': body_text,
                            'success': True
                        }
                    
                    return {
                        'success': False,
                        'error': f'LLM API error: {response.status_code}'
                    }
                    
                except Exception as e:
                    return {
                        'success': False,
                        'error': str(e)
                    }
        
        return LLMService()
    
    def get_email_service(self):
        """Get email service instance"""
        class EmailService:
            def __init__(self):
                # These should be from settings
                self.ses_client = boto3.client(
                    'ses',
                    region_name='us-east-1',
                    aws_access_key_id='your-key',
                    aws_secret_access_key='your-secret'
                )
                self.sender = 'no-reply@yourcompany.com'
            
            def send_email(self, recipient_email, subject, body_html, body_text):
                """Send email via SES"""
                try:
                    response = self.ses_client.send_email(
                        Source=self.sender,
                        Destination={'ToAddresses': [recipient_email]},
                        Message={
                            'Subject': {'Data': subject},
                            'Body': {
                                'Text': {'Data': body_text},
                                'Html': {'Data': body_html}
                            }
                        }
                    )
                    return {'success': True, 'message_id': response['MessageId']}
                except ClientError as e:
                    return {'success': False, 'error': e.response['Error']['Message']}
        
        return EmailService()
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get email dashboard statistics"""
        total = GeneratedEmail.objects.count()
        
        stats = GeneratedEmail.objects.aggregate(
            draft=Count('id', filter=Q(status='draft')),
            approved=Count('id', filter=Q(status='approved')),
            scheduled=Count('id', filter=Q(status='scheduled')),
            sent=Count('id', filter=Q(status='sent')),
            failed=Count('id', filter=Q(status='failed')),
            today=Count('id', filter=Q(generated_at__date=timezone.now().date()))
        )
        
        by_category = GeneratedEmail.objects.values(
            'recipient__category'
        ).annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        recent_activity = EmailLog.objects.filter(
            performed_at__gte=timezone.now() - timedelta(hours=24)
        ).values('action').annotate(
            count=Count('id')
        ).order_by('-count')
        
        return Response({
            'total_emails': total,
            'status_stats': stats,
            'by_category': list(by_category),
            'recent_activity': list(recent_activity)
        })
    
    @action(detail=False, methods=['post'])
    def generate_batch(self, request):
        """Generate emails in batch with selection options"""
        serializer = EmailGenerationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        selection_type = data['selection_type']
        filters = data.get('filters', {})
        selected_ids = data.get('selected_ids', [])
        template_id = data['template_id']
        batch_name = data.get('batch_name', 'Batch Generation')
        
        try:
            template = EmailTemplate.objects.get(id=template_id, is_active=True)
            llm_service = self.get_llm_service()
            
            # Get recipients based on selection type
            if selection_type == 'selected':
                recipients = Recipient.objects.filter(id__in=selected_ids, is_active=True)
            elif selection_type == 'filtered':
                queryset = Recipient.objects.filter(is_active=True)
                if filters.get('category'):
                    queryset = queryset.filter(category=filters['category'])
                if filters.get('subcategory'):
                    queryset = queryset.filter(subcategory=filters['subcategory'])
                recipients = queryset
            else:  # 'all'
                recipients = Recipient.objects.filter(is_active=True)
            
            results = []
            generated_emails = []
            
            for recipient in recipients:
                try:
                    # Check for existing emails
                    existing = GeneratedEmail.objects.filter(
                        recipient=recipient,
                        status__in=['draft', 'approved', 'scheduled']
                    ).first()
                    
                    if existing:
                        results.append({
                            'recipient': recipient.email,
                            'success': False,
                            'error': f'Active email exists (ID: {existing.id})',
                            'email_id': existing.id
                        })
                        continue
                    
                    # Generate email
                    result = llm_service.generate_email(recipient, template)
                    
                    if result['success']:
                        email = GeneratedEmail(
                            recipient=recipient,
                            subject=result['subject'],
                            body_html=result['body_html'],
                            body_text=result['body_text'],
                            status='draft',
                            tags=['batch', batch_name] if batch_name else ['batch']
                        )
                        generated_emails.append(email)
                        results.append({
                            'recipient': recipient.email,
                            'success': True,
                            'email_id': email.id,
                            'subject': result['subject'][:50] + '...'
                        })
                    else:
                        results.append({
                            'recipient': recipient.email,
                            'success': False,
                            'error': result['error']
                        })
                        
                except Exception as e:
                    results.append({
                        'recipient': recipient.email if recipient else 'unknown',
                        'success': False,
                        'error': str(e)
                    })
            
            # Bulk create successful emails
            if generated_emails:
                GeneratedEmail.objects.bulk_create(generated_emails)
                
                # Create logs
                log_entries = []
                for email in generated_emails:
                    log_entries.append(EmailLog(
                        email=email,
                        action='generated',
                        performed_by=request.user.username if request.user.is_authenticated else 'system',
                        details=f'Generated from batch: {batch_name}',
                        metadata={'template_id': template_id, 'batch_name': batch_name}
                    ))
                EmailLog.objects.bulk_create(log_entries)
            
            # Create campaign record if batch has name
            if batch_name and generated_emails:
                campaign = EmailCampaign.objects.create(
                    name=batch_name,
                    description=f"Generated {len(generated_emails)} emails",
                    recipient_count=len(generated_emails),
                    email_count=len(generated_emails),
                    status='completed',
                    created_by=request.user.username if request.user.is_authenticated else 'system'
                )
            
            success_count = len([r for r in results if r['success']])
            error_count = len([r for r in results if not r['success']])
            
            return Response({
                'results': results,
                'summary': {
                    'total': len(results),
                    'success': success_count,
                    'errors': error_count,
                    'selection_type': selection_type,
                    'batch_name': batch_name
                }
            })
            
        except EmailTemplate.DoesNotExist:
            return Response(
                {'error': 'Template not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def edit_content(self, request, pk=None):
        """Edit email content manually"""
        email = self.get_object()
        
        subject = request.data.get('subject')
        body_html = request.data.get('body_html')
        body_text = request.data.get('body_text')
        
        if not any([subject, body_html, body_text]):
            return Response(
                {'error': 'No content provided for edit'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Store original values
        original = {
            'subject': email.subject,
            'body_html': email.body_html,
            'body_text': email.body_text
        }
        
        # Update fields
        if subject:
            email.subject = subject
        if body_html:
            email.body_html = body_html
        if body_text:
            email.body_text = body_text
        
        email.status = 'edited'
        email.edited_by = request.user.username if request.user.is_authenticated else 'user'
        email.edited_at = timezone.now()
        email.save()
        
        EmailLog.objects.create(
            email=email,
            action='edited',
            performed_by=request.user.username if request.user.is_authenticated else 'user',
            details='Email content manually edited',
            metadata={'original': original, 'new': {
                'subject': email.subject,
                'body_html_snippet': email.body_html[:100] + '...' if len(email.body_html) > 100 else email.body_html
            }}
        )
        
        return Response({
            'status': 'edited',
            'message': 'Email updated successfully',
            'edited_at': email.edited_at.isoformat(),
            'edited_by': email.edited_by
        })
    
    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        """Schedule email for future sending"""
        email = self.get_object()
        
        if email.status != 'approved':
            return Response(
                {'error': 'Only approved emails can be scheduled'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        scheduled_for = request.data.get('scheduled_for')
        if not scheduled_for:
            return Response(
                {'error': 'scheduled_for is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            scheduled_time = datetime.fromisoformat(scheduled_for.replace('Z', '+00:00'))
            
            # Ensure scheduled time is in the future
            if scheduled_time <= timezone.now():
                return Response(
                    {'error': 'Scheduled time must be in the future'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            email.status = 'scheduled'
            email.scheduled_for = scheduled_time
            email.save()
            
            EmailLog.objects.create(
                email=email,
                action='scheduled',
                performed_by=request.user.username if request.user.is_authenticated else 'user',
                details=f'Scheduled for {scheduled_time}',
                metadata={'scheduled_for': scheduled_time.isoformat()}
            )
            
            return Response({
                'status': 'scheduled',
                'scheduled_for': email.scheduled_for.isoformat(),
                'message': f'Email scheduled for {scheduled_time}'
            })
            
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use ISO format (e.g., 2024-01-30T14:30:00Z)'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def bulk_action(self, request):
        """Perform bulk actions on multiple emails"""
        serializer = BulkActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        email_ids = data['email_ids']
        action = data['action']
        action_data = data.get('data', {})
        
        emails = GeneratedEmail.objects.filter(id__in=email_ids)
        if not emails.exists():
            return Response(
                {'error': 'No emails found with provided IDs'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        results = []
        success_count = 0
        
        for email in emails:
            try:
                if action == 'approve':
                    if email.status == 'draft':
                        email.status = 'approved'
                        email.approved_by = request.user.username if request.user.is_authenticated else 'bulk'
                        email.approved_at = timezone.now()
                        email.save()
                        success_count += 1
                        results.append({'email_id': email.id, 'success': True})
                    else:
                        results.append({'email_id': email.id, 'success': False, 'error': 'Not in draft status'})
                
                elif action == 'reject':
                    email.status = 'rejected'
                    email.save()
                    success_count += 1
                    results.append({'email_id': email.id, 'success': True})
                
                elif action == 'send':
                    if email.can_be_sent():
                        email_service = self.get_email_service()
                        result = email_service.send_email(
                            email.recipient.email,
                            email.subject,
                            email.body_html,
                            email.body_text
                        )
                        
                        if result['success']:
                            email.status = 'sent'
                            email.sent_at = timezone.now()
                            email.ses_message_id = result['message_id']
                            email.save()
                            success_count += 1
                            results.append({'email_id': email.id, 'success': True})
                        else:
                            results.append({'email_id': email.id, 'success': False, 'error': result['error']})
                    else:
                        results.append({'email_id': email.id, 'success': False, 'error': 'Cannot send email in current state'})
                
                elif action == 'schedule':
                    scheduled_for = action_data.get('scheduled_for')
                    if scheduled_for and email.status == 'approved':
                        try:
                            scheduled_time = datetime.fromisoformat(scheduled_for.replace('Z', '+00:00'))
                            email.status = 'scheduled'
                            email.scheduled_for = scheduled_time
                            email.save()
                            success_count += 1
                            results.append({'email_id': email.id, 'success': True})
                        except ValueError:
                            results.append({'email_id': email.id, 'success': False, 'error': 'Invalid date format'})
                    else:
                        results.append({'email_id': email.id, 'success': False, 'error': 'Cannot schedule email'})
                
                elif action == 'archive':
                    email.status = 'archived'
                    email.save()
                    success_count += 1
                    results.append({'email_id': email.id, 'success': True})
                
                elif action == 'regenerate':
                    # This would require template_id in action_data
                    results.append({'email_id': email.id, 'success': False, 'error': 'Use individual regenerate endpoint'})
                
                elif action == 'delete':
                    if email.status != 'sent':
                        email.delete()
                        success_count += 1
                        results.append({'email_id': email.id, 'success': True, 'message': 'Deleted'})
                    else:
                        results.append({'email_id': email.id, 'success': False, 'error': 'Cannot delete sent email'})
                
            except Exception as e:
                results.append({'email_id': email.id, 'success': False, 'error': str(e)})
        
        # Log bulk action
        EmailLog.objects.create(
            action='bulk_action',
            performed_by=request.user.username if request.user.is_authenticated else 'system',
            details=f'Bulk {action} on {success_count} emails',
            metadata={
                'action': action,
                'total': len(email_ids),
                'success': success_count,
                'failed': len(email_ids) - success_count,
                'action_data': action_data
            }
        )
        
        return Response({
            'results': results,
            'summary': {
                'total': len(email_ids),
                'success': success_count,
                'failed': len(email_ids) - success_count,
                'action': action
            }
        })
    
    @action(detail=False, methods=['post'])
    def send_batch(self, request):
        """Send a batch of approved emails"""
        email_ids = request.data.get('email_ids', [])
        send_type = request.data.get('type', 'selected')  # 'selected' or 'all_approved'
        
        if send_type == 'selected' and not email_ids:
            return Response(
                {'error': 'No email IDs provided for selected sending'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get emails to send
        if send_type == 'selected':
            emails = GeneratedEmail.objects.filter(
                id__in=email_ids,
                status='approved'
            )
        else:  # 'all_approved'
            emails = GeneratedEmail.objects.filter(status='approved')
        
        results = []
        email_service = self.get_email_service()
        
        for email in emails:
            try:
                result = email_service.send_email(
                    email.recipient.email,
                    email.subject,
                    email.body_html,
                    email.body_text
                )
                
                if result['success']:
                    email.status = 'sent'
                    email.sent_at = timezone.now()
                    email.ses_message_id = result['message_id']
                    email.save()
                    
                    EmailLog.objects.create(
                        email=email,
                        action='sent',
                        performed_by=request.user.username if request.user.is_authenticated else 'system',
                        details=f'Sent via batch operation',
                        metadata={'batch_type': send_type}
                    )
                    
                    results.append({
                        'email_id': email.id,
                        'success': True,
                        'message_id': result['message_id']
                    })
                else:
                    results.append({
                        'email_id': email.id,
                        'success': False,
                        'error': result['error']
                    })
                    
            except Exception as e:
                results.append({
                    'email_id': email.id,
                    'success': False,
                    'error': str(e)
                })
        
        success_count = len([r for r in results if r['success']])
        
        return Response({
            'results': results,
            'summary': {
                'total': len(emails),
                'success': success_count,
                'failed': len(emails) - success_count,
                'send_type': send_type
            }
        })
    
    @action(detail=False, methods=['get'])
    def scheduled_emails(self, request):
        """Get emails scheduled for sending"""
        now = timezone.now()
        
        # Get upcoming scheduled emails
        upcoming = GeneratedEmail.objects.filter(
            status='scheduled',
            scheduled_for__gt=now
        ).order_by('scheduled_for')
        
        # Get overdue scheduled emails (should have been sent)
        overdue = GeneratedEmail.objects.filter(
            status='scheduled',
            scheduled_for__lte=now
        ).order_by('scheduled_for')
        
        upcoming_serializer = self.get_serializer(upcoming, many=True)
        overdue_serializer = self.get_serializer(overdue, many=True)
        
        return Response({
            'upcoming': upcoming_serializer.data,
            'overdue': overdue_serializer.data,
            'current_time': now.isoformat()
        })

class EmailSchedulerView(APIView):
    """View for scheduled email operations"""
    
    def get(self, request):
        """Get scheduler status and upcoming jobs"""
        # Check for emails that should be sent now
        now = timezone.now()
        due_emails = GeneratedEmail.objects.filter(
            status='scheduled',
            scheduled_for__lte=now
        )
        
        return Response({
            'due_emails_count': due_emails.count(),
            'next_check': (now + timedelta(minutes=1)).isoformat(),
            'system_time': now.isoformat()
        })
    
    def post(self, request):
        """Process due emails (can be called by cron job)"""
        try:
            now = timezone.now()
            due_emails = GeneratedEmail.objects.filter(
                status='scheduled',
                scheduled_for__lte=now
            ).select_related('recipient')
            
            if not due_emails.exists():
                return Response({'message': 'No emails due for sending'})
            
            # Initialize email service
            email_service = self.get_email_service()
            results = []
            
            for email in due_emails:
                try:
                    result = email_service.send_email(
                        email.recipient.email,
                        email.subject,
                        email.body_html,
                        email.body_text
                    )
                    
                    if result['success']:
                        email.status = 'sent'
                        email.sent_at = now
                        email.ses_message_id = result['message_id']
                        email.save()
                        
                        EmailLog.objects.create(
                            email=email,
                            action='sent',
                            performed_by='scheduler',
                            details='Automatically sent by scheduler',
                            metadata={'scheduled_for': email.scheduled_for.isoformat()}
                        )
                        
                        results.append({
                            'email_id': email.id,
                            'success': True,
                            'message_id': result['message_id']
                        })
                    else:
                        email.status = 'failed'
                        email.error_message = result['error']
                        email.save()
                        
                        results.append({
                            'email_id': email.id,
                            'success': False,
                            'error': result['error']
                        })
                        
                except Exception as e:
                    results.append({
                        'email_id': email.id,
                        'success': False,
                        'error': str(e)
                    })
            
            success_count = len([r for r in results if r['success']])
            
            # Create log for scheduler run
            EmailLog.objects.create(
                action='bulk_action',
                performed_by='scheduler',
                details=f'Scheduler sent {success_count} emails',
                metadata={
                    'total': len(due_emails),
                    'success': success_count,
                    'failed': len(due_emails) - success_count
                }
            )
            
            return Response({
                'results': results,
                'summary': {
                    'total_processed': len(due_emails),
                    'successful': success_count,
                    'failed': len(due_emails) - success_count
                }
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_email_service(self):
        """Helper to get email service"""
        class EmailService:
            def __init__(self):
                self.ses_client = boto3.client(
                    'ses',
                    region_name='us-east-1',
                    aws_access_key_id='your-key',
                    aws_secret_access_key='your-secret'
                )
                self.sender = 'no-reply@yourcompany.com'
            
            def send_email(self, recipient_email, subject, body_html, body_text):
                try:
                    response = self.ses_client.send_email(
                        Source=self.sender,
                        Destination={'ToAddresses': [recipient_email]},
                        Message={
                            'Subject': {'Data': subject},
                            'Body': {
                                'Text': {'Data': body_text},
                                'Html': {'Data': body_html}
                            }
                        }
                    )
                    return {'success': True, 'message_id': response['MessageId']}
                except ClientError as e:
                    return {'success': False, 'error': e.response['Error']['Message']}
        
        return EmailService()

# Other ViewSets remain similar but updated with enhanced features
class EmailTemplateViewSet(viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = EmailTemplateSerializer
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get templates grouped by category"""
        category = request.query_params.get('category')
        
        if category:
            templates = EmailTemplate.objects.filter(
                category=category,
                is_active=True
            )
        else:
            templates = EmailTemplate.objects.filter(is_active=True)
        
        # Group by category
        categories = {}
        for template in templates:
            if template.category not in categories:
                categories[template.category] = []
            categories[template.category].append(
                EmailTemplateSerializer(template).data
            )
        
        return Response(categories)

class EmailCampaignViewSet(viewsets.ModelViewSet):
    queryset = EmailCampaign.objects.all().order_by('-created_at')
    serializer_class = EmailCampaignSerializer
    
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get campaign statistics"""
        campaign = self.get_object()
        # Implement campaign stats logic
        return Response({'campaign_id': campaign.id, 'stats': {}})

class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EmailLog.objects.all().order_by('-performed_at')
    serializer_class = EmailLogSerializer
    filter_backends = [django_filters.DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['action', 'performed_by']
    search_fields = ['details', 'email__recipient__email']

class SettingViewSet(viewsets.ModelViewSet):
    queryset = Setting.objects.all()
    serializer_class = SettingSerializer
    
    @action(detail=False, methods=['get'])
    def system_settings(self, request):
        """Get system settings"""
        settings_dict = {}
        for setting in Setting.objects.all():
            settings_dict[setting.key] = setting.value
        
        default_settings = {
            'auto_send_enabled': False,
            'default_schedule_time': '09:00',
            'daily_send_limit': 100,
            'email_check_interval': 5,  # minutes
            'default_priority': 3,
            'auto_approve': False
        }
        
        # Merge with defaults
        for key, value in default_settings.items():
            if key not in settings_dict:
                settings_dict[key] = value
        
        return Response(settings_dict)