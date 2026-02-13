# urls.py
from django.urls import path
from .views import (
    BrowseSourceView, 
    SourceStatsView, 
    ImportRecipientsView, 
    ImportedRecipientsView,
    InvalidRecipientsView,
    ImportTaskStatusView,
    ImportTasksListView,
    CancelImportTaskView
)

urlpatterns = [
    path('browse-source/', BrowseSourceView.as_view(), name='browse-source'),
    path('source-stats/', SourceStatsView.as_view(), name='source-stats'),
    path('import-recipients/', ImportRecipientsView.as_view(), name='import-recipients'),
    path('imported/', ImportedRecipientsView.as_view(), name='imported-recipients'),
    path('invalid-recipients/', InvalidRecipientsView.as_view(), name='invalid-recipients'),
    
    # New import task endpoints
    path('import-tasks/<str:task_id>/', ImportTaskStatusView.as_view(), name='import-task-status'),
    path('import-tasks/', ImportTasksListView.as_view(), name='import-tasks-list'),
    path('import-tasks/<str:task_id>/cancel/', CancelImportTaskView.as_view(), name='cancel-import-task'),
]