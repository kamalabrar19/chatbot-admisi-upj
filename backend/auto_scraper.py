import os
import re
import json
import time
from urllib.parse import urljoin
from dotenv import load_dotenv

# Library Scraper & Browser Automation
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Library AI & Database
from google import genai
from google.genai import types
import firebase_admin
from firebase_admin import credentials, firestore

# ==========================================
# 1. KONFIGURASI & KONEKSI
# ==========================================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Inisialisasi Gemini (Model 2.0 Flash - Cepat & Pintar)
client = genai.Client(api_key=GEMINI_API_KEY)

# Inisialisasi Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase-key.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

# Catatan link agar tidak duplikat
visited_links = set()

# ==========================================
# 2. FUNGSI SCRAPER (DENGAN SELENIUM)
# ==========================================

def get_driver():
    """Setting browser Chrome agar bisa jalan di background (headless)."""
    chrome_options = Options()
    chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    # User agent biar gak dianggap bot standar
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=chrome_options)

def remove_noise_elements(soup):
    """Hapus elemen noise: nav, footer, sidebar, ads, scripts, styles"""
    noise_selectors = [
        'script', 'style', 'noscript', 'nav', 'footer', 
        'header', '[role="navigation"]', '[role="complementary"]',
        '.navbar', '.navigation', '.sidebar', '.menu', '.ads',
        '.advertisement', '.cookie', '.modal', '.popup'
    ]
    
    for selector in noise_selectors:
        for element in soup.select(selector):
            element.decompose()

def extract_main_content(soup):
    """Extract main content area dari halaman (intelligent detection, no hardcoded selectors)"""
    
    # 1. Prioritas: Cari common main content containers
    main_content = None
    priority_selectors = [
        'main', 'article', 'section[role="main"]', '.main-content', 
        '.content', '.post-content', '.entry-content', '#content',
        '[role="main"]'
    ]
    
    for selector in priority_selectors:
        elements = soup.select(selector)
        if elements:
            main_content = elements[0]
            print(f"✅ Main content ditemukan dengan selector: {selector}")
            break
    
    # 2. Fallback: Jika tidak ada main container, cari div terbesar dengan teks
    if not main_content:
        print("⚠️ Fallback: Mencari div terbesar dengan teks...")
        divs = soup.find_all('div', recursive=True)
        max_text_length = 0
        
        for div in divs:
            text_length = len(div.get_text(strip=True))
            if text_length > max_text_length:
                max_text_length = text_length
                main_content = div
        
        if main_content:
            print(f"✅ Ditemukan container terbesar dengan {max_text_length} karakter")
    
    return main_content if main_content else soup.body

def extract_profile_cards(soup):
    """Extract profile cards yang berisi foto + nama + job info (for alumni, team, staff pages)"""
    profile_data = []
    
    # Pattern detection untuk profile cards
    profile_selectors = [
        '[class*="profile"]', '[class*="member"]', '[class*="team"]', 
        '[class*="alumni"]', '[class*="person"], [class*="staff"]',
        '[class*="speaker"]', '[class*="instructor"]'
    ]
    
    for selector in profile_selectors:
        profiles = soup.select(selector)
        
        for profile in profiles[:50]:
            # Extract image (alt text might have name)
            img = profile.find('img')
            img_alt = img.get('alt', '').strip() if img else ''
            img_title = img.get('title', '').strip() if img else ''
            
            # Extract name - common locations
            name_elem = profile.select_one('[class*="name"], .person-name, .profile-name, h3, h4, .title')
            name = name_elem.get_text(strip=True) if name_elem else ''
            
            # Extract job/position - common locations
            job_elem = profile.select_one('[class*="title"], [class*="job"], [class*="position"], .role, .designation, .profession')
            job = job_elem.get_text(strip=True) if job_elem else ''
            
            # Extract company/organization
            company_elem = profile.select_one('[class*="company"], [class*="organization"], [class*="org"], .institution')
            company = company_elem.get_text(strip=True) if company_elem else ''
            
            # Extract bio/description
            bio_elem = profile.select_one('[class*="bio"], [class*="description"], [class*="subtitle"], .desc')
            bio = bio_elem.get_text(strip=True) if bio_elem else ''
            
            # Fallback: ambil semua text dari profile card
            all_text = profile.get_text(separator=' | ', strip=True)
            
            # Combine extracted data
            combined = f"{img_alt} {img_title} {name} {job} {company} {bio}".strip()
            
            if combined and len(combined) > 20:
                profile_data.append({
                    'type': 'profile_card',
                    'text': combined,
                    'metadata': {
                        'name': name,
                        'job': job,
                        'company': company,
                        'image_alt': img_alt
                    }
                })
    
    return profile_data

