# ⚙️ Panduan Backend - Flask Python API

**Last Updated:** 6 Mei 2026

---

## 📋 Daftar Isi

1. [Struktur Backend](#struktur-backend)
2. [Setup & Installation](#setup--installation)
3. [File Utama - app.py](#file-utama---apppy)
4. [Auto Scraper](#auto-scraper)
5. [Configuration & Environment](#configuration--environment)
6. [Database Integration](#database-integration)
7. [AI Model Integration](#ai-model-integration)
8. [Error Handling & Logging](#error-handling--logging)
9. [Performance & Caching](#performance--caching)
10. [Testing & Debugging](#testing--debugging)

---

## 📁 Struktur Backend

```
backend/
├── app.py                    # 🚀 Flask server utama
├── auto_scraper.py          # 🕷️ Web scraper untuk FAQ
├── cek_koneksi.py           # 🔍 Diagnosis koneksi
├── prompt_rules.txt         # 📝 Chatbot system prompt
├── requirements.txt         # 📦 Python dependencies
├── firebase-key.json        # 🔐 Firebase service account
├── .env                     # 🔑 Environment variables
├── Procfile                 # 🚀 Deployment config
├── install_backend.sh       # 📦 Setup script
└── .venv/                   # 🐍 Virtual environment
```

---

## 🚀 Setup & Installation

### Prerequisites

- Python 3.11+ (recommended 3.13)
- pip 23+
- Git

### Installation Steps

#### 1. Clone Repository
```bash
git clone https://github.com/yourrepo/Chatbot-Ai-UPJ.git
cd Chatbot-Ai-UPJ/backend
```

#### 2. Create Virtual Environment

**Windows:**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**Linux/macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

#### 3. Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 4. Configure Environment

Buat file `.env`:
```env
# =====================================================
# FIREBASE CONFIGURATION
# =====================================================
FIREBASE_CREDENTIALS_PATH=./firebase-key.json

# =====================================================
# GEMINI API CONFIGURATION (Multi-Key Failover)
# =====================================================
# Primary API Key
GEMINI_API_KEY_1=sk-proj-xxxxxxxxxxxxxxxxx
GEMINI_MODEL_1=gemini-2.5-flash

# Secondary API Key (fallback)
GEMINI_API_KEY_2=sk-proj-yyyyyyyyyyyyyyyyy
GEMINI_MODEL_2=gemini-2.5-flash

# Tertiary API Key (additional fallback)
GEMINI_API_KEY_3=sk-proj-zzzzzzzzzzzzzzzzz
GEMINI_MODEL_3=gemini-2.5-flash

# Default model (used if no specific model set)
GEMINI_MODEL=gemini-2.5-flash

# =====================================================
# FLASK CONFIGURATION
# =====================================================
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_PORT=5000
FLASK_HOST=127.0.0.1

# =====================================================
# ADMIN & SECURITY
# =====================================================
ADMIN_SECRET_TOKEN=your-secret-token-here-min-32-chars

# =====================================================
# CORS CONFIGURATION
# =====================================================
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# =====================================================
# RATE LIMITING
# =====================================================
RATE_LIMIT_CHAT=10/minute
RATE_LIMIT_SCRAPE=5/minute

# =====================================================
# CACHE CONFIGURATION
# =====================================================
FAQ_CACHE_TTL_MINUTES=60

# =====================================================
# LOGGING
# =====================================================
LOG_LEVEL=INFO
LOG_FILE=app.log
```

#### 5. Setup Firebase Service Account

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project Anda
3. Go to: Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Rename file ke `firebase-key.json`
6. Tempatkan di folder `backend/`

**Struktur firebase-key.json:**
```json
{
  "type": "service_account",
  "project_id": "chatbot-upj",
  "private_key_id": "xxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxx@chatbot-upj.iam.gserviceaccount.com",
  "client_id": "xxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

#### 6. Run Backend Server
```bash
python app.py
# Output: Running on http://127.0.0.1:5000
```

---

## 🚀 File Utama - app.py

### Overview

Main Flask application dengan endpoints untuk chatbot, FAQ management, scraping, dan caching.

### Key Components

#### 1. Initialization

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
import firebase_admin
from google import genai
import logging

# Setup
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv('CORS_ORIGINS', '*')}})
limiter = Limiter(app=app, key_func=get_remote_address)

logger = logging.getLogger(__name__)
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))
```

#### 2. Firebase Connection

```python
def initialize_firebase():
    """Initialize Firebase Admin SDK."""
    try:
        cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH', './firebase-key.json')
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Firebase init error: {e}")
        raise

initialize_firebase()
db = firestore.client()
```

#### 3. FAQ Caching System

```python
FAQ_CACHE = {}
CACHE_TIMESTAMP = None
CACHE_TTL_MINUTES = int(os.getenv('FAQ_CACHE_TTL_MINUTES', 60))

def get_faq_cache():
    """Get FAQ dari cache dengan TTL check."""
    global FAQ_CACHE, CACHE_TIMESTAMP
    
    current_time = time.time()
    cache_age_minutes = (current_time - CACHE_TIMESTAMP) / 60 if CACHE_TIMESTAMP else float('inf')
    
    # Refresh jika cache expired
    if cache_age_minutes > CACHE_TTL_MINUTES:
        logger.info("Cache expired. Refreshing from Firestore...")
        refresh_faq_cache()
    
    return FAQ_CACHE

def refresh_faq_cache():
    """Reload FAQ dari Firestore ke memory cache."""
    global FAQ_CACHE, CACHE_TIMESTAMP
    
    try:
        docs = db.collection('faqs').where('status', '==', 'active').stream()
        FAQ_CACHE = {}
        
        for doc in docs:
            faq_data = doc.to_dict()
            FAQ_CACHE[doc.id] = {
                'question': faq_data.get('question'),
                'answer': faq_data.get('answer'),
                'category': faq_data.get('category'),
                'tags': faq_data.get('tags', [])
            }
        
        CACHE_TIMESTAMP = time.time()
        logger.info(f"FAQ cache refreshed. Total FAQs: {len(FAQ_CACHE)}")
        
    except Exception as e:
        logger.error(f"Cache refresh error: {e}")
        raise
```

#### 4. System Prompt Generation

```python
def load_prompt_rules():
    """Load system prompt template dari file."""
    try:
        with open('prompt_rules.txt', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        logger.warning("prompt_rules.txt not found. Using default.")
        return "You are a helpful chatbot assistant for UPJ."

PROMPT_TEMPLATE = load_prompt_rules()

def generate_system_prompt():
    """Generate dynamic system prompt dengan FAQ current."""
    faq_cache = get_faq_cache()
    
    # Format FAQ ke knowledge base
    knowledge_base = "\n".join([
        f"Q: {faq['question']}\nA: {faq['answer']}"
        for faq in faq_cache.values()
    ])
    
    # Replace placeholder di template
    system_prompt = PROMPT_TEMPLATE.replace('{knowledge_base}', knowledge_base)
    
    return system_prompt
```

---

### API Endpoints

#### **POST /chat**
Main chatbot endpoint.

```python
@app.route('/chat', methods=['POST'])
@limiter.limit(os.getenv('RATE_LIMIT_CHAT', '10/minute'))
def chat():
    """
    Handle user chat message dan return AI response.
    
    Request:
    {
      "message": "Apa saja jurusan di UPJ?",
      "history": [
        {"role": "user", "content": "Halo"},
        {"role": "assistant", "content": "Halo Kak!"}
      ]
    }
    
    Response:
    {
      "response": "<p>UPJ memiliki jurusan...</p>",
      "timestamp": "2026-05-06T10:30:00Z"
    }
    """
    try:
        # Get request data
        data = request.get_json()
        message = data.get('message', '').strip()
        history = data.get('history', [])
        
        # Validate
        if not message:
            return {'error': 'Message is required'}, 400
        
        if len(message) > 500:
            return {'error': 'Message too long (max 500 chars)'}, 400
        
        # Generate system prompt
        system_prompt = generate_system_prompt()
        
        # Call Gemini
        response_text = call_gemini_chat(
            message=message,
            history=history,
            system_prompt=system_prompt
        )
        
        # Sanitize response
        response_html = sanitize_response(response_text)
        
        # Log to Firestore
        save_chat_log(
            user_message=message,
            assistant_response=response_html,
            model='gemini-2.5-flash'
        )
        
        return {
            'response': response_html,
            'timestamp': datetime.now().isoformat()
        }, 200
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return {'error': 'Internal server error'}, 500
```

#### **GET /refresh-cache**
Refresh FAQ cache dari Firestore.

```python
@app.route('/refresh-cache', methods=['GET'])
def refresh_cache():
    """
    Refresh FAQ cache dari Firestore.
    
    Query: ?token=<ADMIN_SECRET_TOKEN>
    """
    try:
        # Verify token
        token = request.args.get('token')
        if token != os.getenv('ADMIN_SECRET_TOKEN'):
            return {'error': 'Unauthorized'}, 401
        
        start_time = time.time()
        refresh_faq_cache()
        duration_ms = (time.time() - start_time) * 1000
        
        return {
            'status': 'success',
            'message': 'Cache refreshed successfully',
            'faq_count': len(FAQ_CACHE),
            'timestamp': datetime.now().isoformat(),
            'duration_ms': round(duration_ms, 2)
        }, 200
        
    except Exception as e:
        logger.error(f"Cache refresh error: {e}")
        return {'error': str(e)}, 500
```

#### **POST /api/scrape**
Scrape URL dan extract FAQ.

```python
@app.route('/api/scrape', methods=['POST'])
@limiter.limit(os.getenv('RATE_LIMIT_SCRAPE', '5/minute'))
def scrape_endpoint():
    """
    Scrape URL dan extract FAQ JSON.
    
    Headers: Authorization: Bearer <ADMIN_SECRET_TOKEN>
    
    Request:
    {"url": "https://upj.ac.id/program-studi"}
    
    Response:
    {
      "status": "preview",
      "source_url": "...",
      "extracted_faq": [...]
    }
    """
    try:
        # Verify authorization
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if token != os.getenv('ADMIN_SECRET_TOKEN'):
            return {'error': 'Unauthorized'}, 401
        
        # Get URL
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return {'error': 'URL is required'}, 400
        
        # Scrape and extract
        faq_list = scrape_url(url)
        
        return {
            'status': 'preview',
            'source_url': url,
            'extracted_faq': faq_list,
            'count': len(faq_list)
        }, 200
        
    except Exception as e:
        logger.error(f"Scrape error: {e}")
        return {'error': str(e)}, 500
```

#### **POST /api/faq**
Create FAQ.

```python
@app.route('/api/faq', methods=['POST'])
def create_faq():
    """Create new FAQ."""
    try:
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if token != os.getenv('ADMIN_SECRET_TOKEN'):
            return {'error': 'Unauthorized'}, 401
        
        data = request.get_json()
        
        doc_ref = db.collection('faqs').add({
            'question': data.get('question'),
            'answer': data.get('answer'),
            'category': data.get('category'),
            'tags': data.get('tags', []),
            'status': 'active',
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return {
            'status': 'created',
            'faq_id': doc_ref[1].id
        }, 201
        
    except Exception as e:
        logger.error(f"Create FAQ error: {e}")
        return {'error': str(e)}, 500
```

---

#### **PUT /api/faq/<faq_id>**
Update FAQ.

```python
@app.route('/api/faq/<faq_id>', methods=['PUT'])
def update_faq(faq_id):
    """Update existing FAQ."""
    try:
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if token != os.getenv('ADMIN_SECRET_TOKEN'):
            return {'error': 'Unauthorized'}, 401
        
        data = request.get_json()
        
        db.collection('faqs').document(faq_id).update({
            'question': data.get('question'),
            'answer': data.get('answer'),
            'category': data.get('category'),
            'tags': data.get('tags', []),
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return {'status': 'updated'}, 200
        
    except Exception as e:
        logger.error(f"Update FAQ error: {e}")
        return {'error': str(e)}, 500
```

---

### Helper Functions

#### Call Gemini API

```python
def call_gemini_chat(message, history, system_prompt):
    """Call Google Gemini API dengan multi-key failover."""
    
    # Build message history
    messages = []
    
    # Add system prompt
    messages.append({'role': 'user', 'content': system_prompt})
    messages.append({'role': 'model', 'content': 'Baik, saya siap membantu!'})
    
    # Add chat history
    for msg in history:
        messages.append({
            'role': 'user' if msg['role'] == 'user' else 'model',
            'content': msg['content']
        })
    
    # Add current message
    messages.append({'role': 'user', 'content': message})
    
    # Try each Gemini client with failover
    errors = []
    
    for client_config in GEMINI_CLIENTS:
        try:
            response = client_config['client'].models.generate_content(
                model=client_config['model'],
                contents=messages,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=1024
                )
            )
            
            return response.text
            
        except Exception as e:
            logger.warning(f"Gemini error with key: {e}")
            errors.append(str(e))
            continue
    
    # All clients failed
    raise Exception(f"All Gemini clients failed: {errors}")
```

#### Sanitize Response

```python
def sanitize_response(text):
    """Format dan sanitasi response HTML."""
    
    # Remove dangerous tags
    soup = BeautifulSoup(text, 'html.parser')
    
    # Allow safe tags only
    allowed_tags = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a']
    for tag in soup.find_all():
        if tag.name not in allowed_tags:
            tag.unwrap()
    
    # Clean output
    html = str(soup)
    
    # Add safe target for links
    html = html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
    
    return html
```

#### Save Chat Log

```python
def save_chat_log(user_message, assistant_response, model):
    """Save chat interaction ke Firestore."""
    
    try:
        db.collection('chat_logs').add({
            'user_message': user_message,
            'assistant_response': assistant_response,
            'model_used': model,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'user_ip': request.remote_addr,
            'response_time_ms': 0
        })
    except Exception as e:
        logger.error(f"Error saving chat log: {e}")
```

---

## 🕷️ Auto Scraper

### File: `auto_scraper.py`

```python
from bs4 import BeautifulSoup
import requests
from google import genai
import firebase_admin
from firebase_admin import firestore

def scrape_url(url):
    """
    Scrape URL dan extract FAQ JSON.
    
    Args:
        url: Target URL to scrape
        
    Returns:
        list: Extracted FAQ items
    """
    try:
        # Fetch page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract text from relevant tags
        text_content = []
        for tag in soup.find_all(['p', 'h1', 'h2', 'h3', 'li']):
            text = tag.get_text(strip=True)
            if text:
                text_content.append(text)
        
        content = ' '.join(text_content)
        
        # Call Gemini to extract FAQ
        client = genai.Client(api_key=os.getenv('GEMINI_API_KEY_1'))
        
        prompt = f"""
        Extract FAQ from this content. Return JSON array:
        [
          {{"question": "...", "answer": "...", "category": "..."}},
          ...
        ]
        
        Content:
        {content[:5000]}  // Limit to 5000 chars
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        # Parse response
        import json
        faq_json = json.loads(response.text)
        
        return faq_json
        
    except Exception as e:
        logger.error(f"Scrape error: {e}")
        raise

def save_faq_batch(faq_list):
    """Save multiple FAQ ke Firestore."""
    
    db = firestore.client()
    batch = db.batch()
    
    for faq in faq_list:
        doc_ref = db.collection('faqs').document()
        batch.set(doc_ref, {
            'question': faq['question'],
            'answer': faq['answer'],
            'category': faq['category'],
            'status': 'active',
            'created_at': firestore.SERVER_TIMESTAMP
        })
    
    batch.commit()
```

### Usage

```bash
python auto_scraper.py --urls "https://upj.ac.id/..." "https://upj.ac.id/..."
```

---

## 🔧 Configuration & Environment

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `FIREBASE_CREDENTIALS_PATH` | `./firebase-key.json` | Path to Firebase service account |
| `GEMINI_API_KEY_1` | Required | Primary Gemini API key |
| `GEMINI_API_KEY_2` | Optional | Secondary Gemini API key (failover) |
| `GEMINI_API_KEY_3` | Optional | Tertiary Gemini API key (failover) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Default Gemini model |
| `FLASK_ENV` | `production` | Flask environment |
| `FLASK_DEBUG` | `False` | Enable Flask debug mode |
| `FLASK_PORT` | `5000` | Flask server port |
| `ADMIN_SECRET_TOKEN` | Required | Secret token untuk admin endpoints |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `RATE_LIMIT_CHAT` | `10/minute` | Rate limit untuk `/chat` endpoint |
| `RATE_LIMIT_SCRAPE` | `5/minute` | Rate limit untuk `/api/scrape` endpoint |
| `FAQ_CACHE_TTL_MINUTES` | `60` | Cache validity in minutes |
| `LOG_LEVEL` | `INFO` | Logging level |

---

## 🔥 Database Integration

### Firestore Collections

#### FAQs Collection
```python
# Add FAQ
db.collection('faqs').add({
    'question': 'Apa itu UPJ?',
    'answer': 'UPJ adalah universitas swasta...',
    'category': 'Academic',
    'tags': ['umum', 'kampus'],
    'status': 'active',
    'created_at': firestore.SERVER_TIMESTAMP
})

# Query active FAQs
docs = db.collection('faqs').where('status', '==', 'active').stream()

# Search
docs = db.collection('faqs').where('tags', 'array-contains', 'jurusan').stream()
```

#### Chat Logs Collection
```python
# Add log
db.collection('chat_logs').add({
    'user_message': 'Berapa biaya?',
    'assistant_response': '<p>Biaya adalah...</p>',
    'timestamp': firestore.SERVER_TIMESTAMP,
    'user_ip': request.remote_addr,
    'model_used': 'gemini-2.5-flash'
})

# Query range
docs = db.collection('chat_logs')\
    .where('timestamp', '>=', start_date)\
    .where('timestamp', '<=', end_date)\
    .order_by('timestamp', direction=firestore.Query.DESCENDING)\
    .stream()
```

---

## 🤖 AI Model Integration

### Gemini API

#### Multi-Key Failover System

```python
GEMINI_CLIENTS = [
    {
        'client': genai.Client(api_key=KEY_1),
        'model': 'gemini-2.5-flash'
    },
    {
        'client': genai.Client(api_key=KEY_2),
        'model': 'gemini-2.5-flash'
    },
    {
        'client': genai.Client(api_key=KEY_3),
        'model': 'gemini-2.5-flash'
    }
]

def call_gemini_with_failover(prompt):
    """Try each API key until success."""
    for config in GEMINI_CLIENTS:
        try:
            response = config['client'].models.generate_content(
                model=config['model'],
                contents=prompt
            )
            return response.text
        except Exception as e:
            logger.warning(f"Failover to next key: {e}")
            continue
    
    raise Exception("All Gemini API keys failed")
```

#### Content Generation Config

```python
config = types.GenerateContentConfig(
    temperature=0.7,      # Creativity (0-1)
    top_p=0.95,          # Diversity (0-1)
    top_k=40,            # Token pool size
    max_output_tokens=1024,  # Max response length
    stop_sequences=None
)
```

---

## 🐛 Error Handling & Logging

### Logging Setup

```python
import logging
from logging.handlers import RotatingFileHandler

# Create logger
logger = logging.getLogger(__name__)
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# File handler (rotate every 10MB)
file_handler = RotatingFileHandler(
    'app.log',
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5
)

# Console handler
console_handler = logging.StreamHandler()

# Formatter
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Add handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)
```

### Error Handling Patterns

```python
# Try-Except with logging
try:
    result = risky_operation()
except ValueError as e:
    logger.error(f"Validation error: {e}", exc_info=True)
    return {'error': 'Invalid input'}, 400
except Exception as e:
    logger.critical(f"Unexpected error: {e}", exc_info=True)
    return {'error': 'Internal server error'}, 500

# Custom exceptions
class ChatbotException(Exception):
    """Base exception for chatbot."""
    pass

class FirebaseException(ChatbotException):
    """Firebase-related error."""
    pass

class GeminiException(ChatbotException):
    """Gemini API error."""
    pass
```

---

## ⚡ Performance & Caching

### FAQ Cache Strategy

```python
# In-memory cache dengan TTL
class FAQCache:
    def __init__(self, ttl_minutes=60):
        self.data = {}
        self.timestamp = None
        self.ttl_minutes = ttl_minutes
    
    def is_expired(self):
        if not self.timestamp:
            return True
        age_minutes = (time.time() - self.timestamp) / 60
        return age_minutes > self.ttl_minutes
    
    def get(self):
        if self.is_expired():
            self.refresh()
        return self.data
    
    def refresh(self):
        """Reload dari Firestore."""
        docs = db.collection('faqs').where('status', '==', 'active').stream()
        self.data = {doc.id: doc.to_dict() for doc in docs}
        self.timestamp = time.time()

faq_cache = FAQCache(ttl_minutes=60)
```

### Query Optimization

```python
# ✅ Good - with index
query = db.collection('faqs')\
    .where('status', '==', 'active')\
    .where('category', '==', 'Academic')\
    .order_by('created_at', direction=firestore.Query.DESCENDING)

# ❌ Bad - too many results
docs = db.collection('chat_logs').stream()  # All documents!

# ✅ Better - with pagination
page_size = 100
query = db.collection('chat_logs')\
    .order_by('timestamp', direction=firestore.Query.DESCENDING)\
    .limit(page_size)
```

### Request Timeout

```python
# Set timeout untuk external APIs
requests.get(url, timeout=10)  # 10 seconds

# Async operations untuk long tasks
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=5)
future = executor.submit(scrape_url, url)
result = future.result(timeout=30)
```

---

## 🧪 Testing & Debugging

### Unit Testing

```python
import pytest
from app import app, call_gemini_chat

@pytest.fixture
def client():
    return app.test_client()

def test_chat_endpoint(client):
    response = client.post('/chat', json={
        'message': 'Halo',
        'history': []
    })
    assert response.status_code == 200
    assert 'response' in response.json

def test_chat_validation(client):
    # Empty message
    response = client.post('/chat', json={'message': ''})
    assert response.status_code == 400
    
    # Too long message
    response = client.post('/chat', json={
        'message': 'x' * 501
    })
    assert response.status_code == 400
```

### Debugging Techniques

#### 1. Flask Shell
```bash
flask shell
>>> from app import db
>>> docs = db.collection('faqs').stream()
>>> [doc.to_dict() for doc in docs]
```

#### 2. Print Debugging
```python
print(f"Debug: FAQ cache size = {len(FAQ_CACHE)}")
print(f"Debug: Request data = {request.json}")
```

#### 3. Logging
```python
logger.debug("Detailed debug info")
logger.info("General info")
logger.warning("Warning message")
logger.error("Error occurred", exc_info=True)
logger.critical("Critical failure")
```

#### 4. Breakpoints
```python
import pdb

def problematic_function():
    pdb.set_trace()  # Execution stops here
    result = some_operation()
    return result

# Run with: python app.py
```

---

### Common Errors & Solutions

#### Firebase Connection Failed
```python
# Solution: Check firebase-key.json path
FIREBASE_CREDENTIALS_PATH = os.path.abspath('./firebase-key.json')
```

#### Gemini API Key Invalid
```python
# Solution: Verify API key format
# Should start with: sk-proj-
# Test with: https://aistudio.google.com
```

#### Rate Limit Exceeded
```python
# Solution: Implement retry with exponential backoff
import time
from functools import wraps

def retry_on_ratelimit(max_retries=3):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except RateLimitError:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.warning(f"Rate limited. Waiting {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        raise
        return wrapper
    return decorator
```

---

## 📖 Useful Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [Firebase Admin Python SDK](https://firebase.google.com/docs/database/admin/start?hl=en&authuser=0)
- [Google Generative AI Python](https://github.com/google-gemini/python-client)
- [BeautifulSoup Documentation](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)

---

**Document Version:** 1.0
**Last Updated:** 6 Mei 2026
