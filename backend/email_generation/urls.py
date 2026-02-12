from django.urls import path
from .views import (
    RecipientListView,
    #EmailCategoryListView,
    #GenerateTemplateView,
    TemplateListView,
    GenerateEmailsView,
    #TaskStatus,
    #StartGeneration,
)

urlpatterns = [
    path('recipients/', RecipientListView.as_view(), name='recipient-list'),
    path('templates/', TemplateListView.as_view(), name='template-list'),
    #path('templates/generate/<int:category_id>/', GenerateTemplateView.as_view(), name='generate-template'),
    path('emails/generate/', GenerateEmailsView.as_view(), name='generate-emails'),

    #path('tasks/<uuid:task_id>/status/', TaskStatus.as_view(), name='task-status'),
    #path('start-generation/', StartGeneration.as_view(), name='start-generation'),
]
