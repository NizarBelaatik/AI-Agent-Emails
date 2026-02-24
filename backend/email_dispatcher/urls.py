from django.urls import path
from . import views

urlpatterns = [
    # Email management
    path('emails/', views.EmailListView.as_view(), name='email-list'),
    path('emails/<int:pk>/', views.EmailDetailView.as_view(), name='email-detail'),
    path('emails/stats/', views.EmailStatsView.as_view(), name='email-stats'),
    
    # Create emails from recipients
    path('create-from-recipients/', views.CreateEmailsFromRecipientsView.as_view(), name='create-from-recipients'),
    
    # Send emails
    path('send/', views.SendEmailsView.as_view(), name='send-emails'),
    
    # Batch management
    path('batches/', views.BatchListView.as_view(), name='batch-list'),
    path('batches/<uuid:batch_id>/', views.BatchDetailView.as_view(), name='batch-detail'),
    path('batches/<uuid:batch_id>/cancel/', views.BatchCancelView.as_view(), name='batch-cancel'),
    path('batches/<uuid:batch_id>/emails/', views.BatchEmailsView.as_view(), name='batch-emails'),
    
    # Sent emails
    path('sent/', views.SentEmailsListView.as_view(), name='sent-emails'),
    
    # Available recipients from data_importer
    path('available-recipients/', views.AvailableRecipientsView.as_view(), name='available-recipients'),
    path('activities/', views.ActivitiesListView.as_view(), name='activities-list'),
]