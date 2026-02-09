from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import connections
from django.utils import timezone
from django.db.models import Count, Q
from datetime import datetime, timedelta
import json
import boto3
from botocore.exceptions import ClientError

from .models import Recipient, GeneratedEmail, EmailTemplate, EmailLog
from .serializers import (
    RecipientSerializer, GeneratedEmailSerializer, 
    EmailTemplateSerializer, EmailLogSerializer
)

# ============ SOURCE DATABASE API ============

class SourceDatabaseAPI(APIView):
    """Read-only API for source database"""
    
    def get(self, request):
        """Get source database information"""
        try:
            with connections['source_db'].cursor() as cursor:
                # Get table info
                cursor.execute("""
                    SELECT COUNT(*) as total_count,
                           COUNT(CASE WHEN active = TRUE THEN 1 END) as active_count,
                           COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email_count
                    FROM res_partner
                """)
                stats = cursor.fetchone()
                
                # Get categories
                cursor.execute("""
                    SELECT DISTINCT x_activitec 
                    FROM res_partner 
                    WHERE x_activitec IS NOT NULL AND x_activitec != ''
                    ORDER BY x_activitec
                    LIMIT 50
                """)
                categories = [row[0] for row in cursor.fetchall()]
                
                return Response({
                    'success': True,
                    'stats': {
                        'total': stats[0],
                        'active': stats[1],
                        'with_email': stats[2]
                    },
                    'categories': categories,
                    'database': 'res_partner',
                    'timestamp': timezone.now().isoformat()
                })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SourceRecipientsAPI(APIView):
    """Browse recipients from source database"""
    
    # views.py - Update the GET method in SourceRecipientsAPI
    def get(self, request):
        """Get recipients with filtering and pagination - EXCLUDE ALREADY IMPORTED"""
        try:
            # Get query parameters
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 50))
            offset = (page - 1) * page_size
            
            search = request.query_params.get('search', '')
            x_activitec = request.query_params.get('x_activitec', '')
            active_only = request.query_params.get('active_only', 'true') == 'true'
            has_email = request.query_params.get('has_email', 'true') == 'true'
            
            # Get already imported recipient IDs from source database
            imported_source_ids = Recipient.objects.filter(
                source_id__isnull=False
            ).values_list('source_id', flat=True)
            
            # Build query - EXCLUDE already imported
            query = """
                SELECT 
                    id,
                    COALESCE(name, complete_name) as name,
                    email,
                    x_activitec,
                    city,
                    is_company,
                    active,
                    create_date,
                    write_date
                FROM res_partner
                WHERE 1=1
            """
            
            params = []
            
            if active_only:
                query += " AND active = TRUE"
            
            if has_email:
                query += " AND email IS NOT NULL AND email != ''"
            
            if x_activitec:
                query += " AND x_activitec = %s"
                params.append(x_activitec)
            
            if search:
                search_term = f'%{search}%'
                query += " AND (email ILIKE %s OR name ILIKE %s OR complete_name ILIKE %s)"
                params.extend([search_term, search_term, search_term])
            
            # EXCLUDE already imported recipients
            if imported_source_ids:
                placeholders = ','.join(['%s'] * len(imported_source_ids))
                query += f" AND id NOT IN ({placeholders})"
                params.extend(imported_source_ids)
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM ({query}) as subquery"
            with connections['source_db'].cursor() as cursor:
                cursor.execute(count_query, params)
                total_count = cursor.fetchone()[0]
            
            # Get paginated results
            query += " ORDER BY write_date DESC LIMIT %s OFFSET %s"
            params.extend([page_size, offset])
            
            with connections['source_db'].cursor() as cursor:
                cursor.execute(query, params)
                columns = [col[0] for col in cursor.description]
                rows = [
                    dict(zip(columns, row))
                    for row in cursor.fetchall()
                ]
            
            # Convert dates to strings
            for row in rows:
                if row.get('create_date'):
                    row['create_date'] = row['create_date'].isoformat()
                if row.get('write_date'):
                    row['write_date'] = row['write_date'].isoformat()
            
            return Response({
                'success': True,
                'data': rows,
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total': total_count,
                    'pages': (total_count + page_size - 1) // page_size
                },
                'filters': {
                    'search': search,
                    'x_activitec': x_activitec,
                    'active_only': active_only,
                    'has_email': has_email
                },
                'stats': {
                    'excluded_already_imported': len(imported_source_ids)
                }
            })
            
        except Exception as e:
            print(f"GET error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        
    def post(self, request):
        """Import recipients from source to local database - WITH DEBUGGING"""
        try:
            print("=== IMPORT REQUEST RECEIVED ===")
            print("Request data:", request.data)
            print("Request user:", request.user)
            
            recipient_ids = request.data.get('ids', [])
            x_activitec = request.data.get('x_activitec', '')
            limit = int(request.data.get('limit', 100))
            
            print(f"IDs: {recipient_ids}, x_activitec: {x_activitec}, limit: {limit}")
            
            if not recipient_ids and not x_activitec:
                print("No IDs or x_activitec provided")
                return Response({
                    'success': False,
                    'error': 'Provide either ids or x_activitec'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Build source query
            query = """
                SELECT 
                    id,
                    COALESCE(name, complete_name) as name,
                    email,
                    x_activitec,
                    city,
                    is_company,
                    active,
                    write_date
                FROM res_partner
                WHERE active = TRUE
                AND email IS NOT NULL
                AND email != ''
            """
            
            params = []
            
            if recipient_ids:
                print(f"Looking for IDs: {recipient_ids}")
                placeholders = ','.join(['%s'] * len(recipient_ids))
                query += f" AND id IN ({placeholders})"
                params.extend(recipient_ids)
            elif x_activitec:
                print(f"Looking for x_activitec: {x_activitec}")
                query += " AND x_activitec = %s"
                params.append(x_activitec)
            
            query += " LIMIT %s"
            params.append(limit)
            
            print(f"SQL Query: {query}")
            print(f"SQL Params: {params}")
            
            with connections['source_db'].cursor() as cursor:
                cursor.execute(query, params)
                columns = [col[0] for col in cursor.description]
                source_recipients = [
                    dict(zip(columns, row))
                    for row in cursor.fetchall()
                ]
            
            print(f"Found {len(source_recipients)} recipients in source database")
            
            imported = []
            errors = []
            
            for src_recipient in source_recipients:
                try:
                    print(f"Processing recipient: {src_recipient.get('email')} (ID: {src_recipient.get('id')})")
                    
                    # Check if already exists
                    existing = Recipient.objects.filter(
                        Q(source_id=src_recipient['id']) | Q(email=src_recipient['email'])
                    ).first()
                    
                    if existing:
                        # Update existing
                        existing.full_name = src_recipient['name'] or 'Unknown'
                        existing.x_activitec = src_recipient.get('x_activitec', '')
                        existing.city = src_recipient.get('city', '')
                        existing.company = src_recipient.get('is_company', False)
                        existing.is_active = src_recipient.get('active', True)
                        if src_recipient.get('write_date'):
                            existing.last_interaction = src_recipient['write_date']
                        existing.save()
                        action = 'updated'
                        print(f"Updated: {existing.email}")
                    else:
                        # Create new
                        existing = Recipient.objects.create(
                            source_id=src_recipient['id'],
                            email=src_recipient['email'],
                            full_name=src_recipient['name'] or 'Unknown',
                            x_activitec=src_recipient.get('x_activitec', ''),
                            city=src_recipient.get('city', ''),
                            company=src_recipient.get('is_company', False),
                            is_active=src_recipient.get('active', True),
                            last_interaction=src_recipient.get('write_date')
                        )
                        action = 'created'
                        print(f"Created: {existing.email}")
                    
                    imported.append({
                        'id': existing.id,
                        'email': existing.email,
                        'name': existing.full_name,
                        'action': action
                    })
                    
                except Exception as e:
                    print(f"Error processing {src_recipient.get('email')}: {str(e)}")
                    errors.append({
                        'email': src_recipient.get('email', 'unknown'),
                        'error': str(e)
                    })
            
            # Log the import
            EmailLog.objects.create(
                action='imported',
                performed_by='system',
                details=f"Imported {len(imported)} recipients from source database",
                metadata={
                    'source_ids': recipient_ids,
                    'x_activitec': x_activitec,
                    'imported': len(imported),
                    'errors': len(errors)
                }
            )
            
            print(f"Import completed: {len(imported)} imported, {len(errors)} errors")
            
            return Response({
                'success': True,
                'imported': imported,
                'errors': errors,
                'total_imported': len(imported),
                'total_errors': len(errors)
            })
            
        except Exception as e:
            print(f"Import error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
# ============ LOCAL RECIPIENTS API ============

class RecipientViewSet(viewsets.ModelViewSet):
    """API for local recipients"""
    queryset = Recipient.objects.all().order_by('-imported_at')
    serializer_class = RecipientSerializer
    
    def list(self, request):
        """Get recipients with optional filtering"""
        queryset = self.get_queryset()
        
        # Apply filters
        search = request.query_params.get('search', '')
        x_activitec = request.query_params.get('x_activitec', '')
        city = request.query_params.get('city', '')
        is_active = request.query_params.get('is_active', '')
        has_emails = request.query_params.get('has_emails', '')
        
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(email__icontains=search) |
                Q(city__icontains=search)
            )
        
        if x_activitec:
            queryset = queryset.filter(x_activitec=x_activitec)
        
        if city:
            queryset = queryset.filter(city=city)
        
        if is_active:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        if has_emails == 'with':
            queryset = queryset.filter(emails__isnull=False).distinct()
        elif has_emails == 'without':
            queryset = queryset.filter(emails__isnull=True)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
            'count': queryset.count()
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get recipient statistics"""
        total = Recipient.objects.count()
        active = Recipient.objects.filter(is_active=True).count()
        
        categories = Recipient.objects.filter(
            x_activitec__isnull=False
        ).values('x_activitec').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        with_emails = Recipient.objects.filter(
            emails__isnull=False
        ).distinct().count()
        
        recent = Recipient.objects.filter(
            imported_at__gte=timezone.now() - timedelta(days=7)
        ).count()
        
        return Response({
            'success': True,
            'total': total,
            'active': active,
            'with_emails': with_emails,
            'recent_imports': recent,
            'categories': list(categories)
        })
    
    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Bulk delete recipients"""
        recipient_ids = request.data.get('ids', [])
        
        if not recipient_ids:
            return Response({
                'success': False,
                'error': 'No recipient IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        deleted_count, _ = Recipient.objects.filter(id__in=recipient_ids).delete()
        
        # Log the action
        EmailLog.objects.create(
            action='bulk_delete',
            performed_by='system',
            details=f"Deleted {deleted_count} recipients",
            metadata={'recipient_ids': recipient_ids}
        )
        
        return Response({
            'success': True,
            'deleted_count': deleted_count
        })
    
    @action(detail=False, methods=['post'])
    def sync(self, request):
        """Sync with source database"""
        try:
            # Get all active recipients with email from source
            query = """
                SELECT id, email, COALESCE(name, complete_name) as name, 
                       x_activitec, city, is_company, active, write_date
                FROM res_partner
                WHERE active = TRUE
                AND email IS NOT NULL
                AND email != ''
            """
            
            with connections['source_db'].cursor() as cursor:
                cursor.execute(query)
                columns = [col[0] for col in cursor.description]
                source_recipients = [
                    dict(zip(columns, row))
                    for row in cursor.fetchall()
                ]
            
            updated = 0
            created = 0
            
            for src_recipient in source_recipients:
                existing = Recipient.objects.filter(
                    Q(source_id=src_recipient['id']) | Q(email=src_recipient['email'])
                ).first()
                
                if existing:
                    # Update existing
                    existing.full_name = src_recipient['name'] or 'Unknown'
                    existing.x_activitec = src_recipient.get('x_activitec', '')
                    existing.city = src_recipient.get('city', '')
                    existing.company = src_recipient.get('is_company', False)
                    existing.is_active = src_recipient.get('active', True)
                    if src_recipient.get('write_date'):
                        existing.last_interaction = src_recipient['write_date']
                    existing.save()
                    updated += 1
                else:
                    # Create new
                    Recipient.objects.create(
                        source_id=src_recipient['id'],
                        email=src_recipient['email'],
                        full_name=src_recipient['name'] or 'Unknown',
                        x_activitec=src_recipient.get('x_activitec', ''),
                        city=src_recipient.get('city', ''),
                        company=src_recipient.get('is_company', False),
                        is_active=src_recipient.get('active', True),
                        last_interaction=src_recipient.get('write_date')
                    )
                    created += 1
            
            # Deactivate recipients not in source
            source_emails = [r['email'] for r in source_recipients]
            deactivated = Recipient.objects.filter(
                is_active=True
            ).exclude(
                email__in=source_emails
            ).update(is_active=False)
            
            # Log the sync
            EmailLog.objects.create(
                action='sync',
                performed_by='system',
                details=f"Synced with source: Created {created}, Updated {updated}, Deactivated {deactivated}",
                metadata={
                    'created': created,
                    'updated': updated,
                    'deactivated': deactivated
                }
            )
            
            return Response({
                'success': True,
                'created': created,
                'updated': updated,
                'deactivated': deactivated,
                'total_in_source': len(source_recipients)
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ============ EMAILS API ============

class GeneratedEmailViewSet(viewsets.ModelViewSet):
    """API for generated emails"""
    queryset = GeneratedEmail.objects.all().order_by('-generated_at')
    serializer_class = GeneratedEmailSerializer
    
    def list(self, request):
        """Get emails with filtering"""
        queryset = self.get_queryset()
        
        # Apply filters
        status_filter = request.query_params.get('status', '')
        category = request.query_params.get('category', '')
        search = request.query_params.get('search', '')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        if category:
            queryset = queryset.filter(recipient__x_activitec=category)
        
        if search:
            queryset = queryset.filter(
                Q(subject__icontains=search) |
                Q(recipient__email__icontains=search) |
                Q(recipient__full_name__icontains=search)
            )
        
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
            'count': queryset.count()
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get email statistics"""
        total = GeneratedEmail.objects.count()
        
        status_stats = GeneratedEmail.objects.values('status').annotate(
            count=Count('id')
        ).order_by('status')
        
        today = timezone.now().date()
        today_count = GeneratedEmail.objects.filter(
            generated_at__date=today
        ).count()
        
        by_category = GeneratedEmail.objects.filter(
            recipient__x_activitec__isnull=False
        ).values('recipient__x_activitec').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        return Response({
            'success': True,
            'total': total,
            'today': today_count,
            'by_status': list(status_stats),
            'by_category': list(by_category)
        })
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an email"""
        email = self.get_object()
        
        if email.status != 'draft':
            return Response({
                'success': False,
                'error': 'Only draft emails can be approved'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email.status = 'approved'
        email.approved_at = timezone.now()
        email.save()
        
        # Log the approval
        EmailLog.objects.create(
            email=email,
            action='approved',
            performed_by='system',
            details=f"Email approved for {email.recipient.email}"
        )
        
        return Response({
            'success': True,
            'message': 'Email approved successfully',
            'email_id': email.id
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an email"""
        email = self.get_object()
        reason = request.data.get('reason', 'No reason provided')
        
        email.status = 'rejected'
        email.save()
        
        # Log the rejection
        EmailLog.objects.create(
            email=email,
            action='rejected',
            performed_by='system',
            details=f"Email rejected: {reason}"
        )
        
        return Response({
            'success': True,
            'message': 'Email rejected',
            'email_id': email.id
        })
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate emails for recipients"""
        try:
            recipient_ids = request.data.get('recipient_ids', [])
            template_id = request.data.get('template_id', 1)
            category = request.data.get('category', '')
            limit = int(request.data.get('limit', 10))
            
            if not recipient_ids and not category:
                return Response({
                    'success': False,
                    'error': 'Provide either recipient_ids or category'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get recipients
            if recipient_ids:
                recipients = Recipient.objects.filter(
                    id__in=recipient_ids,
                    is_active=True,
                    email__isnull=False
                ).exclude(email='')
            elif category:
                recipients = Recipient.objects.filter(
                    x_activitec=category,
                    is_active=True,
                    email__isnull=False
                ).exclude(email='').order_by('?')[:limit]
            
            # Get template
            template = EmailTemplate.objects.filter(id=template_id).first()
            if not template:
                template = EmailTemplate.objects.first()
            
            generated = []
            errors = []
            
            for recipient in recipients:
                try:
                    # Check for existing draft/approved emails
                    existing = GeneratedEmail.objects.filter(
                        recipient=recipient,
                        status__in=['draft', 'approved']
                    ).first()
                    
                    if existing:
                        errors.append({
                            'email': recipient.email,
                            'error': f'Active email exists (ID: {existing.id})'
                        })
                        continue
                    
                    # Generate email content (simple version)
                    subject = f"Bonjour {recipient.full_name}"
                    body_html = f"""
                        <html>
                        <body>
                            <h1>Bonjour {recipient.full_name},</h1>
                            <p>Nous espérons que vous allez bien à {recipient.city or 'votre ville'}.</p>
                            <p>En tant que client dans le secteur de {recipient.x_activitec or 'notre domaine'}, 
                            nous avons des informations importantes à partager avec vous.</p>
                            <p>Votre dernière interaction avec nous date du {recipient.last_interaction.strftime('%d/%m/%Y') if recipient.last_interaction else 'récemment'}.</p>
                            <p>N'hésitez pas à nous contacter pour plus d'informations.</p>
                            <p>Cordialement,<br>L'équipe</p>
                        </body>
                        </html>
                    """
                    
                    body_text = f"""
                        Bonjour {recipient.full_name},
                        
                        Nous espérons que vous allez bien à {recipient.city or 'votre ville'}.
                        En tant que client dans le secteur de {recipient.x_activitec or 'notre domaine'}, 
                        nous avons des informations importantes à partager avec vous.
                        
                        Votre dernière interaction avec nous date du {recipient.last_interaction.strftime('%d/%m/%Y') if recipient.last_interaction else 'récemment'}.
                        
                        N'hésitez pas à nous contacter pour plus d'informations.
                        
                        Cordialement,
                        L'équipe
                    """
                    
                    # Create email
                    email = GeneratedEmail.objects.create(
                        recipient=recipient,
                        subject=subject,
                        body_html=body_html,
                        body_text=body_text,
                        status='draft'
                    )
                    
                    # Log generation
                    EmailLog.objects.create(
                        email=email,
                        action='generated',
                        performed_by='system',
                        details=f'Generated from template: {template.name if template else "Default"}',
                        metadata={
                            'template_id': template_id,
                            'category': category
                        }
                    )
                    
                    generated.append({
                        'email_id': email.id,
                        'recipient': recipient.email,
                        'subject': subject[:50]
                    })
                    
                except Exception as e:
                    errors.append({
                        'email': recipient.email,
                        'error': str(e)
                    })
            
            return Response({
                'success': True,
                'generated': generated,
                'errors': errors,
                'total': len(generated) + len(errors),
                'success_count': len(generated),
                'error_count': len(errors)
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def send_approved(self, request):
        """Send all approved emails"""
        try:
            approved_emails = GeneratedEmail.objects.filter(status='approved')
            sent_count = 0
            failed_count = 0
            results = []
            
            # Get AWS SES configuration
            aws_access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', '')
            aws_secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
            aws_region = getattr(settings, 'AWS_REGION', 'us-east-1')
            sender_email = getattr(settings, 'SES_SENDER_EMAIL', '')
            
            # Check if we have AWS credentials
            if not all([aws_access_key, aws_secret_key, sender_email]):
                # Mock sending for testing
                for email in approved_emails:
                    email.status = 'sent'
                    email.sent_at = timezone.now()
                    email.ses_message_id = f'mock-{email.id}-{datetime.now().timestamp()}'
                    email.save()
                    
                    EmailLog.objects.create(
                        email=email,
                        action='sent',
                        performed_by='system',
                        details='Mock sent (AWS not configured)',
                        metadata={'mock': True}
                    )
                    
                    sent_count += 1
                    results.append({
                        'email_id': email.id,
                        'success': True,
                        'message_id': email.ses_message_id
                    })
                
                return Response({
                    'success': True,
                    'sent': sent_count,
                    'failed': failed_count,
                    'results': results,
                    'note': 'Mock sending - AWS not configured'
                })
            
            # Real sending with SES
            ses_client = boto3.client(
                'ses',
                region_name=aws_region,
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key
            )
            
            for email in approved_emails:
                try:
                    response = ses_client.send_email(
                        Source=sender_email,
                        Destination={'ToAddresses': [email.recipient.email]},
                        Message={
                            'Subject': {'Data': email.subject},
                            'Body': {
                                'Text': {'Data': email.body_text},
                                'Html': {'Data': email.body_html}
                            }
                        }
                    )
                    
                    email.status = 'sent'
                    email.sent_at = timezone.now()
                    email.ses_message_id = response['MessageId']
                    email.save()
                    
                    EmailLog.objects.create(
                        email=email,
                        action='sent',
                        performed_by='system',
                        details=f'Sent via SES: {response["MessageId"]}',
                        metadata={'message_id': response['MessageId']}
                    )
                    
                    sent_count += 1
                    results.append({
                        'email_id': email.id,
                        'success': True,
                        'message_id': response['MessageId']
                    })
                    
                except ClientError as e:
                    email.status = 'failed'
                    email.error_message = e.response['Error']['Message']
                    email.save()
                    
                    EmailLog.objects.create(
                        email=email,
                        action='send_failed',
                        performed_by='system',
                        details=f'Failed to send: {e.response["Error"]["Message"]}'
                    )
                    
                    failed_count += 1
                    results.append({
                        'email_id': email.id,
                        'success': False,
                        'error': e.response['Error']['Message']
                    })
                
                except Exception as e:
                    failed_count += 1
                    results.append({
                        'email_id': email.id,
                        'success': False,
                        'error': str(e)
                    })
            
            return Response({
                'success': True,
                'sent': sent_count,
                'failed': failed_count,
                'results': results
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def bulk_action(self, request):
        """Bulk actions on emails"""
        email_ids = request.data.get('email_ids', [])
        action = request.data.get('action')  # 'approve', 'reject', 'delete'
        
        if not email_ids:
            return Response({
                'success': False,
                'error': 'No email IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        emails = GeneratedEmail.objects.filter(id__in=email_ids)
        results = []
        
        for email in emails:
            try:
                if action == 'approve':
                    if email.status == 'draft':
                        email.status = 'approved'
                        email.approved_at = timezone.now()
                        email.save()
                        results.append({'email_id': email.id, 'success': True})
                    else:
                        results.append({'email_id': email.id, 'success': False, 'error': 'Not draft'})
                
                elif action == 'reject':
                    email.status = 'rejected'
                    email.save()
                    results.append({'email_id': email.id, 'success': True})
                
                elif action == 'delete':
                    if email.status != 'sent':
                        email.delete()
                        results.append({'email_id': email.id, 'success': True})
                    else:
                        results.append({'email_id': email.id, 'success': False, 'error': 'Cannot delete sent email'})
                
                else:
                    results.append({'email_id': email.id, 'success': False, 'error': 'Invalid action'})
                    
            except Exception as e:
                results.append({'email_id': email.id, 'success': False, 'error': str(e)})
        
        success_count = len([r for r in results if r['success']])
        
        # Log bulk action
        EmailLog.objects.create(
            action='bulk_action',
            performed_by='system',
            details=f'Bulk {action} on {success_count} emails',
            metadata={
                'action': action,
                'total': len(email_ids),
                'success': success_count
            }
        )
        
        return Response({
            'success': True,
            'results': results,
            'summary': {
                'total': len(email_ids),
                'success': success_count,
                'failed': len(email_ids) - success_count
            }
        })

# ============ OTHER APIS ============

class EmailTemplateViewSet(viewsets.ModelViewSet):
    """API for email templates"""
    queryset = EmailTemplate.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = EmailTemplateSerializer

class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    """API for email logs"""
    queryset = EmailLog.objects.all().order_by('-performed_at')
    serializer_class = EmailLogSerializer
    
    def list(self, request):
        """Get logs with filtering"""
        queryset = self.get_queryset()
        
        action = request.query_params.get('action', '')
        email_id = request.query_params.get('email_id', '')
        
        if action:
            queryset = queryset.filter(action=action)
        
        if email_id:
            queryset = queryset.filter(email_id=email_id)
        
        serializer = self.get_serializer(queryset[:100], many=True)  # Limit to 100
        return Response({
            'success': True,
            'data': serializer.data,
            'count': queryset.count()
        })

# ============ DASHBOARD & SYSTEM APIS ============

class DashboardAPI(APIView):
    """Dashboard statistics"""
    
    def get(self, request):
        # Source database stats
        source_stats = {}
        try:
            with connections['source_db'].cursor() as cursor:
                cursor.execute("""
                    SELECT COUNT(*) as total,
                           COUNT(CASE WHEN active = TRUE THEN 1 END) as active,
                           COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email
                    FROM res_partner
                """)
                row = cursor.fetchone()
                source_stats = {
                    'total': row[0],
                    'active': row[1],
                    'with_email': row[2]
                }
        except:
            source_stats = {'error': 'Could not connect to source database'}
        
        # Local database stats
        local_stats = {
            'recipients': Recipient.objects.count(),
            'active_recipients': Recipient.objects.filter(is_active=True).count(),
            'emails': GeneratedEmail.objects.count(),
            'draft_emails': GeneratedEmail.objects.filter(status='draft').count(),
            'approved_emails': GeneratedEmail.objects.filter(status='approved').count(),
            'sent_emails': GeneratedEmail.objects.filter(status='sent').count(),
            'failed_emails': GeneratedEmail.objects.filter(status='failed').count(),
        }
        
        # Recent activity
        recent_logs = EmailLog.objects.all().order_by('-performed_at')[:10]
        recent_data = EmailLogSerializer(recent_logs, many=True).data
        
        return Response({
            'success': True,
            'source_database': source_stats,
            'local_database': local_stats,
            'recent_activity': recent_data,
            'timestamp': timezone.now().isoformat()
        })

class HealthCheckAPI(APIView):
    """Health check endpoint"""
    
    def get(self, request):
        # Check source database
        source_ok = False
        try:
            with connections['source_db'].cursor() as cursor:
                cursor.execute("SELECT 1")
                source_ok = True
        except:
            pass
        
        # Check local database
        local_ok = False
        try:
            from django.db import connection
            connection.ensure_connection()
            local_ok = True
        except:
            pass
        
        return Response({
            'status': 'ok' if source_ok and local_ok else 'degraded',
            'source_database': 'connected' if source_ok else 'disconnected',
            'local_database': 'connected' if local_ok else 'disconnected',
            'timestamp': timezone.now().isoformat()
        })