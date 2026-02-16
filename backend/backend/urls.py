from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/importer/', include('data_importer.urls')),  # ← this line connects it
    path('api/email-generation/', include('email_generation.urls')),
    path('api/email-sender/', include('email_sender.urls')),

]