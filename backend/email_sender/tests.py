
to_email = "lazariatik@gmail.com"
from_email = "Contact@bmm.ma"
webhook = "https://bmm.ma/turbosmtp/webhook/"
import os
import requests
import json
from django.conf import settings


TURBOSMTP_CONSUMER_KEY = "7a2dd23c2a93aea200e9"
TURBOSMTP_CONSUMER_SECRET = "mExOHN6jGvVMPoYpCd0a"

url = "https://api.turbo-smtp.com/api/v2/mail/send"

payload = {
    "authuser": TURBOSMTP_CONSUMER_KEY,
    "authpass": TURBOSMTP_CONSUMER_SECRET,
    "from": "Contact@bmm.ma",
    "to": "lazariatik@gmail.com",   # 👈 CHANGE THIS
    "subject": "TurboSMTP API Test 7",
    "html_content": "<h1>Test Email</h1><p>If you receive this, API works ✅</p>"
}

headers = {
    "Content-Type": "application/json"
}

#response = requests.post(url, data=json.dumps(payload), headers=headers)

#print("Status Code:", response.status_code)
#print("Response:", response.text)
print('settings. ',settings.TURBOSMTP_CONSUMER_KEY)
