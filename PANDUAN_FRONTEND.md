# 🎨 Panduan Frontend - Next.js Chatbot UI

**Last Updated:** 6 Mei 2026

---

## 📋 Daftar Isi

1. [Struktur Frontend](#struktur-frontend)
2. [Setup & Installation](#setup--installation)
3. [Halaman Utama - mainpage.tsx](#halaman-utama---mainpagetsx)
4. [Admin Dashboard - dashboard.tsx](#admin-dashboard---dashboardtsx)
5. [Sistem Autentikasi - login.tsx](#sistem-autentikasi---logintsx)
6. [Firebase Integration](#firebase-integration)
7. [Styling & Tailwind](#styling--tailwind)
8. [State Management](#state-management)
9. [API Integration](#api-integration)
10. [Optimization Tips](#optimization-tips)

---

## 📁 Struktur Frontend

```
frontend/
├── src/
│   ├── pages/
│   │   ├── _app.tsx              # Next.js app wrapper
│   │   ├── _document.tsx         # HTML document
│   │   ├── index.tsx             # Home / redirect
│   │   ├── mainpage.tsx          # 🤖 Chatbot UI
│   │   ├── dashboard.tsx         # 👨‍💼 Admin panel
│   │   └── login.tsx             # 🔐 Admin login
│   ├── lib/
│   │   └── firebase.ts           # Firebase config
│   ├── styles/
│   │   ├── globals.css           # Global styles
│   │   ├── mainpage.css          # Chatbot styles
│   │   ├── mainpage.module.css   # Chatbot modules
│   │   └── dashboard.module.css  # Dashboard modules
│   └── public/
│       └── images/               # Static images
├── .env.local                    # Environment variables (LOCAL ONLY)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.ts                # Next.js config
├── tailwind.config.js            # Tailwind CSS
├── postcss.config.mjs            # PostCSS
└── .next/                        # Build output
```

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js 18+ LTS
- npm 9+
- Git

### Installation Steps

#### 1. Clone & Navigate
```bash
git clone https://github.com/yourrepo/Chatbot-Ai-UPJ.git
cd Chatbot-Ai-UPJ/frontend
```

#### 2. Install Dependencies
```bash
npm install
# atau
npm ci  # untuk production builds
```

#### 3. Configure Environment

Buat file `.env.local`:
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=chatbot-upj.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=chatbot-upj
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=chatbot-upj.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxxxxx

# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
NEXT_PUBLIC_API_TIMEOUT=30000

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_CHAT_LOG=true
```

⚠️ **IMPORTANT:** Jangan commit `.env.local` ke Git!

#### 4. Run Development Server
```bash
npm run dev
# Server akan berjalan di http://localhost:3000
```

#### 5. Verification

Buka browser dan kunjungi:
- Chatbot: http://localhost:3000/mainpage
- Admin Dashboard: http://localhost:3000/dashboard
- Login: http://localhost:3000/login

---

## 🤖 Halaman Utama - mainpage.tsx

### Deskripsi

Halaman publik tempat user berinteraksi dengan chatbot AI. Tidak memerlukan autentikasi.

### File Location
```
frontend/src/pages/mainpage.tsx
```

### Fitur Utama

1. **Chat Interface**
   - Display message history
   - User & assistant messages berbeda styling
   - Auto-scroll ke message terbaru
   - Loading indicator saat awaiting response

2. **Message Input**
   - Text input dengan button send
   - Keyboard shortcut: Enter to send
   - Character counter (max 500)
   - Disable saat loading

3. **Feedback & Leads**
   - Rating & comment form
   - Contact info collection (name, email, phone)
   - Save ke Firestore

4. **Mobile Responsive**
   - Responsive design
   - Touch-friendly buttons
   - Mobile keyboard handling

### Component Structure

```typescript
interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

interface ChatState {
  messages: Message[]
  input: string
  loading: boolean
  error?: string
}

function MainpageChatbot() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    input: '',
    loading: false
  })

  return (
    <div className="chat-container">
      <ChatHeader />
      <MessageList messages={state.messages} />
      <MessageInput 
        value={state.input}
        onChange={handleInputChange}
        onSend={handleSendMessage}
        loading={state.loading}
      />
      <FeedbackWidget visible={state.messages.length > 3} />
    </div>
  )
}
```

### Key Functions

#### `sendMessage(message: string)`
```typescript
const sendMessage = async (message: string) => {
  // Validation
  if (!message.trim() || message.length > 500) return

  // Add user message
  setMessages(prev => [...prev, { role: 'user', content: message }])
  setLoading(true)

  try {
    // Call backend API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: messages.slice(-4) // Last 4 messages
        })
      }
    )

    if (!response.ok) throw new Error('API Error')

    const data = await response.json()

    // Add assistant message
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: data.response 
    }])
  } catch (error) {
    console.error('Error:', error)
    setError('Gagal mengirim pesan. Silahkan coba lagi.')
  } finally {
    setLoading(false)
    setInput('')
  }
}
```

#### `saveFeedback(feedback: Feedback)`
```typescript
const saveFeedback = async (feedback: Feedback) => {
  try {
    await addDoc(collection(db, 'feedback'), {
      session_id: sessionId,
      rating: feedback.rating,
      helpful: feedback.helpful,
      comment: feedback.comment,
      timestamp: serverTimestamp()
    })
    alert('Terima kasih atas feedback Anda!')
  } catch (error) {
    console.error('Error saving feedback:', error)
  }
}
```

### Styling

**File:** `mainpage.css` & `mainpage.module.css`

```css
/* Chat container */
.chatContainer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Message list */
.messageList {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* User message */
.userMessage {
  align-self: flex-end;
  background: #667eea;
  color: white;
  border-radius: 12px 12px 0 12px;
  padding: 12px 16px;
  max-width: 70%;
}

/* Assistant message */
.assistantMessage {
  align-self: flex-start;
  background: white;
  color: #333;
  border-radius: 12px 12px 12px 0;
  padding: 12px 16px;
  max-width: 70%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Input area */
.inputArea {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
}

.inputArea input {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 24px;
  padding: 12px 16px;
  font-size: 14px;
}

.inputArea button {
  background: #667eea;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inputArea button:hover {
  background: #764ba2;
}

.inputArea button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

## 👨‍💼 Admin Dashboard - dashboard.tsx

### Deskripsi

Panel administrasi untuk mengelola FAQ, logs, leads, feedback, dan scraper. Memerlukan autentikasi Google.

### File Location
```
frontend/src/pages/dashboard.tsx
```

### Fitur Utama

#### 1. **FAQ Manager**
- Create new FAQ
- Read & search FAQ
- Update existing FAQ
- Delete FAQ
- Preview AI response
- Bulk upload dari scraper

**Operations:**
```typescript
// Create
await addDoc(collection(db, 'faqs'), {
  question: 'Apa itu UPJ?',
  answer: 'Universitas Pembangunan Jaya adalah...',
  category: 'Academic',
  created_at: serverTimestamp()
})

// Read
const faqs = await getDocs(collection(db, 'faqs'))

// Update
await updateDoc(doc(db, 'faqs', faqId), {
  answer: 'Updated answer...',
  updated_at: serverTimestamp()
})

// Delete
await deleteDoc(doc(db, 'faqs', faqId))
```

#### 2. **Chat Logs**
- View all chat history
- Search by message
- Filter by date
- View response time
- Analyze user questions

**Query Example:**
```typescript
const logs = await getDocs(
  query(
    collection(db, 'chat_logs'),
    where('timestamp', '>=', startDate),
    where('timestamp', '<=', endDate),
    orderBy('timestamp', 'desc'),
    limit(100)
  )
)
```

#### 3. **Leads Management**
- View collected leads
- Search & filter
- Contact info export
- Lead status tracking
- Export to Excel

**Export Function:**
```typescript
import { write, utils } from 'xlsx'

const exportLeadsToExcel = (leads: Lead[]) => {
  const worksheet = utils.json_to_sheet(leads)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'Leads')
  write(workbook, { bookType: 'xlsx', type: 'binary', 
    bookSST: false }, 'leads.xlsx')
}
```

#### 4. **Feedback & Reviews**
- View user ratings
- Display comments
- Analytics (avg rating, helpful %)
- Sentiment analysis

**Analytics Query:**
```typescript
const feedbacks = await getDocs(collection(db, 'feedback'))
const avgRating = feedbacks.docs.reduce((sum, doc) => 
  sum + doc.data().rating, 0) / feedbacks.docs.length
```

#### 5. **Scraper Management**
- Input URL untuk scrape
- Preview extracted FAQ
- Batch upload to Firestore
- Integration dengan backend `/api/scrape`

**Scraper Usage:**
```typescript
const scrapeURL = async (url: string) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/scrape`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    }
  )
  return await response.json()
}
```

#### 6. **Analytics Dashboard**
- Chart: Top Questions
- Chart: Response Time Distribution
- Chart: User Satisfaction Trend
- Statistics: Total Chats, Avg Rating

```typescript
<ResponsiveLineChart
  data={analyticsData}
  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
