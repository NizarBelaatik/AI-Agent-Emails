# email_sender/urls.py
from django.urls import path
from .views import (
    # List & filter ready-to-send emails
    ReadyEmailsListView,
    
    # Main sending actions
    SendBatchView,
    BatchStatusView,
    BatchListView,              # optional but very useful
    BatchCancelView,            # optional
    BatchRetryFailedView,       # optional but recommended
    
    # Stats & dashboard
    SendingDashboardStatsView,
    
    # Single email status (optional but nice for detail view)
    EmailSendingStatusView,
    
    
    TestTurboSMTPConnectionView,
)

urlpatterns = [
    # 1. List emails that are ready to be sent (status='ready')
    path('emails/ready/', ReadyEmailsListView.as_view(), name='ready-emails-list'),

    # 2. Start sending a batch
    path('send-batch/', SendBatchView.as_view(), name='send-batch'),

    # 3. Get status of a specific batch (used for live progress)
    path('batches/<str:batch_id>/', BatchStatusView.as_view(), name='batch-status'),

    # 4. List recent batches/campaigns (for history & dashboard)
    path('batches/', BatchListView.as_view(), name='batch-list'),

    # 5. Cancel a running batch (optional but very useful)
    path('batches/<str:batch_id>/cancel/', BatchCancelView.as_view(), name='batch-cancel'),

    # 6. Retry failed emails in a batch (very useful in real campaigns)
    path('batches/<str:batch_id>/retry-failed/', BatchRetryFailedView.as_view(), name='batch-retry-failed'),

    # 7. Sending-specific dashboard stats
    path('dashboard/stats/', SendingDashboardStatsView.as_view(), name='sending-dashboard-stats'),

    # 8. Optional: detailed status of one sent/failed email
    path('emails/<int:email_id>/status/', EmailSendingStatusView.as_view(), name='email-sending-status'),

    path('test-connection/', TestTurboSMTPConnectionView.as_view(), name='test-turbo-connection'),
    
]