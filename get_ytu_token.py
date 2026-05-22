import requests
import time
import json

TENANT_ID = "85602908-e15b-43ba-9148-38bc773a816e"
CLIENT_ID = "d3590ed6-52b3-4102-aeff-aad2292ab01c"
SCOPE = "https://outlook.office.com/.default offline_access"

# Step 1: Start device code flow
print("Device code flow başlatılıyor...")
r = requests.post(
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/devicecode",
    data={"client_id": CLIENT_ID, "scope": SCOPE},
)
d = r.json()

print(f"\n{'='*50}")
print(f"Bu sayfayı aç: {d['verification_uri']}")
print(f"Bu kodu gir:   {d['user_code']}")
print(f"{'='*50}\n")
print("Onay bekleniyor...")

device_code = d["device_code"]
interval = d.get("interval", 5)

# Step 2: Poll for token
while True:
    time.sleep(interval)
    r = requests.post(
        f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "client_id": CLIENT_ID,
            "device_code": device_code,
        },
    )
    data = r.json()

    if "access_token" in data:
        print("\nToken alındı!")
        with open(".ytu_token", "w") as f:
            f.write(data["access_token"])
        with open(".ytu_refresh_token", "w") as f:
            f.write(data.get("refresh_token", ""))
        print(f"Access token → .ytu_token")
        print(f"Refresh token → .ytu_refresh_token")
        break
    elif data.get("error") == "authorization_pending":
        print(".", end="", flush=True)
    else:
        print(f"\nHata: {data.get('error_description', data)}")
        break