>
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="rating" stroke="#667eea" />
</ResponsiveLineChart>
```

### Dashboard Tabs Implementation

```typescript
const [activeTab, setActiveTab] = useState('faq')

const renderTabContent = () => {
  switch (activeTab) {
    case 'faq':
      return <FAQManager />
    case 'logs':
      return <ChatLogs />
    case 'leads':
      return <LeadsManager />
    case 'feedback':
      return <FeedbackViewer />
    case 'scraper':
      return <ScraperTool />
    case 'analytics':
      return <Analytics />
    default:
      return null
  }
}

return (
  <div className="dashboard">
    <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    <TabContent>{renderTabContent()}</TabContent>
  </div>
)
```

---

## 🔐 Sistem Autentikasi - login.tsx

### Deskripsi

Halaman login admin menggunakan Google OAuth 2.0 dengan email allowlist validation.

### File Location
```
frontend/src/pages/login.tsx
```

### Auth Flow

```
1. User klik "Login dengan Google"
         ↓
2. Google Auth Popup
         ↓
3. User authorize
         ↓
4. Backend verify email di allowlist
         ↓
5. Create Firebase session
         ↓
6. Redirect ke dashboard
```

### Implementation

```typescript
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'

const handleGoogleLogin = async () => {
  try {
    const auth = getAuth()
    const provider = new GoogleAuthProvider()
    
    const result = await signInWithPopup(auth, provider)
    const user = result.user
    
    // Verify email in allowlist
    const verifyResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/verify-admin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      }
    )
    
    if (!verifyResponse.ok) {
      throw new Error('Email not authorized')
    }
    
    // Get ID token
    const idToken = await user.getIdToken()
    
    // Save token & redirect
    localStorage.setItem('adminToken', idToken)
    router.push('/dashboard')
    
  } catch (error) {
    console.error('Login error:', error)
    setError('Login gagal. Pastikan email Anda di allowlist.')
  }
}
```

### Session Management

```typescript
// Check session on page load
useEffect(() => {
  const auth = getAuth()
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      // User logged in
      setIsLoggedIn(true)
    } else {
      // User logged out
      setIsLoggedIn(false)
    }
  })
  
  return unsubscribe
}, [])

