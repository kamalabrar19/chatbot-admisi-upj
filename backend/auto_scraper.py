import os
import re
import json
import time
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

from google import genai
from google.genai import types
import firebase_admin
from firebase_admin import credentials, firestore

# ──────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate("firebase-key.json"))

db = firestore.client()
visited_links: set[str] = set()

# ──────────────────────────────────────────
# SELENIUM HELPERS
# ──────────────────────────────────────────

def _build_driver() -> webdriver.Chrome:
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)


def _scroll_to_bottom(driver, max_scrolls: int = 8) -> None:
    last_height = driver.execute_script("return document.body.scrollHeight")
    for i in range(max_scrolls):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1.5)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            print(f"  Page fully loaded after {i + 1} scroll(s).")
            break
        last_height = new_height


def _strip_noise(driver) -> None:
    driver.execute_script("""
        document.querySelectorAll(
            'script, style, nav, header, footer, .navbar, .navigation, .sidebar, [role="navigation"]'
        ).forEach(el => el.remove());
        document.querySelectorAll(
            '[style*="display: none"], [style*="visibility: hidden"]'
        ).forEach(el => el.remove());
    """)


_GET_VISIBLE_TEXT_JS = """
function getVisibleText(root) {
    let text = '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (parent && window.getComputedStyle(parent).display === 'none') continue;
        const content = node.textContent.trim();
        if (content) text += content + ' ';
    }
    return text;
}
return getVisibleText(document.body);
"""


