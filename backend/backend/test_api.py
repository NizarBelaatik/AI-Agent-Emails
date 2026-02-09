import requests
import sys

BASE_URL = 'http://localhost:8000'

endpoints = [
    '/api/',
    '/api/source/',
    '/api/source/browse/',
    '/api/recipients/',
    '/api/emails/',
    '/api/dashboard/',
    '/api/health/',
    '/admin/',
]

print("Testing API endpoints:")
print("=" * 60)

for endpoint in endpoints:
    url = BASE_URL + endpoint
    try:
        response = requests.get(url, timeout=5)
        print(f"{endpoint:30} -> {response.status_code} ({len(response.text)} chars)")
    except requests.exceptions.RequestException as e:
        print(f"{endpoint:30} -> ERROR: {e}")

print("\nChecking router-generated URLs:")
print("=" * 60)

# Test if DRF router is working
test_urls = [
    '/api/source/',
    '/api/recipients/',
    '/api/emails/',
]

for url in test_urls:
    full_url = BASE_URL + url
    try:
        response = requests.get(full_url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"{url:30} -> OK, count: {data.get('count', len(data))}")
        else:
            print(f"{url:30} -> {response.status_code}: {response.text[:100]}")
    except Exception as e:
        print(f"{url:30} -> ERROR: {e}")