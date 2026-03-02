# management/commands/test_turbo.py
#from django.core.management.base import BaseCommand
#from django.conf import settings
import requests
import json

TURBOSMTP_CONSUMER_KEY = ""
TURBOSMTP_CONSUMER_SECRET = ""
#TURBOSMTP_WEBHOOK_SECRET = "https://bmm.ma/webhook/turbosmtp/"
DEFAULT_FROM_EMAIL = "contact@mail-bmm.ma"
DEFAULT_FROM_NAME = "BMM"


#class Command(BaseCommand):
def main():
    help = 'Test TurboSMTP connection'

    def handle(self, *args, **options):
        self.stdout.write("Testing TurboSMTP connection...")
        
        payload = {
            "authuser": TURBOSMTP_CONSUMER_KEY,
            "authpass": TURBOSMTP_CONSUMER_SECRET,
            "from": DEFAULT_FROM_EMAIL,
            "from_name": DEFAULT_FROM_NAME or "BMM",
            "to": "ni.bel.2501@gmail.com",
            "subject": "Test",
            "html_content": """
                <p>Veuillez trouver ci-joint le rapport final de l’Atelier Finale.</p>
                <p><strong>Réalisé par :</strong><br>
                Nizar Belatik - Data Science</p>
                <p>Cordialement,<br>
                Nizar Belaatik</p>
            """,
            "text_content": """Veuillez trouver ci-joint le rapport final de l’Atelier Finale

Réalisé par :
Nizar Belatik - Data Science

Cordialement,

Nizar Belaatik""",
        }
        
        try:
            response = requests.post(
                "https://api.turbo-smtp.com/api/v2/mail/send",
                json=payload,
                timeout=10
            )
            
            self.stdout.write(f"Status code: {response.status_code}")
            self.stdout.write(f"Response: {response.text[:500]}")
            
            if response.status_code == 401 and "inactive" in response.text.lower():
                self.stdout.write(self.style.ERROR(
                    "❌ ACCOUNT INACTIVE! Please check your TurboSMTP account status."
                ))
            elif response.status_code in (200, 202):
                self.stdout.write(self.style.SUCCESS("✅ Connection successful!"))
            else:
                self.stdout.write(self.style.WARNING("⚠️ Unexpected response"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            
            
if __name__ == "__main__":
    main()