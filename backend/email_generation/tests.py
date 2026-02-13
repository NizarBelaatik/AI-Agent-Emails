# test_email_generation.py
import os
import django
import sys
from datetime import datetime

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from email_generation.models import Recipient, EmailTemplate, GeneratedEmail, EmailGenerationQueue, EmailGenerationTask
from email_generation.services import generate_emails_for_recipients, create_generation_queue, get_dashboard_stats
from email_generation.views import GenerateEmailsView
import json
import uuid

def print_header(text):
    """Print a formatted header"""
    print("\n" + "="*60)
    print(f" {text}")
    print("="*60)

def print_success(text):
    """Print success message"""
    print(f"✅ {text}")

def print_error(text):
    """Print error message"""
    print(f"❌ {text}")

def print_info(text):
    """Print info message"""
    print(f"📌 {text}")

def test_database_connection():
    """Test 1: Database connection and models"""
    print_header("TEST 1: Database Connection")
    
    try:
        # Check Recipients
        recipient_count = Recipient.objects.count()
        print_success(f"Connected to database")
        print_info(f"Total recipients: {recipient_count}")
        
        # Check Templates
        template_count = EmailTemplate.objects.count()
        print_info(f"Total templates: {template_count}")
        
        # Check Generated Emails
        email_count = GeneratedEmail.objects.count()
        print_info(f"Total generated emails: {email_count}")
        
        return True
    except Exception as e:
        print_error(f"Database error: {e}")
        return False

def test_recipients_with_categories():
    """Test 2: Check recipients have categories"""
    print_header("TEST 2: Recipient Categories")
    
    recipients = Recipient.objects.exclude(x_activitec__isnull=True).exclude(x_activitec='')[:10]
    
    if recipients:
        print_success(f"Found {recipients.count()} recipients with categories")
        categories = set()
        for r in recipients:
            categories.add(r.x_activitec)
            print_info(f"ID: {r.id}, Name: {r.name}, Category: '{r.x_activitec}'")
        print_success(f"Unique categories: {list(categories)}")
        return True
    else:
        print_error("No recipients with categories found!")
        print_info("Please import recipients with x_activitec field populated")
        return False

def test_template_generation():
    """Test 3: Template generation"""
    print_header("TEST 3: Template Generation")
    
    from email_generation.services import get_or_generate_template
    
    test_categories = ["Décoration", "Informatique", "BTP", "Général"]
    
    success_count = 0
    for category in test_categories:
        try:
            template = get_or_generate_template(category, force=True)
            print_success(f"Generated template for '{category}'")
            print_info(f"  Subject: {template.subject_template[:50]}...")
            success_count += 1
        except Exception as e:
            print_error(f"Failed to generate template for '{category}': {e}")
    
    return success_count > 0

def test_email_rendering():
    """Test 4: Email rendering"""
    print_header("TEST 4: Email Rendering")
    
    from email_generation.services import render_email, get_or_generate_template
    
    # Get a recipient and template
    recipient = Recipient.objects.filter(
        ~Q(email__isnull=True),
        ~Q(email='')
    ).first()
    
    if not recipient:
        print_error("No recipient with email found")
        return False
    
    template = get_or_generate_template(recipient.x_activitec or "Général")
    
    try:
        subject, body = render_email(template, recipient)
        print_success(f"Email rendered for {recipient.name}")
        print_info(f"  Subject: {subject}")
        print_info(f"  Body preview: {body[:100]}...")
        return True
    except Exception as e:
        print_error(f"Rendering failed: {e}")
        return False

def test_generation_queue():
    """Test 5: Generation queue creation"""
    print_header("TEST 5: Generation Queue")
    
    # Get some recipients
    recipients = Recipient.objects.all()[:3]
    if not recipients:
        print_error("No recipients found")
        return False
    
    recipient_ids = [r.id for r in recipients]
    task_id = str(uuid.uuid4())
    
    try:
        # Create queue
        queue = create_generation_queue(
            task_id=task_id,
            recipient_ids=recipient_ids,
            name=f"Test Queue {datetime.now().strftime('%H:%M:%S')}"
        )
        print_success(f"Queue created: ID {queue.id}")
        print_info(f"  Task ID: {queue.task_id}")
        print_info(f"  Total emails: {queue.total_emails}")
        print_info(f"  Status: {queue.status}")
        
        # Check if pending emails were created
        pending_count = GeneratedEmail.objects.filter(
            metadata__queue_id=queue.id,
            status='pending_generation'
        ).count()
        print_info(f"  Pending emails created: {pending_count}")
        
        return True
    except Exception as e:
        print_error(f"Queue creation failed: {e}")
        return False

