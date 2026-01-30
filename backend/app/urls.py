from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'source', views.SourceRecipientViewSet, basename='source')
router.register(r'recipients', views.RecipientViewSet)
router.register(r'emails', views.GeneratedEmailViewSet)
router.register(r'templates', views.EmailTemplateViewSet)
router.register(r'campaigns', views.EmailCampaignViewSet)
router.register(r'logs', views.EmailLogViewSet)
router.register(r'settings', views.SettingViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/scheduler/', views.EmailSchedulerView.as_view(), name='scheduler'),
    path('api/scheduler/status/', views.EmailSchedulerView.as_view(), name='scheduler-status'),
]