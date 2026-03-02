# urls.py
from django.urls import path
from .views import (
    RecipientListView,
    CategoryListView,
    #EmailCategoryListView,
    #GenerateTemplateView,
    TemplateListView,
    GenerateEmailsView,
    
    TaskStatusView,
    TaskListView,
    CancelTaskView,
    DashboardStatsView,
    GenerationQueueView,
    SendingQueueView,
    EmailStatusView,
    MarkEmailsReadyView,
    
    
)

urlpatterns = [
    path('recipients/', RecipientListView.as_view(), name='recipient-list'),
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('templates/', TemplateListView.as_view(), name='template-list'),
    #path('templates/generate/<int:category_id>/', GenerateTemplateView.as_view(), name='generate-template'),
    path('emails/generate/', GenerateEmailsView.as_view(), name='generate-emails'),
     
    
    path('tasks/<str:task_id>/', TaskStatusView.as_view(), name='task-status'),
    path('tasks/', TaskListView.as_view(), name='task-list'),
    path('tasks/<str:task_id>/cancel/', CancelTaskView.as_view(), name='cancel-task'),
    
    # New dashboard endpoints
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('queue/generation/', GenerationQueueView.as_view(), name='generation-queue'),
    path('queue/sending/', SendingQueueView.as_view(), name='sending-queue'),
    path('emails/status/', EmailStatusView.as_view(), name='email-status'),
    path('emails/<int:email_id>/status/', EmailStatusView.as_view(), name='email-detail-status'),

    path('emails/', EmailStatusView.as_view(), name='email-status-list'),   
    path('emails/<int:email_id>/', EmailStatusView.as_view(), name='email-status-detail'),
    path('emails/mark-ready/', MarkEmailsReadyView.as_view(), name='mark-emails-ready'),
]