def extract_structured_elements(soup):
    """Extract elements secara terstruktur (cards, tables, lists, paragraphs)"""
    
    elements_data = []
    
    # 1. PRIORITAS TINGGI: Extract profile cards (untuk alumni/team/staff pages)
    profile_cards = extract_profile_cards(soup)
    if profile_cards:
        print(f"👥 Ditemukan {len(profile_cards)} profile cards")
        elements_data.extend(profile_cards)
    
    # 2. Extract card-like elements (most common content pattern)
    cards = soup.select('[class*="card"], [class*="item"], [class*="post"], [class*="article"], article, .content-item')
    
    if cards:
        print(f"📦 Ditemukan {len(cards)} card/item elements")
        for card in cards[:50]:
            # Skip jika sudah di-extract sebagai profile card
            if any(x in str(card).lower() for x in ['profile', 'member', 'team', 'alumni', 'person', 'staff']):
                continue
                
            text = card.get_text(separator=' ', strip=True)
            if len(text) > 50:
                elements_data.append({'type': 'card', 'text': text})
    
    # 3. Extract image + nearby text (generic pattern untuk hero images, featured items)
    images = soup.find_all('img')
    for img in images[:20]:
        alt_text = img.get('alt', '').strip()
        title_text = img.get('title', '').strip()
        
        # Cari text yang dekat dengan image (parent atau siblings)
        parent = img.find_parent(['div', 'figure', 'article', 'section', 'li'])
        if parent:
            nearby_text = parent.get_text(separator=' ', strip=True)
            
            if nearby_text and len(nearby_text) > 40:
                img_context = f"{alt_text} {title_text} {nearby_text}".strip()
                elements_data.append({
                    'type': 'image_context',
                    'text': img_context
                })
    
    # 4. Extract table rows (untuk data terstruktur)
    tables = soup.find_all('table')
    if tables:
        print(f"📊 Ditemukan {len(tables)} tables")
        for table in tables:
            rows = table.find_all('tr')
            for row in rows[:50]:
                cells = row.find_all(['td', 'th'])
                row_text = ' | '.join([cell.get_text(strip=True) for cell in cells])
                if len(row_text) > 20:
                    elements_data.append({'type': 'table_row', 'text': row_text})
    
    # 5. Extract list items
    lists = soup.find_all(['ul', 'ol'])
    if lists:
        print(f"📋 Ditemukan {len(lists)} lists")
        for lst in lists:
            items = lst.find_all('li', recursive=False)[:30]
            for item in items:
                text = item.get_text(strip=True)
                if len(text) > 20:
                    elements_data.append({'type': 'list_item', 'text': text})
    
    # 6. Extract paragraphs dengan heading sebelumnya (untuk context)
    headings = soup.find_all(['h1', 'h2', 'h3', 'h4'])
    for heading in headings[:30]:
        heading_text = heading.get_text(strip=True)
        # Cari paragraf setelah heading
        next_elem = heading.find_next(['p', 'div'])
        if next_elem:
            para_text = next_elem.get_text(strip=True)
            if len(para_text) > 30:
                elements_data.append({
                    'type': 'section',
                    'text': f"[{heading_text}] {para_text}"
                })
    
    return elements_data