def test_generate_emails():
    """Test 6: Generate emails for recipients"""
    print_header("TEST 6: Generate Emails")
    
    # Get recipients without generated emails
    recipients = Recipient.objects.exclude(
        id__in=GeneratedEmail.objects.filter(
            status__in=['generated', 'ready', 'sent']
        ).values_list('recipient_id', flat=True)
    )[:2]
    
    if not recipients:
        print_error("No recipients without generated emails found")
        # Use any recipients
        recipients = Recipient.objects.all()[:2]
    
    recipient_ids = [r.id for r in recipients]
    print_info(f"Testing with {len(recipient_ids)} recipients")
    
    try:
        # Generate emails
        result = generate_emails_for_recipients(
            recipient_ids=recipient_ids,
            selected_category='auto'
        )
        
        print_success("Email generation completed")
        print_info(f"  Generated: {result.get('generated', 0)}")
        print_info(f"  Skipped: {result.get('total_skipped', 0)}")
        print_info(f"  By category: {result.get('by_category', {})}")
        
        # Check if emails were created
        new_emails = GeneratedEmail.objects.filter(
            recipient_id__in=recipient_ids,
            status='generated'
        )
        print_info(f"  New emails in database: {new_emails.count()}")
        
        return True
    except Exception as e:
        print_error(f"Generation failed: {e}")
        return False

def test_dashboard_stats():
    """Test 7: Dashboard statistics"""
    print_header("TEST 7: Dashboard Statistics")
    
    try:
        stats = get_dashboard_stats()
        
        print_success("Dashboard stats retrieved")
        print_info(f"  Total recipients: {stats['quick_stats']['total_recipients']}")
        print_info(f"  Total emails generated: {stats['quick_stats']['total_emails_generated']}")
        print_info(f"  Total emails sent: {stats['quick_stats']['total_emails_sent']}")
        print_info(f"  Today's generations: {stats['today']['emails_generated']}")
        print_info(f"  Queue size: {stats['queue_status']['pending_generation']}")
        
        return True
    except Exception as e:
        print_error(f"Dashboard stats failed: {e}")
        return False

def test_api_endpoints():
    """Test 8: API endpoints (requires server running)"""
    print_header("TEST 8: API Endpoints")
    
    import requests
    from django.conf import settings
    
    base_url = "http://localhost:8000/api/email-generation"
    
    endpoints = [
        "/recipients/?page=1&page_size=5",
        "/categories/",
        "/templates/",
        "/dashboard/stats/",
        "/queue/generation/",
        "/queue/sending/",
        "/emails/status/",
    ]
    
    success_count = 0
    for endpoint in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                print_success(f"GET {endpoint} - {response.status_code}")
                success_count += 1
            else:
                print_error(f"GET {endpoint} - {response.status_code}")
        except Exception as e:
            print_error(f"GET {endpoint} - Connection failed (is server running?)")
    
    return success_count > 0

def run_all_tests():
    """Run all tests"""
    print_header("🚀 EMAIL GENERATION SYSTEM TEST SUITE")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Recipient Categories", test_recipients_with_categories),
        ("Template Generation", test_template_generation),
        ("Email Rendering", test_email_rendering),
        ("Generation Queue", test_generation_queue),
        ("Generate Emails", test_generate_emails),
        ("Dashboard Stats", test_dashboard_stats),
        ("API Endpoints", test_api_endpoints),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print_error(f"{name} - Exception: {e}")
            results.append((name, False))
    
    # Print summary
    print_header("📊 TEST SUMMARY")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print("\n" + "="*60)
    print(f"RESULTS: {passed}/{total} tests passed")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)