# 📡 Panduan API - Endpoint Reference & Testing

**Last Updated:** 6 Mei 2026

---

## 📋 Daftar Isi

1. [API Overview](#api-overview)
2. [Authentication & Security](#authentication--security)
3. [Chat Endpoint](#chat-endpoint)
4. [FAQ Management](#faq-management)
5. [Admin Endpoints](#admin-endpoints)
6. [Error Responses](#error-responses)
7. [Rate Limiting](#rate-limiting)
8. [Testing & cURL Examples](#testing--curl-examples)
9. [Webhook Integration](#webhook-integration)

---

## 🔍 API Overview

### Base URL

```
Development:  http://localhost:5000
Production:   https://api.chatbot-upj.com
```

### API Versioning

Current API version: **v1** (implicit, not in URL)

### Response Format

All endpoints return JSON format:

```json
{
  "status": "success|error",
  "data": {},
  "error": null,
  "timestamp": "2026-05-06T10:30:00Z",
  "request_id": "req_xyz123"
}
```

---

## 🔐 Authentication & Security

### Public Endpoints
- `POST /chat` - No authentication required

### Protected Endpoints
Require `Authorization` header:

```
Authorization: Bearer <ADMIN_SECRET_TOKEN>
```

### Header Requirements

```
Content-Type: application/json
Authorization: Bearer your-token-here (for protected endpoints)
User-Agent: YourApp/1.0
```

### Security Best Practices

1. **Never expose API keys** in client-side code
2. **Use HTTPS only** in production
3. **Rotate tokens** periodically
4. **Rate limit aggressive** clients
5. **Log all access** for audit trail
6. **Validate all inputs** on backend

---

## 💬 Chat Endpoint

### **POST /chat**

Main endpoint untuk chatbot interaksi.

#### Request

```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Apa saja jurusan di UPJ?",
    "history": [
      {
        "role": "user",
        "content": "Halo"
      },
      {
        "role": "assistant",
        "content": "Halo Kak! Apa yang bisa saya bantu?"
      }
    ]
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | ✅ | User chat message (max 500 chars) |
| `history` | array | ❌ | Previous chat history (max 4 messages) |
| `history[].role` | string | ✅ | "user" or "assistant" |
| `history[].content` | string | ✅ | Message content |

#### Response Success (200 OK)

```json
{
  "response": "<p>UPJ memiliki berbagai program studi di bidang Teknik, Bisnis, dan Sosial...</p><p>Link pendaftaran: https://pmb.upj.ac.id</p>",
  "timestamp": "2026-05-06T10:30:00Z"
}
```

#### Response Error (400 Bad Request)

```json
{
  "error": "Message is required",
  "status": 400
}
```

```json
{
  "error": "Message too long (max 500 chars)",
  "status": 400
}
```

#### Response Error (429 Too Many Requests)

```json
{
  "error": "Rate limit exceeded. Max 10 requests per minute",
  "retry_after": 45
}
```

#### Response Error (500 Internal Server Error)

```json
{
  "error": "Internal server error",
  "request_id": "req_xyz123"
}
```

#### Rate Limit

- **Limit:** 10 requests per minute per IP
- **Headers:** Retry-After (seconds)

#### TypeScript Example

```typescript
interface ChatRequest {
  message: string
  history?: { role: 'user' | 'assistant'; content: string }[]
}

interface ChatResponse {
  response: string
  timestamp: string
}

async function chat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch('http://localhost:5000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`)
  }

  return response.json()
}

// Usage
const response = await chat({
  message: 'Berapa biaya pendaftaran?',
  history: [
    { role: 'user', content: 'Halo' },
    { role: 'assistant', content: 'Halo Kak!' }
  ]
})

console.log(response.response)
```

#### Python Example

```python
import requests

def chat(message: str, history: list = None) -> str:
    url = 'http://localhost:5000/chat'
    payload = {
        'message': message,
        'history': history or []
    }
    
    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    
    return response.json()['response']

# Usage
response = chat(
    'Apa persyaratan pendaftaran?',
    history=[
        {'role': 'user', 'content': 'Halo'},
        {'role': 'assistant', 'content': 'Halo Kak!'}
    ]
)
print(response)
```

---

## 📚 FAQ Management

### **GET /api/faq**

Get semua FAQ.

```bash
curl http://localhost:5000/api/faq
```

**Response:**
```json
{
  "status": "success",
  "faqs": [
    {
      "id": "faq_001",
      "question": "Apa itu UPJ?",
      "answer": "Universitas Pembangunan Jaya adalah...",
      "category": "Academic",
      "tags": ["umum"],
      "created_at": "2026-05-01T10:00:00Z"
    }
  ],
  "total": 45
}
```

---

### **GET /api/faq/<faq_id>**

Get FAQ by ID.

```bash
curl http://localhost:5000/api/faq/faq_001
```

**Response:**
```json
{
  "status": "success",
  "faq": {
    "id": "faq_001",
    "question": "Apa itu UPJ?",
    "answer": "...",
    "category": "Academic"
  }
}
```

---

### **POST /api/faq**

Create new FAQ.

```bash
curl -X POST http://localhost:5000/api/faq \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Berapa biaya kuliah?",
    "answer": "Biaya kuliah bervariasi tergantung program...",
    "category": "Finance",
    "tags": ["biaya", "keuangan"]
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | ✅ | FAQ question |
| `answer` | string | ✅ | FAQ answer |
| `category` | string | ✅ | FAQ category |
| `tags` | array | ❌ | Tags for search |

**Response:**
```json
{
  "status": "created",
  "faq_id": "faq_046"
}
```

---

### **PUT /api/faq/<faq_id>**

Update existing FAQ.

```bash
curl -X PUT http://localhost:5000/api/faq/faq_001 \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Apa saja program studi di UPJ?",
    "answer": "UPJ memiliki program studi baru di bidang..."
  }'
```

**Response:**
```json
{
  "status": "updated",
  "faq_id": "faq_001"
}
```

---

### **DELETE /api/faq/<faq_id>**

Delete FAQ.

```bash
curl -X DELETE http://localhost:5000/api/faq/faq_001 \
  -H "Authorization: Bearer your-token"
```

**Response:**
```json
{
  "status": "deleted",
  "faq_id": "faq_001"
}
```

---

### **POST /api/faq/search**

Search FAQ dengan query.

```bash
curl -X POST http://localhost:5000/api/faq/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "biaya",
    "category": "Finance",
    "limit": 10
  }'
```

**Response:**
```json
{
  "status": "success",
  "results": [...],
  "total": 5
}
```

---

## ⚙️ Admin Endpoints

### **GET /refresh-cache**

Refresh FAQ cache dari Firestore.

```bash
curl "http://localhost:5000/refresh-cache?token=your-secret-token"
```

**Response:**
```json
{
  "status": "success",
  "message": "Cache refreshed successfully",
  "faq_count": 45,
  "timestamp": "2026-05-06T10:30:00Z",
  "duration_ms": 850
}
```

---

### **POST /api/scrape**

Scrape URL dan extract FAQ.

```bash
curl -X POST http://localhost:5000/api/scrape \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://upj.ac.id/program-studi",
    "batch": false
  }'
```

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Target URL to scrape |
| `batch` | boolean | Auto-save to Firestore if true |

**Response:**
```json
{
  "status": "preview",
  "source_url": "https://upj.ac.id/program-studi",
  "extracted_faq": [
    {
      "question": "Apa itu Program S1?",
      "answer": "Program sarjana selama 4 tahun...",
      "category": "Academic"
    }
  ],
  "count": 5
}
```

---

### **GET /api/chat-logs**

Get chat logs dengan filter.

```bash
curl "http://localhost:5000/api/chat-logs?limit=50&offset=0" \
  -H "Authorization: Bearer your-token"
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Results per page (default 50, max 100) |
| `offset` | int | Starting offset (default 0) |
| `start_date` | ISO string | Filter from date |
| `end_date` | ISO string | Filter to date |

**Response:**
```json
{
  "status": "success",
  "logs": [
    {
      "id": "log_001",
      "user_message": "Apa saja jurusan?",
      "assistant_response": "...",
      "timestamp": "2026-05-06T10:30:00Z",
      "response_time_ms": 1250
    }
  ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

---

### **GET /api/analytics**

Get chat analytics.

```bash
curl "http://localhost:5000/api/analytics?days=30" \
  -H "Authorization: Bearer your-token"
```

**Response:**
```json
{
  "status": "success",
  "period_days": 30,
  "total_chats": 1234,
  "total_users": 456,
  "avg_response_time_ms": 1250,
  "avg_rating": 4.5,
  "top_questions": [
    {
      "question": "Berapa biaya?",
      "count": 150
    }
  ],
  "daily_stats": [
    {
      "date": "2026-05-06",
      "chat_count": 45,
      "avg_rating": 4.6
    }
  ]
}
```

---

### **GET /api/settings**

Get backend settings.

```bash
curl "http://localhost:5000/api/settings" \
  -H "Authorization: Bearer your-token"
```

**Response:**
```json
{
  "status": "success",
  "settings": {
    "faq_cache_ttl_minutes": 60,
    "rate_limit_chat": "10/minute",
    "rate_limit_scrape": "5/minute",
    "gemini_model": "gemini-2.5-flash",
    "maintenance_mode": false
  }
}
```

---

### **PUT /api/settings**

Update backend settings.

```bash
curl -X PUT http://localhost:5000/api/settings \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "faq_cache_ttl_minutes": 120,
    "maintenance_mode": false
  }'
```

---

## ⚠️ Error Responses

### Error Code Reference

| Code | Meaning | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Maintenance or temporary outage |

### Error Response Format

```json
{
  "status": "error",
  "error": "Message describing the error",
  "error_code": "INVALID_REQUEST",
  "request_id": "req_xyz123",
  "timestamp": "2026-05-06T10:30:00Z"
}
```

### Common Errors

#### 1. Invalid Message

```json
{
  "error": "Message is required",
  "error_code": "EMPTY_MESSAGE"
}
```

#### 2. Rate Limit Exceeded

```json
{
  "error": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 45
}
```

#### 3. Unauthorized

```json
{
  "error": "Invalid or missing token",
  "error_code": "UNAUTHORIZED"
}
```

#### 4. Firebase Error

```json
{
  "error": "Database connection failed",
  "error_code": "DATABASE_ERROR",
  "request_id": "req_xyz123"
}
```

---

## 🚦 Rate Limiting

### Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/chat` | 10 | 1 minute |
| `/api/scrape` | 5 | 1 minute |
| `/api/faq` | 100 | 1 minute |
| `/api/chat-logs` | 30 | 1 minute |

### Rate Limit Headers

Setiap response mencakup headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1620000000
```

### Handling Rate Limit

```typescript
// Exponential backoff
async function chatWithRetry(message: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await chat(message)
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.response.headers['retry-after']
        const waitMs = (parseInt(retryAfter) || 2 ** attempt) * 1000
        
        console.log(`Rate limited. Waiting ${waitMs}ms...`)
        await new Promise(r => setTimeout(r, waitMs))
      } else {
        throw error
      }
    }
  }
}
```

---

## 🧪 Testing & cURL Examples

### Basic Chat Test

```bash
# Simple chat
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Halo"}'

# With history
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Berapa biaya?",
    "history": [
      {"role":"user","content":"Halo"},
      {"role":"assistant","content":"Halo Kak!"}
    ]
  }'
```

### Admin Operations

```bash
# Refresh cache
curl "http://localhost:5000/refresh-cache?token=your-token"

# Create FAQ
curl -X POST http://localhost:5000/api/faq \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "question":"Test?",
    "answer":"Test answer",
    "category":"Test"
  }'

# Scrape URL
curl -X POST http://localhost:5000/api/scrape \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://upj.ac.id"}'
```

### Test Script (Bash)

```bash
#!/bin/bash

API_URL="http://localhost:5000"
TOKEN="your-secret-token"

# Test basic chat
echo "Testing chat endpoint..."
curl -X POST $API_URL/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Halo"}' | jq .

# Test cache refresh
echo "Testing cache refresh..."
curl "$API_URL/refresh-cache?token=$TOKEN" | jq .

# Test scrape
echo "Testing scrape..."
curl -X POST $API_URL/api/scrape \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://upj.ac.id"}' | jq .
```

### Postman Collection

```json
{
  "info": {
    "name": "Chatbot Admisi UPJ API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Chat",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\"message\":\"Halo\"}"
        },
        "url": {"raw": "http://localhost:5000/chat", "protocol": "http"}
      }
    },
    {
      "name": "Refresh Cache",
      "request": {
        "method": "GET",
        "url": {"raw": "http://localhost:5000/refresh-cache?token=your-token"}
      }
    }
  ]
}
```

---

## 🔗 Webhook Integration

### Webhook Events

Sistem dapat mengirim webhook untuk events:

```
- chat.received
- chat.answered
- faq.created
- faq.updated
- lead.captured
```

### Setup Webhook

```bash
curl -X POST http://localhost:5000/api/webhooks \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/webhook",
    "events": ["chat.answered", "lead.captured"],
    "active": true
  }'
```

### Webhook Payload

```json
{
  "event": "chat.answered",
  "timestamp": "2026-05-06T10:30:00Z",
  "data": {
    "user_message": "Berapa biaya?",
    "assistant_response": "Biaya adalah...",
    "response_time_ms": 1250
  }
}
```

---

## 📖 SDK & Libraries

### JavaScript/TypeScript

```bash
npm install chatbot-upj-sdk
```

```typescript
import { ChatbotClient } from 'chatbot-upj-sdk'

const client = new ChatbotClient({
  baseURL: 'http://localhost:5000',
  adminToken: 'your-token' // optional
})

const response = await client.chat('Halo')
console.log(response)
```

### Python

```bash
pip install chatbot-upj
```

```python
from chatbot_upj import ChatbotClient

client = ChatbotClient(
    base_url='http://localhost:5000',
    admin_token='your-token'  # optional
)

response = client.chat('Halo')
print(response)
```

---

## 📞 Support

- **Documentation:** [API Docs](https://docs.chatbot-upj.com)
- **Issues:** [GitHub Issues](https://github.com/yourrepo/issues)
- **Email:** support@upj.ac.id

---

**Document Version:** 1.0
**Last Updated:** 6 Mei 2026
