import requests
import csv
import time
import sys
import uuid
import json

BASE_URL = "https://outlook.cloud.microsoft/search/api/v1/suggestions"
MAX_SIZE = 100

LETTERS = list("abcçdefgğhıijklmnoöprsştuüvwxyz")
SECOND_LETTERS = list("abcçdefgğhıijklmnoöprsştuüvwxyz ")

def search_people(session, headers, query, size=MAX_SIZE):
    params = {
        "scenario": "owa.react.compose",
        "n": "81",
    }

    body = {
        "AppName": "OWA",
        "Scenario": {"Name": "owa.react.compose"},
        "Cvid": str(uuid.uuid4()),
        "EntityRequests": [{
            "Query": {"QueryString": query},
            "EntityType": "People",
            "Provenances": ["Mailbox", "Directory"],
            "Size": size,
            "Fields": [
                "Id", "ADObjectId", "DisplayName", "EmailAddresses",
                "PeopleSubtype", "PeopleType", "PersonaId", "ImAddress",
                "JobTitle", "PersonId", "MRI", "ExternalDirectoryObjectId", "Alias"
            ],
            "Filter": {"Term": {"Flags": "NonHidden"}}
        }]
    }

    resp = session.post(BASE_URL, params=params, headers=headers, json=body)
    resp.raise_for_status()
    data = resp.json()

    results = []
    for group in data.get("Groups", []):
        for suggestion in group.get("Suggestions", []):
            name = suggestion.get("DisplayName", "")
            emails = suggestion.get("EmailAddresses", [])
            job = suggestion.get("JobTitle", "")
            subtype = suggestion.get("PeopleSubtype", "")
            email = emails[0] if emails else ""
            if email:
                results.append({
                    "name": name,
                    "email": email,
                    "job_title": job,
                    "type": subtype,
                })

    return results

def main():
    token_file = sys.argv[1] if len(sys.argv) > 1 else ".token"
    try:
        with open(token_file) as f:
            token = f.read().strip()
    except FileNotFoundError:
        print(f"Token dosyası bulunamadı: {token_file}")
        sys.exit(1)

    if token.startswith("Bearer "):
        token = token[7:].strip()

    session = requests.Session()

    headers = {
        "authorization": f"Bearer {token}",
        "content-type": "application/json",
        "x-anchormailbox": "PUID:10032000E04D0B81@d4ef65a2-079c-4516-8bd5-ee6e3b2ce456",
        "x-tenantid": "d4ef65a2-079c-4516-8bd5-ee6e3b2ce456",
    }

    # Test connection
    print("Bağlantı test ediliyor...")
    try:
        test = search_people(session, headers, "test", size=1)
        print(f"Bağlantı OK. Test sonucu: {len(test)} kişi")
    except Exception as e:
        print(f"HATA: {e}")
        sys.exit(1)

    all_people = {}
    queries_done = 0

    # Phase 1: Single letters
    print(f"\nFaz 1: Tek harf aramaları ({len(LETTERS)} harf)...")
    need_drill = []

    for letter in LETTERS:
        results = search_people(session, headers, letter)
        new = 0
        for p in results:
            if p["email"] not in all_people:
                all_people[p["email"]] = p
                new += 1

        queries_done += 1
        print(f"  '{letter}': {len(results)} sonuç, {new} yeni (toplam: {len(all_people)})")

        if len(results) >= MAX_SIZE:
            need_drill.append(letter)

        time.sleep(0.3)

    # Phase 2: Two-letter combos for saturated letters
    if need_drill:
        print(f"\nFaz 2: İki harf aramaları (doymuş harfler: {need_drill})...")
        for first in need_drill:
            need_drill_3 = []
            for second in SECOND_LETTERS:
                query = first + second
                results = search_people(session, headers, query)
                new = 0
                for p in results:
                    if p["email"] not in all_people:
                        all_people[p["email"]] = p
                        new += 1

                queries_done += 1
                if new > 0:
                    print(f"  '{query}': {len(results)} sonuç, {new} yeni (toplam: {len(all_people)})")

                if len(results) >= MAX_SIZE:
                    need_drill_3.append(query)

                time.sleep(0.2)

            # Phase 3: Three-letter combos if still saturated
            for prefix in need_drill_3:
                for third in SECOND_LETTERS:
                    query = prefix + third
                    results = search_people(session, headers, query)
                    new = 0
                    for p in results:
                        if p["email"] not in all_people:
                            all_people[p["email"]] = p
                            new += 1

                    queries_done += 1
                    if new > 0:
                        print(f"  '{query}': {len(results)} sonuç, {new} yeni (toplam: {len(all_people)})")

                    time.sleep(0.2)

    # Write CSV
    output_file = "outlook_directory.csv"
    people_list = sorted(all_people.values(), key=lambda x: x["name"].lower())

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email", "job_title", "type"])
        writer.writeheader()
        writer.writerows(people_list)

    print(f"\n{'='*50}")
    print(f"Toplam {len(all_people)} benzersiz kişi bulundu.")
    print(f"Toplam {queries_done} sorgu yapıldı.")
    print(f"Dosya: {output_file}")

    # Stats
    types = {}
    for p in all_people.values():
        t = p.get("job_title", "Bilinmiyor") or "Bilinmiyor"
        types[t] = types.get(t, 0) + 1

    print(f"\nUnvan dağılımı (ilk 10):")
    for title, count in sorted(types.items(), key=lambda x: -x[1])[:10]:
        print(f"  {title}: {count}")

if __name__ == "__main__":
    main()