def scrape_with_selenium(url):
    """
    Scrape website dengan fokus pada VISIBLE CONTENT
    Dengan detailed logging untuk debugging
    """
    driver = get_driver()
    try:
        print(f"⏳ Loading: {url}")
        driver.get(url)
        time.sleep(3)
        
        print("⏳ Waiting for page interactive...")
        time.sleep(2)
        
        # --- AUTO SCROLL ---
        print("📜 Auto-scrolling...")
        last_height = driver.execute_script("return document.body.scrollHeight")
        scroll_count = 0
        
        while scroll_count < 8:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1.5)
            new_height = driver.execute_script("return document.body.scrollHeight")
            
            if new_height == last_height:
                print(f"✅ Content loaded (scroll: {scroll_count + 1})")
                break
            last_height = new_height
            scroll_count += 1
        
        # --- REMOVE NOISE ---
        print("🧹 Removing noise...")
        driver.execute_script("""
            const toRemove = document.querySelectorAll('script, style, nav, header, footer, .navbar, .navigation, .sidebar, [role="navigation"]');
            toRemove.forEach(el => el.remove());
            document.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"]').forEach(el => el.remove());
        """)
        time.sleep(1)
        
        # --- EXTRACT VISIBLE TEXT ---
        print("🔍 Extracting visible text...")
        visible_text = driver.execute_script("""
            function getVisibleText(element) {
                let text = '';
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    if (node.parentElement && window.getComputedStyle(node.parentElement).display === 'none') {
                        continue;
                    }
                    
                    const content = node.textContent.trim();
                    if (content.length > 0) {
                        text += content + ' ';
                    }
                }
                return text;
            }
            
            return getVisibleText(document.body);
        """)
        
        # Clean text - aggressive filtering for HTML artifacts
        visible_text = re.sub(r'<[^>]+>', '', visible_text)  # Remove HTML tags
        visible_text = re.sub(r'&[a-z]+;', '', visible_text)  # Remove HTML entities
        visible_text = re.sub(r'https?:\/\/\S+', '', visible_text)  # Remove URLs
        visible_text = re.sub(r'\s+', ' ', visible_text).strip()  # Normalize whitespace
        
        print(f"✅ Extracted {len(visible_text):,} characters")
        
        # Parse HTML
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        for element in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript']):
            element.decompose()
        
        return visible_text, soup

    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None, None
    finally:
        driver.quit()

# ==========================================
# 3. PROSES AI & FIREBASE
# ==========================================

def extract_faq_from_text(raw_text):
    """
    Fallback: Extract FAQ langsung dari text jika AI gagal
    Multiple strategies dengan detailed logging
    """
    print("\n" + "-"*60)
    print("EXTRACT_FAQ_FROM_TEXT: Pattern-based extraction")
    print("-"*60)
    
    faqs = []
    
    # --- PRE-PROCESS ---
    lines = [l.strip() for l in raw_text.split('\n') if l.strip() and len(l.strip()) > 3]
    print(f"Split into {len(lines)} lines")
    
    # --- STRATEGY 1: Lines with "?" ---
    print("\n📌 Strategy 1: Lines with '?' as questions...")
    strategy1_count = 0
    for i, line in enumerate(lines):
        if '?' in line and len(line) >= 8:
            q = line.strip()
            # Find answer (next non-empty line)
            if i + 1 < len(lines):
                a = lines[i + 1]
                if len(a) >= 10 and '?' not in a:
                    if not any(f['q'].lower() == q.lower() for f in faqs):
                        faqs.append({'q': q, 'a': a})
                        strategy1_count += 1
    
    print(f"   Found {strategy1_count} Q&A pairs")
    
    # --- STRATEGY 2: Lines with ":" ---
    print("\n📌 Strategy 2: Lines with ':' as label:value...")
    strategy2_start = len(faqs)
    for line in lines:
        if ':' in line and len(line) >= 10:
            parts = line.split(':', 1)
            if len(parts) == 2:
                label = parts[0].strip()
                value = parts[1].strip()
                
                if len(label) >= 3 and len(value) >= 10:
                    q = label + "?"
                    a = value
                    
                    # Avoid duplicates
                    if not any(f['q'].lower() == q.lower() for f in faqs):
                        faqs.append({'q': q, 'a': a})
    
    strategy2_count = len(faqs) - strategy2_start
    print(f"   Found {strategy2_count} Q&A pairs")
    
    # --- STRATEGY 3: Sentence splitting ---
    print("\n📌 Strategy 3: Splitting by sentences...")
    if len(faqs) < 5:
        import re
        sentences = re.split(r'[.!?]+', raw_text)
        sentences = [s.strip() for s in sentences if len(s.strip()) >= 15]
        
        print(f"   Split into {len(sentences)} sentences")
        
        strategy3_start = len(faqs)
        for i, sent in enumerate(sentences[:15]):
            # Generate question from first few words
            words = sent.split()
            if len(words) >= 3:
                q_start = ' '.join(words[:4])
                q = "Tentang " + q_start + "?"
                a = sent
                
                if len(a) >= 20 and not any(f['q'].lower() == q.lower() for f in faqs):
                    faqs.append({'q': q, 'a': a})
        
        strategy3_count = len(faqs) - strategy3_start
        print(f"   Found {strategy3_count} Q&A pairs")
    
    # --- REMOVE DUPLICATES ---
    print("\n📌 Removing duplicates...")
    seen = set()
    unique_faqs = []
    for item in faqs:
        key = (item['q'][:30].lower(), item['a'][:50].lower())
        if key not in seen:
            seen.add(key)
            unique_faqs.append(item)
    
    # --- VALIDATION ---
    valid_faqs = []
    for item in unique_faqs:
        q = item.get('q', '').strip()
        a = item.get('a', '').strip()
        
        if len(q) >= 5 and len(a) >= 10:
            valid_faqs.append({'q': q, 'a': a})
    
    print(f"✅ Result: {len(valid_faqs)} valid FAQ items")
    if valid_faqs:
        for i, faq in enumerate(valid_faqs[:3], 1):
            print(f"   [{i}] Q: {faq['q'][:50]}...")
    
    return valid_faqs[:30]  # Max 30


