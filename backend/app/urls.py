# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RecipientViewSet, GeneratedEmailViewSet, 
    EmailTemplateViewSet, EmailLogViewSet,
    SourceDatabaseAPI, SourceRecipientsAPI,
    DashboardAPI, HealthCheckAPI
)

router = DefaultRouter()
router.register(r'recipients', RecipientViewSet)
router.register(r'emails', GeneratedEmailViewSet)
router.register(r'templates', EmailTemplateViewSet)
router.register(r'logs', EmailLogViewSet)

urlpatterns = [
    # API endpoints
    path('api/', include(router.urls)),
    
    # Source database endpoints
    path('api/source/stats/', SourceDatabaseAPI.as_view(), name='source-stats'),
    path('api/source/browse/', SourceRecipientsAPI.as_view(), name='source-browse'),
    path('api/source/import/', SourceRecipientsAPI.as_view(), name='source-import'),
    
    # Dashboard
    path('api/dashboard/', DashboardAPI.as_view(), name='dashboard'),
    
    # Health check
    path('api/health/', HealthCheckAPI.as_view(), name='health-check'),
    
    # Custom email actions
    path('api/emails/<int:pk>/approve/', GeneratedEmailViewSet.as_view({'post': 'approve'}), name='email-approve'),
    path('api/emails/<int:pk>/reject/', GeneratedEmailViewSet.as_view({'post': 'reject'}), name='email-reject'),
    path('api/emails/generate/', GeneratedEmailViewSet.as_view({'post': 'generate'}), name='email-generate'),
    path('api/emails/send_approved/', GeneratedEmailViewSet.as_view({'post': 'send_approved'}), name='send-approved'),
    path('api/emails/bulk_action/', GeneratedEmailViewSet.as_view({'post': 'bulk_action'}), name='bulk-action'),
    
    # Custom recipient actions
    path('api/recipients/bulk_delete/', RecipientViewSet.as_view({'post': 'bulk_delete'}), name='bulk-delete'),
    path('api/recipients/sync/', RecipientViewSet.as_view({'post': 'sync'}), name='recipient-sync'),
]