// Logout function
const handleLogout = async () => {
  try {
    const auth = getAuth()
    await signOut(auth)
    localStorage.removeItem('adminToken')
    router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
  }
}
```

---

## 🔥 Firebase Integration

### File Location
```
frontend/src/lib/firebase.ts
```

### Initialization

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const analytics = getAnalytics(app)
```

### Usage Examples

#### Firestore Query
```typescript
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const getFAQs = async () => {
  const faqs = await getDocs(
    query(
      collection(db, 'faqs'),
      where('status', '==', 'active')
    )
  )
  return faqs.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

#### Add Document
```typescript
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

const addFAQ = async (question: string, answer: string) => {
  await addDoc(collection(db, 'faqs'), {
    question,
    answer,
    created_at: serverTimestamp(),
    status: 'active'
  })
}
```

#### Update Document
```typescript
import { updateDoc, doc } from 'firebase/firestore'

const updateFAQ = async (faqId: string, updates: any) => {
  await updateDoc(doc(db, 'faqs', faqId), {
    ...updates,
    updated_at: serverTimestamp()
  })
}
```

#### Real-time Listener
```typescript
import { onSnapshot } from 'firebase/firestore'

const subscribeFAQs = (callback: Function) => {
  return onSnapshot(collection(db, 'faqs'), (snapshot) => {
    const faqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(faqs)
  })
}
```

---

## 🎨 Styling & Tailwind

### Global Styles
```css
/* frontend/src/styles/globals.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  background-color: #f5f5f5;
  color: #333;
}

a {
  color: #667eea;
  text-decoration: none;
}
```

### Tailwind Config
```javascript
// frontend/tailwind.config.js

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        success: '#10b981',
        error: '#ef4444'
      },
      spacing: {
        '128': '32rem'
      }
    }
  },
  plugins: []
}
```

### Component Styling Example

```typescript
// ✅ Menggunakan Tailwind
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow">
  <h1 className="text-2xl font-bold text-gray-900">Title</h1>
  <p className="text-gray-600">Description</p>
  <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">
    Click me
  </button>
</div>

// Module CSS (untuk style kompleks)
import styles from './mainpage.module.css'

<div className={styles.chatContainer}>
  <div className={styles.messageList} />
  <div className={styles.inputArea} />
</div>
```

---

## 📊 State Management

### Using React Hooks

```typescript
// Simple state
const [count, setCount] = useState(0)
const [loading, setLoading] = useState(false)

// Complex state
const [chat, setChat] = useState({
  messages: [],
  loading: false,
  error: null
})

// Reducer pattern (for complex logic)
const initialState = {
  messages: [],
  loading: false,
  error: null
}

function chatReducer(state, action) {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload]
      }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    default:
      return state
  }
}

const [state, dispatch] = useReducer(chatReducer, initialState)
```

### Context API (for global state)

```typescript
// context/ChatContext.ts
import { createContext, useContext } from 'react'

interface ChatContextType {
  messages: Message[]
  addMessage: (message: Message) => void
  clearMessages: () => void
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}

// Usage in component
const { messages, addMessage } = useChatContext()
```

---

## 🔗 API Integration

### HTTP Client Setup

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

export const apiClient = {
  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) throw new Error(`API Error: ${response.status}`)
    return response.json()
  },

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    if (!response.ok) throw new Error(`API Error: ${response.status}`)
    return response.json()
  }
}
```

### Fetch Chat Response

```typescript
import { apiClient } from '@/lib/api'

const response = await apiClient.post('/chat', {
  message: userInput,
  history: messages
})
```

---

## ⚡ Optimization Tips

### 1. Image Optimization
```typescript
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority  // Load immediately
/>
```

### 2. Code Splitting
```typescript
import dynamic from 'next/dynamic'

const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  loading: () => <p>Loading...</p>
})
```

### 3. Memoization
```typescript
import { memo, useMemo, useCallback } from 'react'

// Prevent re-renders
const MessageItem = memo(({ message }) => (
  <div>{message.content}</div>
))

// Memoize expensive computations
const sortedMessages = useMemo(() => 
  [...messages].sort((a, b) => b.timestamp - a.timestamp),
  [messages]
)

// Memoize callbacks
const handleSend = useCallback((msg) => {
  sendMessage(msg)
}, [])
```

### 4. Performance Monitoring
```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

getCLS(console.log)
getFID(console.log)
getFCP(console.log)
getLCP(console.log)
getTTFB(console.log)
```

---

## 🐛 Debugging Frontend

### Common Issues

#### Issue: "Cannot find module"
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Firebase not initialized
```typescript
// Make sure firebase.ts is imported in _app.tsx
import '@/lib/firebase'
```

#### Issue: CORS errors
```typescript
// Make sure backend CORS is configured
# In backend/app.py
CORS(app, resources={
  r"/*": {"origins": ["http://localhost:3000"]}
})
```

### Debugging Tools

- **React DevTools** - Chrome extension untuk debug React
- **Next.js Debug Mode** - Set `NEXT_DEBUG_MODE=1`
- **Network Tab** - Check API calls di browser DevTools
- **Console Logs** - Strategic logging untuk trace issues

---

## 📦 Build & Deployment

### Development Build
```bash
npm run dev
```

### Production Build
```bash
# Build
NEXT_DISABLE_TURBOPACK=1 npm run build

# Start
npm start
```

### Build Optimization
```bash
# Analyze bundle size
npm run build -- --analyze

# Check for unused imports
eslint --fix src/
```

---

## 🔗 Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Firebase Web SDK](https://firebase.google.com/docs/web)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

**Document Version:** 1.0
**Last Updated:** 6 Mei 2026
