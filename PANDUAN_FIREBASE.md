# 🔥 Panduan Firebase - Setup & Configuration

**Last Updated:** 6 Mei 2026

---

## 📋 Daftar Isi

1. [Firebase Setup](#firebase-setup)
2. [Firestore Database](#firestore-database)
3. [Firebase Authentication](#firebase-authentication)
4. [Security Rules](#security-rules)
5. [Indexes & Performance](#indexes--performance)
6. [Backup & Recovery](#backup--recovery)
7. [Monitoring & Analytics](#monitoring--analytics)
8. [Cost Optimization](#cost-optimization)
9. [Troubleshooting](#troubleshooting)

---

## 🚀 Firebase Setup

### Prerequisites

- Google Cloud Project
- Firebase Project
- Admin privileges

### Step 1: Create Firebase Project

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Enter project name: `chatbot-upj`
4. Select country: Indonesia
5. Create Firebase project

### Step 2: Enable Services

#### Firestore Database
1. Go to: Build → Firestore Database
2. Click "Create database"
3. Start in **Test mode** (untuk development)
4. Select region: `asia-southeast2` (Jakarta)
5. Create database

#### Authentication
1. Go to: Build → Authentication
2. Click "Get started"
3. Enable providers:
   - Google
   - Email/Password (optional)

#### Storage (Optional)
1. Go to: Build → Storage
2. Click "Get started"
3. Start in test mode
4. Select region: `asia-southeast2`

### Step 3: Create Service Account

1. Go to: Project Settings (gear icon)
2. Tab: Service Accounts
3. Click "Generate New Private Key"
4. Save as `firebase-key.json`
5. Download dan tempatkan di `backend/` folder

### Step 4: Get Firebase Config

1. Go to: Project Settings
2. Tab: General
3. Scroll down ke "Your apps"
4. Click Web app (</> icon)
5. Copy config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "chatbot-upj.firebaseapp.com",
  projectId: "chatbot-upj",
  storageBucket: "chatbot-upj.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
}
```

Gunakan di frontend `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=chatbot-upj.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=chatbot-upj
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=chatbot-upj.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

---

## 📊 Firestore Database

### Collection Structure

```
firestore/
├── faqs/
│   ├── doc: faq_001
│   │   ├── question: string
│   │   ├── answer: string
│   │   ├── category: string
│   │   ├── tags: array
│   │   ├── status: string (active|archived)
│   │   ├── ai_generated: boolean
│   │   ├── created_at: timestamp
│   │   └── updated_at: timestamp
│   └── doc: faq_002
│       └── ...
│
├── chat_logs/
│   ├── doc: log_001
│   │   ├── session_id: string
│   │   ├── user_message: string
│   │   ├── assistant_response: string
│   │   ├── timestamp: timestamp
│   │   ├── response_time_ms: number
│   │   ├── model_used: string
│   │   ├── user_ip: string
│   │   └── feedback: map
│   └── doc: log_002
│       └── ...
│
├── leads/
│   ├── doc: lead_001
│   │   ├── name: string
│   │   ├── email: string
│   │   ├── phone: string
│   │   ├── program_interest: string
│   │   ├── message: string
│   │   ├── source: string (chatbot|form|web)
│   │   ├── collected_at: timestamp
│   │   └── status: string (new|contacted|converted)
│   └── doc: lead_002
│       └── ...
│
├── feedback/
│   ├── doc: feedback_001
│   │   ├── session_id: string
│   │   ├── rating: number (1-5)
│   │   ├── accuracy: number (1-5)
│   │   ├── helpfulness: number (1-5)
│   │   ├── comment: string
│   │   └── timestamp: timestamp
│   └── doc: feedback_002
│       └── ...
│
└── admin_users/
    ├── doc: admin@upj.ac.id
    │   ├── email: string
    │   ├── role: string (superadmin|admin|viewer)
    │   ├── permissions: array
    │   ├── created_at: timestamp
    │   ├── last_login: timestamp
    │   └── status: string (active|inactive)
    └── doc: admin2@upj.ac.id
        └── ...
```

### Create Collections

#### 1. FAQs Collection

```javascript
// Initialize
db.collection('faqs').doc('faq_001').set({
  question: 'Apa itu UPJ?',
  answer: 'Universitas Pembangunan Jaya adalah...',
  category: 'Academic',
  tags: ['umum', 'kampus'],
  status: 'active',
  ai_generated: true,
  source_url: 'https://upj.ac.id',
  created_at: firestore.FieldValue.serverTimestamp(),
  updated_at: firestore.FieldValue.serverTimestamp()
})
```

#### 2. Chat Logs Collection

```javascript
db.collection('chat_logs').add({
  session_id: 'sess_abc123',
  user_message: 'Berapa biaya?',
  assistant_response: '<p>Biaya adalah...</p>',
  timestamp: firestore.FieldValue.serverTimestamp(),
  response_time_ms: 1250,
  model_used: 'gemini-2.5-flash',
  user_ip: '192.168.1.1',
  feedback: {
    rating: 5,
    helpful: true,
    comment: 'Sangat membantu'
  }
})
```

#### 3. Leads Collection

```javascript
db.collection('leads').add({
  name: 'Budi Santoso',
  email: 'budi@example.com',
  phone: '+62812345678',
  program_interest: 'Sistem Informasi',
  message: 'Saya tertarik untuk mendaftar',
  source: 'chatbot',
  collected_at: firestore.FieldValue.serverTimestamp(),
  status: 'new'
})
```

#### 4. Feedback Collection

```javascript
db.collection('feedback').add({
  session_id: 'sess_abc123',
  rating: 4,
  accuracy: 5,
  helpfulness: 4,
  comment: 'Bot bagus, tapi ada yang bisa ditingkatkan',
  timestamp: firestore.FieldValue.serverTimestamp()
})
```

#### 5. Admin Users Collection

```javascript
db.collection('admin_users').doc('admin@upj.ac.id').set({
  email: 'admin@upj.ac.id',
  role: 'superadmin',
  permissions: [
    'faq_manage',
    'chat_view',
    'lead_export',
    'settings_edit'
  ],
  created_at: firestore.FieldValue.serverTimestamp(),
  last_login: firestore.FieldValue.serverTimestamp(),
  status: 'active'
})
```

### Create Indexes

Create composite indexes untuk query optimization.

#### Index 1: FAQs by Category

```
Collection: faqs
Fields:
  - status (Ascending)
  - category (Ascending)
  - created_at (Descending)
```

#### Index 2: Chat Logs by Date Range

```
Collection: chat_logs
Fields:
  - timestamp (Descending)
  - user_ip (Ascending)
```

#### Index 3: Leads by Status & Date

```
Collection: leads
Fields:
  - status (Ascending)
  - collected_at (Descending)
```

**Create via Firebase Console:**
1. Go to: Firestore Database → Indexes
2. Click "Create Index"
3. Select collection & fields
4. Click "Create Index"

---

## 🔐 Firebase Authentication

### Enable Google Sign-In

1. Go to: Build → Authentication
2. Sign-in method: Google
3. Enable & configure

### Setup OAuth Consent Screen

1. Go to: Google Cloud Console → OAuth consent screen
2. Configure:
   - App name: Chatbot Admisi UPJ
   - User support email: support@upj.ac.id
   - Scopes: email, profile
   - Test users: admin emails

### Authorized Domains

1. Go to: Authentication → Settings
2. Tab: Authorized domains
3. Add: `localhost` (development)
4. Add: `yourdomain.com` (production)

### Custom Claims (Optional)

```python
# Backend: Set admin role
from firebase_admin import auth

claims = {
    'role': 'admin',
    'permissions': ['faq_manage', 'chat_view']
}

auth.set_custom_user_claims('user_id', claims)
```

---

## 🔒 Security Rules

### Development Rules (Test Mode)

⚠️ **HANYA untuk development!**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Production Rules

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // FAQs - Public read, Admin write
    match /faqs/{document=**} {
      allow read: if true;
      allow write: if hasRole('admin');
    }
    
    // Chat logs - Public write, Admin read
    match /chat_logs/{document=**} {
      allow create: if true;
      allow read: if hasRole('admin');
    }
    
    // Leads - Public create, Admin read
    match /leads/{document=**} {
      allow create: if true;
      allow read: if hasRole('admin');
    }
    
    // Feedback - Public create, Admin read
    match /feedback/{document=**} {
      allow create: if true;
      allow read: if hasRole('admin');
    }
    
    // Admin users - Admin only
    match /admin_users/{document=**} {
      allow read, write: if hasRole('superadmin');
    }
    
    // Helper function
    function hasRole(role) {
      return request.auth != null && 
             get(/databases/$(database)/documents/admin_users/$(request.auth.token.email)).data.role == role;
    }
    
    function isAdmin() {
      return hasRole('admin') || hasRole('superadmin');
    }
  }
}
```

### Apply Rules

1. Go to: Firestore Database → Rules
2. Copy-paste security rules
3. Click "Publish"

---

## 🚀 Indexes & Performance

### Create Composite Indexes

Via Firebase Console:
1. Firestore Database → Indexes
2. Click "Create Index"
3. Configure fields

Or via CLI:
```bash
firebase firestore:indexes
```

### Query Optimization

```python
# ✅ Good - with index
query = db.collection('faqs')\
    .where('status', '==', 'active')\
    .where('category', '==', 'Academic')\
    .order_by('created_at', direction=firestore.Query.DESCENDING)\
    .limit(20)

# ❌ Bad - multiple filters without index
query = db.collection('chat_logs')\
    .where('timestamp', '>=', start_date)\
    .where('user_ip', '==', '192.168.1.1')\
    .where('model_used', '==', 'gemini')  # No index!
```

### Performance Monitoring

```javascript
// Browser: Firebase Performance Monitoring
import { getPerformance } from 'firebase/performance'

const perf = getPerformance()
// Auto-tracked
```

---

## 💾 Backup & Recovery

### Enable Automatic Backups

1. Go to: Google Cloud Console
2. Firestore → Backups
3. Enable scheduled backups
4. Set frequency: Daily (at 2 AM)
5. Retention: 30 days

### Manual Backup

```bash
# Export data
gcloud firestore export gs://chatbot-upj-backup/`date +%Y%m%d`

# Import data
gcloud firestore import gs://chatbot-upj-backup/2026-05-06
```

### Point-in-Time Recovery

```bash
# Restore to specific timestamp
gcloud firestore restore \
  --backup-name projects/chatbot-upj/locations/asia-southeast2/backups/xxxxx \
  --backup-time 2026-05-06T10:00:00Z
```

---

## 📈 Monitoring & Analytics

### Firebase Console Analytics

1. Go to: Analytics
2. View real-time data
3. Monitor events

### Google Cloud Monitoring

1. Go to: Cloud Console → Monitoring
2. Create dashboard
3. Add metrics:
   - Firestore operations
   - Read/write latency
   - Document count

### Custom Logging

```javascript
// Frontend - Log events
import { logEvent } from 'firebase/analytics'

logEvent(analytics, 'chat_sent', {
  message_length: message.length,
  history_length: history.length
})

logEvent(analytics, 'faq_opened', {
  faq_id: id,
  category: category
})
```

---

## 💰 Cost Optimization

### Cost Breakdown

- Read operations: $0.06 per 100K
- Write operations: $0.18 per 100K
- Delete operations: $0.02 per 100K
- Storage: $0.018 per GB

### Optimization Tips

1. **Denormalize Data**
   - Store FAQ category inline
   - Reduces read operations

2. **Batch Operations**
   ```python
   batch = db.batch()
   for faq in faq_list:
       batch.set(db.collection('faqs').document(), faq)
   batch.commit()  # Single operation
   ```

3. **Cache Frequently Accessed Data**
   - In-memory cache in backend
   - Reduces Firestore reads

4. **Archive Old Data**
   ```python
   # Move old logs to archive collection
   old_logs = db.collection('chat_logs')\
       .where('timestamp', '<', old_date)\
       .stream()
   
   for log in old_logs:
       db.collection('chat_logs_archive').add(log.to_dict())
       log.reference.delete()
   ```

5. **Use Firestore TTL**
   - Auto-delete old documents
   - Set via console or API

### Estimated Monthly Cost (100K chats/month)

```
Read operations:   200K reads × $0.06 = $12
Write operations:  100K writes × $0.18 = $18
Storage:           1GB × $0.018 = $0.02
─────────────────────────────────────
Total:             ~$30/month
```

---

## 🔧 Troubleshooting

### Issue: "Permission Denied" Error

**Cause:** Security rules block access

**Solution:**
1. Check security rules in Firebase Console
2. Verify user role in admin_users collection
3. Test rule syntax

```bash
# Test rule
firebase firestore:indexes --all
```

---

### Issue: Slow Queries

**Cause:** Missing index

**Solution:**
1. Check Firebase Console Indexes
2. Create composite index for common queries
3. Monitor query latency

---

### Issue: High Costs

**Cause:** Inefficient queries or data structure

**Solution:**
1. Enable caching in backend
2. Use batch operations
3. Archive old data
4. Review query patterns

---

### Issue: Data Loss

**Cause:** Accidental deletion

**Solution:**
1. Restore from backup
2. Use point-in-time recovery
3. Check deletion logs

---

## 📱 Firebase Emulator (Local Testing)

```bash
# Install emulator
npm install -g firebase-tools

# Start emulator
firebase emulators:start

# With specific services
firebase emulators:start --only firestore,auth

# Use in app
import { connectFirestoreEmulator } from 'firebase/firestore'

if (process.env.NODE_ENV === 'development') {
  connectFirestoreEmulator(db, 'localhost', 8080)
}
```

---

## 📖 Useful Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Security Rules Playground](https://firebase.google.com/docs/rules/test-overview)
- [Pricing Calculator](https://firebase.google.com/pricing)

---

**Document Version:** 1.0
**Last Updated:** 6 Mei 2026
