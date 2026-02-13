# urls.py
from django.urls import path
from .views import (
    BrowseSourceView, 
    SourceStatsView, 
    ImportRecipientsView, 
    ImportedRecipientsView,
    InvalidRecipientsView 
)

urlpatterns = [
    path('browse-source/', BrowseSourceView.as_view(), name='browse-source'),
    path('source-stats/', SourceStatsView.as_view(), name='source-stats'),
    path('import-recipients/', ImportRecipientsView.as_view(), name='import-recipients'),
    path('imported/', ImportedRecipientsView.as_view(), name='imported-recipients'),
    path('invalid-recipients/', InvalidRecipientsView.as_view(), name='invalid-recipients'), 
]