import requests
import csv
import time
import uuid
import json

BASE_URL = "https://outlook.cloud.microsoft/search/api/v1/suggestions"
MAX_SIZE = 100

LETTERS = list("abcçdefgğhıijklmnoöprsştuüvwxyz")
SECOND_LETTERS = list("abcçdefgğhıijklmnoöprsştuüvwxyz ")

def search_people(session, headers, query, size=MAX_SIZE):
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

    resp = session.post(BASE_URL, params={"scenario": "owa.react.compose", "n": "81"}, headers=headers, json=body)
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
    token = open(".ytu_token").read().strip()
    session = requests.Session()
    headers = {
        "authorization": f"Bearer {token}",
        "content-type": "application/json",
    }

    print("Bağlantı test ediliyor...")
    test = search_people(session, headers, "test", size=1)
    print(f"OK. Test: {len(test)} sonuç")

    all_people = {}
    queries_done = 0

    print(f"\nFaz 1: Tek harf ({len(LETTERS)} harf)...")
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

    if need_drill:
        print(f"\nFaz 2: İki harf (doymuş: {need_drill})...")
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

    # Write all
    output_file = "ytu_directory.csv"
    people_list = sorted(all_people.values(), key=lambda x: x["name"].lower())
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email", "job_title", "type"])
        writer.writeheader()
        writer.writerows(people_list)

    print(f"\n{'='*50}")
    print(f"Toplam {len(all_people)} kişi → {output_file}")
    print(f"Toplam {queries_done} sorgu")

    # Filter students
    SKIP_TYPES = {"UnifiedGroup", "Group", "Room", "EquipmentMailbox"}
    students = [p for p in all_people.values() if p["email"].endswith("@std.yildiz.edu.tr") and p.get("type", "") not in SKIP_TYPES]
    with open("ytu_students.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email", "job_title", "type"])
        writer.writeheader()
        writer.writerows(sorted(students, key=lambda x: x["name"].lower()))
    print(f"Öğrenci (@std): {len(students)} → ytu_students.csv")

    types = {}
    for p in all_people.values():
        t = p.get("job_title", "Bilinmiyor") or "Bilinmiyor"
        types[t] = types.get(t, 0) + 1
    print(f"\nUnvan dağılımı (ilk 10):")
    for title, count in sorted(types.items(), key=lambda x: -x[1])[:10]:
        print(f"  {title}: {count}")

if __name__ == "__main__":
    main()