def emergency_faq_generator(raw_text):
    """
    Last resort: Generate FAQ dari sentences
    Kalau semua method gagal, use ini
    """
    print("\n" + "-"*60)
    print("EMERGENCY_FAQ_GENERATOR: Last resort extraction")
    print("-"*60)
    
    faqs = []
    
    # Split into sentences
    import re
    sentences = re.split(r'[.!?]+', raw_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) >= 15]
    
    print(f"Extracted {len(sentences)} sentences")
    
    if not sentences:
        print("❌ No sentences found, returning empty")
        return []
    
    # Generate FAQ dari first sentences
    for i, sent in enumerate(sentences[:8]):
        if len(sent) >= 15:
            # Simple question format
            q = f"Apa informasi penting nomor {i + 1}?"
            a = sent
            
            if len(a) >= 15:
                faqs.append({'q': q, 'a': a})
    
    print(f"✅ Generated {len(faqs)} FAQ items")
    if faqs:
        for i, faq in enumerate(faqs[:3], 1):
            print(f"   [{i}] Q: {faq['q']}")
    
    return faqs
    
    print(f"🆘 Emergency generated {len(faqs)} minimal FAQ")
    return faqs


def process_to_faq(raw_text, source_url):
    """Process extracted VISIBLE content dengan AI (Gemini) untuk generate FAQ"""
    
    print("\n" + "="*70)
    print("PROCESSING TO FAQ - 3-LAYER FALLBACK SYSTEM")
    print("="*70)
    
    # Check content length
    if not raw_text:
        print("❌ raw_text is EMPTY/None!")
        return []
    
    text_len = len(raw_text)
    print(f"📝 Input: {text_len:,} characters")
    print(f"   Preview (first 300): {raw_text[:300]}...")
    
    if text_len < 50:
        print(f"⚠️ Text too short: {text_len} chars (minimum 50)")
        return []
    
    # --- LAYER 1: AI EXTRACTION ---
    print("\n" + "-"*70)
    print("LAYER 1: AI Extraction (Gemini 2.0 Flash)")
    print("-"*70)
    
    try:
        print(f"Calling Gemini with {text_len:,} chars...")
        
        prompt = f"""
ANALYZE THIS CONTENT AND EXTRACT FAQ

You MUST extract viable Q&A pairs from this text content.

CONTENT:
{raw_text[:8000]}

RULES:
- Return ONLY a valid JSON array
- Each item must have "q" and "a" fields
- MINIMUM 2 pairs, MAXIMUM 50 pairs
- Question: minimum 5 chars
- Answer: minimum 10 chars
- Extract from actual content, or invent reasonable FAQ if content sparse
- Return PURE JSON, no markdown, no explanation

[{{"q": "What is X?", "a": "X is..."}}]
"""
        
        # Using newer genai API with proper config
        config = types.GenerateContentConfig(
            temperature=0.7,
            top_p=1.0
        )
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=config
        )
        
        response_text = response.text.strip()
        print(f"✅ Response received: {len(response_text):,} chars")
        
        # Clean JSON
        clean_json = response_text
        if clean_json.startswith("```"):
            parts = clean_json.split("```")
            clean_json = parts[1].replace("json", "").strip() if len(parts) > 1 else clean_json
        
        clean_json = clean_json.strip()
        print(f"   Cleaned JSON: {clean_json[:200]}...")
        
        # Parse
        faqs = json.loads(clean_json)
        print(f"   Parsed as list: {isinstance(faqs, list)}")
        
        if not isinstance(faqs, list):
            if isinstance(faqs, dict):
                for key in ['faq', 'faqs', 'result', 'data', 'qa', 'items', 'questions']:
                    if key in faqs and isinstance(faqs[key], list):
                        faqs = faqs[key]
                        break
        
        if not isinstance(faqs, list):
            print(f"❌ Not a list after extraction, trying Layer 2...")
        else:
            # Validate items
            valid_faqs = []
            for i, item in enumerate(faqs):
                if isinstance(item, dict) and 'q' in item and 'a' in item:
                    q = str(item['q']).strip()
                    a = str(item['a']).strip()
                    if len(q) >= 5 and len(a) >= 10:
                        valid_faqs.append({'q': q, 'a': a})
                    else:
                        print(f"   Item {i}: q={len(q)} chars (need 5), a={len(a)} chars (need 10)")
            
            if valid_faqs:
                print(f"✅ AI SUCCESS: Generated {len(valid_faqs)} valid FAQ items")
                return valid_faqs
            else:
                print(f"❌ Parsed {len(faqs)} items but 0 valid, trying Layer 2...")
    
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        print(f"   Response was: {response_text[:200]}...")
    except Exception as e:
        print(f"❌ AI error: {type(e).__name__}: {str(e)[:100]}")
        import traceback
        traceback.print_exc()
    
    # --- LAYER 2: TEXT PATTERN EXTRACTION ---
    print("\n" + "-"*70)
    print("LAYER 2: Pattern-based Text Extraction")
    print("-"*70)
    
    try:
        fallback_faqs = extract_faq_from_text(raw_text)
        if fallback_faqs:
            print(f"✅ Pattern SUCCESS: Extracted {len(fallback_faqs)} FAQ items")
            return fallback_faqs
        else:
            print(f"❌ Pattern extraction returned empty list")
    except Exception as e:
        print(f"❌ Pattern error: {type(e).__name__}: {e}")
    
    # --- LAYER 3: EMERGENCY GENERATOR ---
    print("\n" + "-"*70)
    print("LAYER 3: Emergency Generator (Last Resort)")
    print("-"*70)
    
    try:
        emergency_faqs = emergency_faq_generator(raw_text)
        if emergency_faqs:
            print(f"✅ Emergency SUCCESS: Generated {len(emergency_faqs)} FAQ items")
            return emergency_faqs
        else:
            print(f"❌ Emergency generator returned empty list")
    except Exception as e:
        print(f"❌ Emergency error: {type(e).__name__}: {e}")
    
    # --- ALL FAILED ---
    print("\n" + "="*70)
    print("❌ CRITICAL FAILURE: All 3 layers failed to extract FAQ!")
    print("="*70)
    print(f"Input text length: {text_len:,} chars")
    print(f"Input preview: {raw_text[:500]}...")
    
    return []