def scrape_page(url: str) -> tuple[str | None, BeautifulSoup | None]:
    """Return (visible_text, soup) for *url*, or (None, None) on failure."""
    driver = _build_driver()
    try:
        print(f"  Loading: {url}")
        driver.get(url)
        time.sleep(3)

        _scroll_to_bottom(driver)
        _strip_noise(driver)

        raw = driver.execute_script(_GET_VISIBLE_TEXT_JS)
        text = re.sub(r"<[^>]+>", "", raw)
        text = re.sub(r"&[a-z]+;", "", text)
        text = re.sub(r"https?://\S+", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        print(f"  Extracted {len(text):,} characters.")

        soup = BeautifulSoup(driver.page_source, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()

        return text, soup
    except Exception as exc:
        print(f"  Scrape error [{type(exc).__name__}]: {exc}")
        return None, None
    finally:
        driver.quit()

# ──────────────────────────────────────────
# CONTENT EXTRACTION HELPERS
# ──────────────────────────────────────────

_PROFILE_SELECTORS = [
    '[class*="profile"]', '[class*="member"]', '[class*="team"]',
    '[class*="alumni"]', '[class*="person"]', '[class*="staff"]',
    '[class*="speaker"]', '[class*="instructor"]',
]

_MAIN_CONTENT_SELECTORS = [
    "main", "article", 'section[role="main"]', ".main-content",
    ".content", ".post-content", ".entry-content", "#content", '[role="main"]',
]


def _extract_profile_cards(soup: BeautifulSoup) -> list[dict]:
    cards = []
    for selector in _PROFILE_SELECTORS:
        for el in soup.select(selector)[:50]:
            img = el.find("img")
            name  = _text(el, '[class*="name"], .person-name, h3, h4')
            job   = _text(el, '[class*="title"], [class*="job"], [class*="position"], .role')
            company = _text(el, '[class*="company"], [class*="organization"], .institution')
            bio   = _text(el, '[class*="bio"], [class*="description"], .desc')
            img_alt = img.get("alt", "").strip() if img else ""

            combined = " ".join(filter(None, [img_alt, name, job, company, bio]))
            if len(combined) > 20:
                cards.append({
                    "type": "profile_card",
                    "text": combined,
                    "metadata": {"name": name, "job": job, "company": company, "image_alt": img_alt},
                })
    return cards


def _text(el, selector: str) -> str:
    node = el.select_one(selector)
    return node.get_text(strip=True) if node else ""


def extract_structured_elements(soup: BeautifulSoup) -> list[dict]:
    items: list[dict] = []

    # Profile cards
    profiles = _extract_profile_cards(soup)
    if profiles:
        print(f"  Found {len(profiles)} profile card(s).")
        items.extend(profiles)

    # Generic cards
    profile_keywords = {"profile", "member", "team", "alumni", "person", "staff"}
    for card in soup.select('[class*="card"], [class*="item"], article, .content-item')[:50]:
        if profile_keywords.intersection(card.get("class", [])):
            continue
        text = card.get_text(separator=" ", strip=True)
        if len(text) > 50:
            items.append({"type": "card", "text": text})

    # Images with nearby text
    for img in soup.find_all("img")[:20]:
        parent = img.find_parent(["div", "figure", "article", "section", "li"])
        if not parent:
            continue
        nearby = parent.get_text(separator=" ", strip=True)
        if len(nearby) > 40:
            context = " ".join(filter(None, [img.get("alt", ""), img.get("title", ""), nearby]))
            items.append({"type": "image_context", "text": context})

    # Tables
    for table in soup.find_all("table"):
        for row in table.find_all("tr")[:50]:
            row_text = " | ".join(c.get_text(strip=True) for c in row.find_all(["td", "th"]))
            if len(row_text) > 20:
                items.append({"type": "table_row", "text": row_text})

    # Lists
    for lst in soup.find_all(["ul", "ol"]):
        for li in lst.find_all("li", recursive=False)[:30]:
            text = li.get_text(strip=True)
            if len(text) > 20:
                items.append({"type": "list_item", "text": text})

    # Heading + paragraph pairs
    for heading in soup.find_all(["h1", "h2", "h3", "h4"])[:30]:
        next_el = heading.find_next(["p", "div"])
        if next_el:
            para = next_el.get_text(strip=True)
            if len(para) > 30:
                items.append({"type": "section", "text": f"[{heading.get_text(strip=True)}] {para}"})

    return items

# ──────────────────────────────────────────
# FAQ EXTRACTION — 3-LAYER FALLBACK
# ──────────────────────────────────────────

def _pattern_extract_faq(text: str) -> list[dict]:
    """Layer 2: Simple pattern-based FAQ extraction."""
    lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 3]
    faqs: list[dict] = []

    # Strategy 1: lines containing "?"
    for i, line in enumerate(lines):
        if "?" in line and len(line) >= 8 and i + 1 < len(lines):
            answer = lines[i + 1]
            if len(answer) >= 10 and "?" not in answer:
                _add_unique(faqs, line.strip(), answer)

    # Strategy 2: "label: value" pairs
    for line in lines:
        if ":" in line and len(line) >= 10:
            label, _, value = line.partition(":")
            if len(label.strip()) >= 3 and len(value.strip()) >= 10:
                _add_unique(faqs, label.strip() + "?", value.strip())

    # Strategy 3: sentence fragments (fallback when few results)
    if len(faqs) < 5:
        for i, sent in enumerate(re.split(r"[.!?]+", text)):
            sent = sent.strip()
            if len(sent) >= 15:
                q = "Tentang " + " ".join(sent.split()[:4]) + "?"
                _add_unique(faqs, q, sent)

    return _deduplicate(faqs)[:30]


def _emergency_extract_faq(text: str) -> list[dict]:
    """Layer 3: Last-resort extraction — numbered sentences as answers."""
    faqs = []
    for i, sent in enumerate(re.split(r"[.!?]+", text)):
        sent = sent.strip()
        if len(sent) >= 15:
            faqs.append({"q": f"Apa informasi penting nomor {i + 1}?", "a": sent})
        if len(faqs) >= 8:
            break
    return faqs


def _add_unique(faqs: list[dict], q: str, a: str) -> None:
    if not any(f["q"].lower() == q.lower() for f in faqs):
        faqs.append({"q": q, "a": a})


def _deduplicate(faqs: list[dict]) -> list[dict]:
    seen, unique = set(), []
    for item in faqs:
        key = (item["q"][:30].lower(), item["a"][:50].lower())
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def _validate_faqs(items) -> list[dict]:
    return [
        {"q": str(i["q"]).strip(), "a": str(i["a"]).strip()}
        for i in items
        if isinstance(i, dict)
        and len(str(i.get("q", "")).strip()) >= 5
        and len(str(i.get("a", "")).strip()) >= 10
    ]


def generate_faq(text: str, source_url: str) -> list[dict]:
    """
    Convert scraped text into FAQ pairs.
    Tries (1) Gemini AI → (2) regex patterns → (3) emergency sentences.
    """
    if not text or len(text) < 50:
        print("  Text too short to process.")
        return []

    # ── Layer 1: AI ──
    try:
        prompt = f"""
ANALYZE THIS CONTENT AND EXTRACT FAQ

Return ONLY a valid JSON array with "q" and "a" fields.
Min 2 pairs, max 50. No markdown, no explanation.

CONTENT:
{text[:8000]}

[{{"q": "What is X?", "a": "X is..."}}]
"""
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.7, top_p=1.0),
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].replace("json", "").strip()

        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            for key in ("faq", "faqs", "result", "data", "qa", "items", "questions"):
                if isinstance(parsed.get(key), list):
                    parsed = parsed[key]
                    break

        valid = _validate_faqs(parsed)
        if valid:
            print(f"  [Layer 1] AI extracted {len(valid)} FAQ item(s).")
            return valid
        print("  [Layer 1] AI returned no valid items.")
    except Exception as exc:
        print(f"  [Layer 1] AI error [{type(exc).__name__}]: {exc}")

    # ── Layer 2: Patterns ──
    result = _pattern_extract_faq(text)
    if result:
        print(f"  [Layer 2] Pattern extraction: {len(result)} item(s).")
        return result
    print("  [Layer 2] Pattern extraction returned nothing.")

    # ── Layer 3: Emergency ──
    result = _emergency_extract_faq(text)
    if result:
        print(f"  [Layer 3] Emergency extraction: {len(result)} item(s).")
        return result

    print("  All extraction layers failed.")
    return []

