# email_dispatcher/apps.py
from django.apps import AppConfig

class EmailDispatcherConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'email_dispatcher'
    
    def ready(self):
        import email_dispatcher.signals