def save_db(data):
    """Save FAQ data ke Firebase Firestore dengan proper error handling"""
    if not data: 
        print("⚠️ No data to save")
        return
    
    try:
        batch = db.batch()
        saved_count = 0
        
        for item in data:
            try:
                q = item.get("q", "").strip()
                a = item.get("a", "").strip()
                
                # Validate
                if not q or not a:
                    print(f"⚠️ Skipping invalid FAQ: q='{q[:30]}...' a='{a[:30]}...'")
                    continue
                
                doc_ref = db.collection("faq").document()
                batch.set(doc_ref, {
                    "q": q,
                    "a": a,
                    "source_url": item.get("source_url", ""),
                    "created_at": firestore.SERVER_TIMESTAMP
                })
                saved_count += 1
            except Exception as item_error:
                print(f"⚠️ Error processing FAQ item: {item_error}")
                continue
        
        # Commit batch
        batch.commit()
        print(f"✅ Successfully saved {saved_count}/{len(data)} FAQ items to Firebase!")
        
        if saved_count < len(data):
            print(f"   ({len(data) - saved_count} items skipped due to validation errors)")
        
        return saved_count
        
    except Exception as e:
        print(f"❌ Firebase batch commit error: {type(e).__name__}: {e}")
        raise

# ==========================================
# 4. CRAWLER (NAVIGASI OTOMATIS)
# ==========================================