# ──────────────────────────────────────────
# FIREBASE
# ──────────────────────────────────────────

def save_to_db(faqs: list[dict], source_url: str = "") -> int:
    if not faqs:
        return 0

    batch = db.batch()
    saved = 0
    for item in faqs:
        q, a = item.get("q", "").strip(), item.get("a", "").strip()
        if not q or not a:
            continue
        ref = db.collection("faq").document()
        batch.set(ref, {
            "q": q,
            "a": a,
            "source_url": source_url,
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        saved += 1

    batch.commit()
    print(f"  Saved {saved}/{len(faqs)} FAQ item(s) to Firebase.")
    return saved

# ──────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────

def scrape_url(url: str) -> dict:
    """
    Scrape *url*, generate FAQ via AI, save to Firebase.
    Returns a result dict with keys: success, faqs, message, error.
    """
    print(f"\n{'─'*60}")
    print(f"SCRAPE: {url}")
    print(f"{'─'*60}")

    try:
        text, soup = scrape_page(url)
        if not text:
            return _error("Failed to retrieve page content.")
        if len(text) < 50:
            return _error(f"Content too short ({len(text)} chars, minimum 50).")

        faqs = generate_faq(text, url)
        if not faqs:
            return _error("Could not extract any FAQ pairs from this page.")

        save_to_db(faqs, source_url=url)
        return {
            "success": True,
            "faqs": faqs,
            "message": f"Scraped successfully — {len(faqs)} FAQ item(s) saved.",
            "error": None,
        }
    except Exception as exc:
        return _error(str(exc))


def crawl_site(start_url: str, max_pages: int = 10) -> None:
    """Recursively crawl pages within the same domain (up to *max_pages*)."""
    domain = urlparse(start_url).netloc

    def _crawl(url: str) -> None:
        if url in visited_links or len(visited_links) >= max_pages:
            return
        visited_links.add(url)

        text, soup = scrape_page(url)
        if text:
            faqs = generate_faq(text, url)
            if faqs:
                save_to_db(faqs, source_url=url)

        if soup and len(visited_links) < max_pages:
            skip_ext = {".pdf", ".jpg", ".png", ".zip", ".mp4", ".doc"}
            for a in soup.find_all("a", href=True)[:15]:
                link = urljoin(url, a["href"]).split("#")[0].rstrip("/")
                if (
                    domain in link
                    and not any(link.lower().endswith(e) for e in skip_ext)
                    and link not in visited_links
                ):
                    _crawl(link)

    visited_links.clear()
    _crawl(start_url)
    print(f"\nCrawl complete — {len(visited_links)} page(s) visited.")


def _error(msg: str) -> dict:
    print(f"  ERROR: {msg}")
    return {"success": False, "faqs": [], "message": msg, "error": msg}

# ──────────────────────────────────────────
# CLI
# ──────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        result = scrape_url(sys.argv[1])
        print(result["message"])
        sys.exit(0 if result["success"] else 1)

    print("\nUniversal Web Scraper")
    print("1. Scrape single URL")
    print("2. Crawl site (follows links)")
    choice = input("Choose (1/2): ").strip()

    url = input("Enter URL: ").strip()
    if not url:
        print("No URL provided.")
        sys.exit(1)

    if choice == "1":
        result = scrape_url(url)
        print(result["message"])
    elif choice == "2":
        crawl_site(url)
    else:
        print("Invalid choice.")