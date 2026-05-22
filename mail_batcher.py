import csv
import os
import json
import hashlib
from datetime import datetime

SOURCE_FILE = "ogr_students.csv"
BATCH_DIR = "batches"
TRACKER_FILE = "send_tracker.json"
BATCH_SIZE = 400  # Microsoft 365: max 500 recipients per message, keep margin
DAILY_LIMIT = 9000  # M365 daily limit ~10K, keep margin

def load_tracker():
    if os.path.exists(TRACKER_FILE):
        with open(TRACKER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"sent_emails": {}, "sent_batches": [], "total_sent": 0}

def save_tracker(tracker):
    with open(TRACKER_FILE, "w", encoding="utf-8") as f:
        json.dump(tracker, f, ensure_ascii=False, indent=2)

def load_all_recipients():
    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def deduplicate(recipients, tracker):
    seen = set()
    unique = []
    for r in recipients:
        email = r["email"].strip().lower()
        if email not in seen and email not in tracker["sent_emails"]:
            seen.add(email)
            unique.append(r)
    return unique

def create_batches(recipients):
    os.makedirs(BATCH_DIR, exist_ok=True)
    batches = []
    for i in range(0, len(recipients), BATCH_SIZE):
        batch = recipients[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        batch_file = os.path.join(BATCH_DIR, f"batch_{batch_num:03d}.csv")

        with open(batch_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "email", "job_title", "type"])
            writer.writeheader()
            writer.writerows(batch)

        bcc_file = os.path.join(BATCH_DIR, f"batch_{batch_num:03d}_bcc.txt")
        with open(bcc_file, "w", encoding="utf-8") as f:
            f.write("; ".join(r["email"] for r in batch))

        batches.append({
            "batch_num": batch_num,
            "file": batch_file,
            "bcc_file": bcc_file,
            "count": len(batch),
            "status": "pending"
        })

    return batches

def mark_batch_sent(batch_num):
    tracker = load_tracker()
    batch_file = os.path.join(BATCH_DIR, f"batch_{batch_num:03d}.csv")

    if not os.path.exists(batch_file):
        print(f"Batch {batch_num} bulunamadı!")
        return

    with open(batch_file, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            email = r["email"].strip().lower()
            tracker["sent_emails"][email] = datetime.now().isoformat()
            tracker["total_sent"] += 1

    tracker["sent_batches"].append({
        "batch": batch_num,
        "sent_at": datetime.now().isoformat(),
    })

    save_tracker(tracker)
    print(f"Batch {batch_num} gönderildi olarak işaretlendi. Toplam gönderilen: {tracker['total_sent']}")

def status():
    tracker = load_tracker()
    all_recipients = load_all_recipients()
    remaining = deduplicate(all_recipients, tracker)

    print(f"Toplam kayıt: {len(all_recipients)}")
    print(f"Gönderilen: {tracker['total_sent']}")
    print(f"Kalan: {len(remaining)}")
    print(f"Gönderilen batch'ler: {[b['batch'] for b in tracker['sent_batches']]}")

    batches_today = [b for b in tracker["sent_batches"]
                     if b["sent_at"].startswith(datetime.now().strftime("%Y-%m-%d"))]
    sent_today = sum(1 for e, d in tracker["sent_emails"].items()
                     if d.startswith(datetime.now().strftime("%Y-%m-%d")))
    remaining_today = DAILY_LIMIT - sent_today
    print(f"\nBugün gönderilen: {sent_today}")
    print(f"Bugün kalan limit: {remaining_today}")
    print(f"Bugün gönderilebilecek batch: {remaining_today // BATCH_SIZE}")

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Kullanım:")
        print("  python3 mail_batcher.py prepare    — Batch'leri oluştur")
        print("  python3 mail_batcher.py status      — Durum göster")
        print("  python3 mail_batcher.py sent <N>    — Batch N'i gönderildi işaretle")
        print("  python3 mail_batcher.py remaining   — Kalan mailleri yeni batch'lere böl")
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "prepare":
        tracker = load_tracker()
        recipients = load_all_recipients()
        unique = deduplicate(recipients, tracker)
        print(f"{len(unique)} benzersiz, gönderilmemiş mail bulundu.")

        batches = create_batches(unique)
        print(f"\n{len(batches)} batch oluşturuldu ({BATCH_SIZE}/batch):")
        for b in batches:
            print(f"  Batch {b['batch_num']:3d}: {b['count']} mail → {b['bcc_file']}")

        print(f"\nGünlük limit: {DAILY_LIMIT}")
        print(f"Günde max {DAILY_LIMIT // BATCH_SIZE} batch gönderilebilir.")
        print(f"Tahmini tamamlanma: {len(unique) // DAILY_LIMIT + 1} gün")

        print("\n--- GÖNDERME TALİMATI ---")
        print("1. batches/batch_001_bcc.txt dosyasını aç")
        print("2. İçeriği Outlook'ta BCC alanına yapıştır")
        print("3. Maili gönder")
        print("4. python3 mail_batcher.py sent 1")
        print("5. 2-3 dk bekle, sonraki batch'e geç")
        print("6. Günlük limit dolunca ertesi gün devam et")

    elif cmd == "status":
        status()

    elif cmd == "sent":
        if len(sys.argv) < 3:
            print("Batch numarası gerekli: python3 mail_batcher.py sent 1")
            sys.exit(1)
        mark_batch_sent(int(sys.argv[2]))

    elif cmd == "remaining":
        tracker = load_tracker()
        recipients = load_all_recipients()
        remaining = deduplicate(recipients, tracker)
        if not remaining:
            print("Tüm mailler gönderilmiş!")
        else:
            batches = create_batches(remaining)
            print(f"{len(remaining)} kalan mail, {len(batches)} yeni batch oluşturuldu.")

    else:
        print(f"Bilinmeyen komut: {cmd}")
