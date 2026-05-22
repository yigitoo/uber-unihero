import requests
from bs4 import BeautifulSoup
import csv
import time
import sys

BASE_URL = "https://uzem.altinbas.edu.tr"
COURSE_ID = 14434
PARTICIPANTS_URL = f"{BASE_URL}/user/index.php?id={COURSE_ID}"

def get_session(cookie_value):
    session = requests.Session()
    session.cookies.set("MoodleSession", cookie_value, domain="uzem.altinbas.edu.tr")
    return session

def get_participants_from_page(session, page):
    url = f"{PARTICIPANTS_URL}&page={page}"
    resp = session.get(url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    participants = []
    for link in soup.find_all("a", href=lambda h: h and "user/view.php" in h):
        href = link.get("href", "")
        name = link.get_text(strip=True)
        if name and "id=" in href and "course=" in href:
            participants.append({"name": name, "profile_url": href})

    return participants

def get_total_pages(session):
    resp = session.get(PARTICIPANTS_URL)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Find pagination links
    page_links = soup.select("ul.pagination li a, .paging a")
    max_page = 0
    for link in page_links:
        href = link.get("href", "")
        text = link.get_text(strip=True)
        if text.isdigit():
            max_page = max(max_page, int(text))

    # Also check if there's a participant count
    body_text = soup.get_text()
    if "katılımcıları bulundu" in body_text:
        for line in body_text.split("\n"):
            if "katılımcıları bulundu" in line:
                print(f"  {line.strip()}")
                break

    return max_page if max_page > 0 else 1

def get_email_from_profile(session, profile_url):
    resp = session.get(profile_url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    email = None
    name = None

    # Look for email in profile fields
    for dt in soup.find_all("dt"):
        label = dt.get_text(strip=True)
        dd = dt.find_next_sibling("dd")
        if dd:
            value = dd.get_text(strip=True)
            if "posta" in label.lower() or "mail" in label.lower():
                email = value
            if "adınız" in label.lower() or "ad" == label.lower():
                name = value

    # Alternative: table-based profile layout
    if not email:
        for row in soup.select("table tr, .profile_tree section dl"):
            cells = row.find_all(["td", "th", "dt", "dd"])
            for i, cell in enumerate(cells):
                text = cell.get_text(strip=True)
                if "posta" in text.lower() or "mail" in text.lower():
                    if i + 1 < len(cells):
                        email = cells[i + 1].get_text(strip=True)

    # Try finding email via mailto links
    if not email:
        mailto = soup.select_one("a[href^='mailto:']")
        if mailto:
            email = mailto.get("href", "").replace("mailto:", "")

    # Try finding in content area
    if not email:
        content = soup.select_one(".content-area, .userprofile, #region-main")
        if content:
            text = content.get_text()
            import re
            match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
            if match:
                email = match.group(0)

    if not name:
        h2s = soup.find_all("h2")
        for h2 in h2s:
            text = h2.get_text(strip=True)
            if text and "Ignore" not in text and "DCC" not in text and len(text) > 2:
                name = text
                break

    return name, email

def main():
    if len(sys.argv) < 2:
        print("Kullanım: python3 scraper.py <MoodleSession_cookie>")
        print()
        print("Cookie nasıl alınır:")
        print("  1. Chrome'da uzem.altinbas.edu.tr aç, giriş yap")
        print("  2. F12 → Application → Cookies → uzem.altinbas.edu.tr")
        print("  3. MoodleSession satırının Value değerini kopyala")
        sys.exit(1)

    cookie = sys.argv[1]
    session = get_session(cookie)

    # Test connection
    print("Bağlantı test ediliyor...")
    resp = session.get(PARTICIPANTS_URL)
    if "login" in resp.url.lower():
        print("HATA: Cookie geçersiz veya süresi dolmuş. Yeniden al.")
        sys.exit(1)

    print("Bağlantı OK.")

    # Get total pages
    print("Sayfa sayısı hesaplanıyor...")
    total_pages = get_total_pages(session)
    print(f"Toplam {total_pages} sayfa bulundu.")

    # Collect all participant profile URLs
    print("\nKatılımcı linkleri toplanıyor...")
    all_participants = []
    seen_urls = set()

    for page in range(total_pages):
        participants = get_participants_from_page(session, page)
        for p in participants:
            if p["profile_url"] not in seen_urls:
                seen_urls.add(p["profile_url"])
                all_participants.append(p)
        print(f"  Sayfa {page + 1}/{total_pages}: {len(participants)} katılımcı bulundu (toplam: {len(all_participants)})")
        time.sleep(0.5)

    print(f"\nToplam {len(all_participants)} benzersiz katılımcı bulundu.")

    # Visit each profile and get email
    print("\nEmail adresleri çekiliyor...")
    results = []
    seen_emails = set()
    failed = []

    for i, p in enumerate(all_participants):
        url = p["profile_url"]
        if not url.startswith("http"):
            url = BASE_URL + url

        name, email = get_email_from_profile(session, url)

        if not name:
            name = p["name"]

        if email and email not in seen_emails:
            seen_emails.add(email)
            results.append({"name": name, "email": email})
        elif not email:
            failed.append(p["name"])

        progress = (i + 1) / len(all_participants) * 100
        print(f"\r  [{i + 1}/{len(all_participants)}] %{progress:.0f} - {name or p['name']}", end="", flush=True)
        time.sleep(0.3)

    print()

    # Write CSV
    output_file = "students.csv"
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email"])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n{len(results)} öğrenci {output_file} dosyasına yazıldı.")

    if failed:
        print(f"\n{len(failed)} öğrencinin emaili bulunamadı:")
        for name in failed[:10]:
            print(f"  - {name}")
        if len(failed) > 10:
            print(f"  ... ve {len(failed) - 10} daha")

if __name__ == "__main__":
    main()