def run_crawler(start_url, domain=None):
    """
    Crawler universal - accept ANY user input URL
    
    Args:
        start_url: URL provided by admin/user
        domain: If None, extract dari start_url
    """
    
    # Extract domain dari URL jika tidak disediakan
    if not domain:
        from urllib.parse import urlparse
        parsed = urlparse(start_url)
        domain = parsed.netloc
        print(f"🔗 Domain detected: {domain}")
    
    if start_url in visited_links:
        print(f"⏭️  Already visited, skipping...")
        return
    
    visited_links.add(start_url)
    print(f"\n🚀 SCRAPING: {start_url}")
    
    try:
        # 1. Scrape dengan intelligent content extraction
        content, soup = scrape_with_selenium(start_url)
        
        if not content:
            print(f"❌ Tidak ada content untuk diproses")
            return
        
        # 2. Process dengan AI & save ke Firebase
        faqs = process_to_faq(content, start_url)
        if faqs:
            save_db(faqs)
        
        # 3. Automatically find & crawl related links (optional, controlled)
        # Set limit untuk prevent infinite crawl
        if len(visited_links) < 10:  # Max 10 pages per session
            print(f"🔗 Mencari link terkait dalam domain...")
            links = soup.find_all('a', href=True)
            
            for link in links[:15]:  # Check max 15 links per page
                full_url = urljoin(start_url, link['href']).split('#')[0].rstrip('/')
                
                # Filter: same domain, no media files, not visited
                if (domain in full_url and 
                    not any(x in full_url.lower() for x in ['.pdf', '.jpg', '.png', '.zip', '.mp4', '.doc'])):
                    
                    if full_url not in visited_links:
                        run_crawler(full_url, domain)
        else:
            print(f"ℹ️  Limit crawling tercapai ({len(visited_links)} pages)")
    
    except Exception as e:
        print(f"❌ Error crawling {start_url}: {e}")

def scrape_single_url(url):
    """
    Scrape single URL tanpa recursive crawling (untuk one-time scrapes dari admin)
    """
    print(f"\n🎯 SCRAPE SINGLE URL: {url}")
    visited_links.clear()  # Reset visited untuk fresh scrape
    
    try:
        content, soup = scrape_with_selenium(url)
        
        if content:
            faqs = process_to_faq(content, url)
            if faqs:
                save_db(faqs)
                print(f"✅ Berhasil save {len(faqs)} FAQ!")
                return True
        
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

# ==========================================
# EXPORT FUNCTION - UNTUK DIPANGGIL DARI app.py
# ==========================================

def scrape_url(url):
    """
    Main function untuk scraping URL (dipanggil dari app.py /api/scrape endpoint)
    
    Returns: {success, faqs, message, error, debug}
    """
    print(f"\n{'='*70}")
    print(f"🚀 SCRAPE REQUEST INITIATED")
    print(f"{'='*70}")
    print(f"URL: {url}\n")
    
    debug_info = []
    
    try:
        # --- STEP 1: LOAD PAGE ---
        print(f"{'='*70}")
        print("STEP 1: Loading page with Selenium...")
        print(f"{'='*70}")
        
        visible_text, soup = scrape_with_selenium(url)
        
        if not visible_text:
            error_msg = "Gagal mengambil konten dari halaman"
            print(f"❌ {error_msg}")
            debug_info.append("ERROR: visible_text is None")
            return {
                "success": False,
                "faqs": [],
                "message": error_msg,
                "error": error_msg,
                "debug": " | ".join(debug_info)
            }
        
        text_len = len(visible_text)
        print(f"✅ Page loaded successfully")
        print(f"   Extracted {text_len:,} characters")
        print(f"   Preview: {visible_text[:200]}...\n")
        
        debug_info.append(f"Content loaded: {text_len:,} chars")
        
        # --- STEP 2: VALIDATE CONTENT ---
        print(f"{'='*70}")
        print("STEP 2: Validating content...")
        print(f"{'='*70}")
        
        if text_len < 50:
            error_msg = f"Content terlalu pendek ({text_len} chars, min 50)"
            print(f"❌ {error_msg}\n")
            debug_info.append(f"VALIDATION FAILED: {text_len} < 50")
            return {
                "success": False,
                "faqs": [],
                "message": error_msg,
                "error": error_msg,
                "debug": " | ".join(debug_info)
            }
        
        print(f"✅ Content validation passed")
        print(f"   Length: {text_len:,} chars >= 50 ✓\n")
        
        # --- STEP 3: PROCESS TO FAQ ---
        print(f"{'='*70}")
        print("STEP 3: Processing to FAQ (with 3-layer fallback)...")
        print(f"{'='*70}\n")
        
        faqs = process_to_faq(visible_text, url)
        
        if not faqs:
            error_msg = "All extraction methods failed (AI + Pattern + Emergency)"
            print(f"\n❌ {error_msg}")
            debug_info.append("CRITICAL: All 3 extraction layers failed")
            debug_info.append(f"Content: {visible_text[:300]}...")
            
            return {
                "success": False,
                "faqs": [],
                "message": error_msg,
                "error": error_msg,
                "debug": " | ".join(debug_info)
            }
        
        print(f"\n✅ FAQ generated successfully")
        print(f"   Generated {len(faqs)} FAQ items")
        for i, faq in enumerate(faqs[:3], 1):
            print(f"   [{i}] Q: {faq.get('q', '')[:50]}...")
        print()
        
        debug_info.append(f"✅ Generated FAQ: {len(faqs)} items")
        
        # --- STEP 4: SAVE TO FIREBASE ---
        print(f"{'='*70}")
        print("STEP 4: Saving to Firebase...")
        print(f"{'='*70}")
        
        try:
            save_count = save_db(faqs)
            print(f"✅ Saved {save_count} FAQ to Firebase\n")
            debug_info.append(f"✅ Firebase save: {save_count} items")
        except Exception as db_error:
            print(f"⚠️ Firebase save issue: {db_error}\n")
            debug_info.append(f"Firebase warning: {str(db_error)}")
        
        # --- SUCCESS ---
        print(f"{'='*70}")
        print(f"✅ SCRAPING COMPLETED SUCCESSFULLY")
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "faqs": faqs,
            "message": f"✅ Berhasil scraping! Ditemukan {len(faqs)} FAQ.",
            "error": None,
            "debug": " | ".join(debug_info)
        }
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR")
        print(f"{'='*70}")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {str(e)}")
        print(f"{'='*70}\n")
        
        import traceback
        traceback.print_exc()
        
        debug_info.append(f"EXCEPTION: {type(e).__name__}: {str(e)}")
        
        return {
            "success": False,
            "faqs": [],
            "message": f"Error: {type(e).__name__}",
            "error": str(e),
            "debug": " | ".join(debug_info)
        }


# ==========================================
# INTERACTIVE MODE - UNTUK TESTING
# ==========================================
if __name__ == "__main__":
    import sys
    
    # MODE 1: User provide URL sebagai argument
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
        print(f"🔥 SCRAPING URL: {target_url}")
        scrape_single_url(target_url)
    
    # MODE 2: Interactive input (untuk testing)
    else:
        print("\n" + "="*50)
        print("🤖 UNIVERSAL WEB SCRAPER")
        print("="*50)
        print("Pilih mode:")
        print("1. Scrape single URL (recommended untuk testing)")
        print("2. Crawl dengan follow links (experimental)")
        print("-"*50)
        
        mode = input("Pilih mode (1 atau 2): ").strip()
        
        if mode == "1":
            url = input("Masukkan target URL: ").strip()
            if url:
                scrape_single_url(url)
            else:
                print("❌ URL tidak valid")
        
        elif mode == "2":
            url = input("Masukkan starting URL: ").strip()
            if url:
                print("🔥 MEMULAI AUTO-CRAWLING... 🔥")
                run_crawler(url)
                print(f"\n✅ SELESAI! Total {len(visited_links)} pages visited")
            else:
                print("❌ URL tidak valid")
        
        else:
            print("❌ Mode tidak valid")