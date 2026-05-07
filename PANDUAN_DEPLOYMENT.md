# 🚀 Panduan Deployment - Production Setup & Hosting

**Last Updated:** 6 Mei 2026

---

## 📋 Daftar Isi

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Frontend Deployment](#frontend-deployment)
3. [Backend Deployment](#backend-deployment)
4. [Domain & SSL Setup](#domain--ssl-setup)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Monitoring & Logging](#monitoring--logging)
7. [Scaling & Performance](#scaling--performance)
8. [Disaster Recovery](#disaster-recovery)
9. [Maintenance & Updates](#maintenance--updates)

---

## ✅ Pre-Deployment Checklist

### Code Quality

- [ ] Semua tests passing
- [ ] No console errors/warnings
- [ ] Code reviewed
- [ ] Security scan passed
- [ ] Dependencies up-to-date

### Configuration

- [ ] Environment variables configured
- [ ] Firebase credentials secured
- [ ] API keys secured
- [ ] Database backups enabled
- [ ] SSL certificates ready

### Performance

- [ ] Frontend bundle optimized
- [ ] API response times acceptable
- [ ] Database indexes created
- [ ] Caching strategy implemented
- [ ] Load testing completed

### Security

- [ ] HTTPS enabled
- [ ] Security headers set
- [ ] CORS properly configured
- [ ] Input validation added
- [ ] Rate limiting configured

### Documentation

- [ ] API documentation complete
- [ ] Deployment guide written
- [ ] Runbook created
- [ ] Team trained

---

## 🎨 Frontend Deployment

### Option 1: Vercel (Recommended)

**Pros:** Easy, fast, built for Next.js, CDN included

#### Step 1: Connect Repository

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel
```

#### Step 2: Configure Environment

1. Go to Vercel dashboard
2. Project settings → Environment Variables
3. Add production variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=chatbot-upj.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=chatbot-upj
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=chatbot-upj.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_API_BASE_URL=https://api.chatbot-upj.com
```

#### Step 3: Connect Domain

1. Vercel dashboard → Domains
2. Add domain: `chatbot-upj.com`
3. Update DNS nameservers:
   ```
   ns1.vercel.com
   ns2.vercel.com
   ```

#### Step 4: Enable HTTPS

- Automatic SSL certificate via Let's Encrypt
- Auto-renewal every 90 days

**Vercel URL:** https://chatbot-upj.vercel.app

---

### Option 2: Netlify

#### Step 1: Connect Git

1. Go to [Netlify](https://netlify.com)
2. Click "New site from Git"
3. Select GitHub repo
4. Select branch: `main`

#### Step 2: Build Settings

```
Build command:  NEXT_DISABLE_TURBOPACK=1 npm run build
Publish directory: .next
```

#### Step 3: Environment Variables

Add same variables as Vercel

---

### Option 3: Docker + Container Registry

#### Step 1: Create Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy app
COPY . .

# Build
RUN NEXT_DISABLE_TURBOPACK=1 npm run build

# Production
CMD ["npm", "start"]

# Expose port
EXPOSE 3000
```

#### Step 2: Build & Push Image

```bash
# Build
docker build -t chatbot-upj-frontend:latest .

# Push to Docker Hub
docker login
docker tag chatbot-upj-frontend:latest username/chatbot-upj-frontend:latest
docker push username/chatbot-upj-frontend:latest
```

#### Step 3: Deploy to Container Service

```bash
# Google Cloud Run
gcloud run deploy chatbot-upj-frontend \
  --image gcr.io/project-id/chatbot-upj-frontend:latest \
  --platform managed \
  --region asia-southeast2

# AWS ECS
aws ecs create-service \
  --cluster chatbot-cluster \
  --service-name chatbot-frontend \
  --task-definition chatbot-frontend-task
```

---

## ⚙️ Backend Deployment

### Option 1: Heroku (Deprecated but still useful)

#### Step 1: Heroku Setup

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create chatbot-upj-backend

# Add Procfile (sudah ada)
cat backend/Procfile
# web: python app.py
```

#### Step 2: Environment Variables

```bash
heroku config:set GEMINI_API_KEY_1=xxx -a chatbot-upj-backend
heroku config:set ADMIN_SECRET_TOKEN=xxx -a chatbot-upj-backend
heroku config:set FIREBASE_CREDENTIALS_PATH=./firebase-key.json

# Add Firebase key
heroku config:set FIREBASE_KEY='<contents of firebase-key.json>' -a chatbot-upj-backend
```

#### Step 3: Deploy

```bash
# Push to Heroku
git push heroku main

# View logs
heroku logs --tail -a chatbot-upj-backend
```

---

### Option 2: Render.com

#### Step 1: Connect Repository

1. Go to [Render](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Select `backend` folder

#### Step 2: Configure

```
Name:               chatbot-upj-backend
Environment:        Python 3.11
Build command:      pip install -r requirements.txt
Start command:      python app.py
Port:               5000
```

#### Step 3: Environment Variables

Add all from `.env` file

**URL:** https://chatbot-upj-backend.onrender.com

---

### Option 3: Google Cloud Run

#### Step 1: Create Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create app.py if doesn't exist properly
CMD exec gunicorn --bind :${PORT:-5000} --workers 1 app:app
```

#### Step 2: Build & Deploy

```bash
# Build
gcloud builds submit --tag gcr.io/PROJECT-ID/chatbot-upj-backend

# Deploy
gcloud run deploy chatbot-upj-backend \
  --image gcr.io/PROJECT-ID/chatbot-upj-backend \
  --platform managed \
  --region asia-southeast2 \
  --memory 1Gi \
  --timeout 3600 \
  --set-env-vars GEMINI_API_KEY_1=xxx,ADMIN_SECRET_TOKEN=xxx
```

---

### Option 4: VPS / Dedicated Server

#### Step 1: Server Setup

```bash
# SSH ke server
ssh user@your-server.com

# Update system
sudo apt update
sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3 python3-venv python3-pip \
  nodejs npm git curl wget build-essential nginx certbot \
  python3-certbot-nginx
```

#### Step 2: Clone & Setup Backend

```bash
# Clone repo
git clone https://github.com/yourrepo/Chatbot-Ai-UPJ.git
cd Chatbot-Ai-UPJ/backend

# Create venv
python3 -m venv venv
source venv/bin/activate

# Install
pip install -r requirements.txt

# Create .env
nano .env
# Paste configuration
```

#### Step 3: Setup Supervisor (Process Manager)

```bash
sudo apt install supervisor

# Create config
sudo nano /etc/supervisor/conf.d/chatbot-backend.conf
```

```ini
[program:chatbot-backend]
directory=/home/user/Chatbot-Ai-UPJ/backend
command=/home/user/Chatbot-Ai-UPJ/backend/venv/bin/python app.py
user=user
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/chatbot-backend.log
```

```bash
# Start supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start chatbot-backend
```

#### Step 4: Setup Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/chatbot-upj
```

```nginx
upstream backend {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name api.chatbot-upj.com;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeout
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chatbot-upj \
  /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

#### Step 5: SSL Certificate

```bash
sudo certbot --nginx -d api.chatbot-upj.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

---

## 🌐 Domain & SSL Setup

### Register Domain

1. Go to domain registrar (GoDaddy, Namecheap, etc)
2. Register: `chatbot-upj.com`
3. Configure DNS:

```dns
A record:     chatbot-upj.com → <frontend-ip>
CNAME record: www → chatbot-upj.com
A record:     api.chatbot-upj.com → <backend-ip>
```

### SSL Certificates

```bash
# Generate self-signed (testing)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Let's Encrypt (production)
sudo certbot certonly --standalone -d chatbot-upj.com -d api.chatbot-upj.com
```

### HTTPS Configuration

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.chatbot-upj.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name api.chatbot-upj.com;

    ssl_certificate /etc/letsencrypt/live/api.chatbot-upj.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.chatbot-upj.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
    }
}
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd frontend && npm install
      
      - name: Build
        run: cd frontend && NEXT_DISABLE_TURBOPACK=1 npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: cd backend && pip install -r requirements.txt
      
      - name: Run tests
        run: cd backend && pytest
      
      - name: Deploy to Render
        run: |
          curl -X POST https://api.render.com/deploy/srv-xxx \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}"
```

---

## 📊 Monitoring & Logging

### Application Monitoring

#### Option 1: Sentry (Error Tracking)

```python
# backend/app.py
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv('SENTRY_DSN'),
    traces_sample_rate=1.0
)
```

#### Option 2: DataDog

```python
from datadog import initialize, api, statsd

options = {
    'api_key': os.getenv('DD_API_KEY'),
    'app_key': os.getenv('DD_APP_KEY')
}

initialize(**options)

# Track metric
statsd.gauge('chat.response_time', response_time_ms)
```

### Log Aggregation

#### Logs Setup

```python
# backend/app.py
import logging
from pythonjsonlogger import jsonlogger

# JSON logging for better parsing
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)

logger = logging.getLogger()
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)
```

#### View Logs

```bash
# Heroku
heroku logs --tail

# Google Cloud Run
gcloud logging read "resource.type=cloud_run_revision" \
  --format json --limit 50

# Render
# Dashboard → Logs
```

### Uptime Monitoring

```bash
# UptimeRobot monitoring
curl -X POST https://api.uptimerobot.com/v2/addMonitor \
  -d "api_key=XXX&format=json&type=1&url=https://api.chatbot-upj.com/health"
```

---

## 📈 Scaling & Performance

### Load Balancing

```nginx
# Nginx load balancer
upstream backend_cluster {
    server backend1.example.com:5000;
    server backend2.example.com:5000;
    server backend3.example.com:5000;
    least_conn;  # Load balancing algorithm
}

server {
    location / {
        proxy_pass http://backend_cluster;
    }
}
```

### Auto-Scaling

```bash
# Google Cloud Run - auto-scaling
gcloud run deploy chatbot-upj-backend \
  --max-instances 10 \
  --min-instances 2 \
  --concurrency 100

# Kubernetes
kubectl autoscale deployment chatbot-backend \
  --min=2 --max=10 --cpu-percent=80
```

### Caching Strategy

```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Cache API responses
location /api/faq {
    proxy_cache STATIC;
    proxy_cache_valid 200 1h;
    proxy_cache_use_stale error timeout invalid_header updating;
}
```

### Database Optimization

```python
# Firestore indexes for common queries
# Already set up in Firestore console

# Application-level caching
from functools import lru_cache
import time

class CachedFAQStore:
    def __init__(self, ttl_minutes=60):
        self.cache = {}
        self.ttl_minutes = ttl_minutes
        self.timestamp = 0
    
    def get_faqs(self):
        if time.time() - self.timestamp > self.ttl_minutes * 60:
            self.cache = self._fetch_from_db()
            self.timestamp = time.time()
        return self.cache
    
    def _fetch_from_db(self):
        # Fetch from Firestore
        return db.collection('faqs').stream()
```

---

## 🛡️ Disaster Recovery

### Backup Strategy

```bash
# Daily Firestore backups
gsutil -m cp -r gs://chatbot-upj-backup/* gs://backup-archive/

# Database export
gcloud firestore export gs://chatbot-upj-backup/daily-export
```

### Restore Procedure

```bash
# Restore from backup
gcloud firestore restore gs://chatbot-upj-backup/2026-05-06T00:00:00_12345/

# Verify restore
gcloud firestore operations list
```

### Failover

```bash
# 1. Identify issue
# 2. Activate backup system
# 3. Update DNS to backup IP
# 4. Verify functionality
# 5. Post-mortem analysis
```

---

## 🔧 Maintenance & Updates

### Regular Maintenance

```bash
# Weekly
- Check logs for errors
- Monitor resource usage
- Review security alerts

# Monthly
- Update dependencies
- Security patches
- Performance optimization
- Database cleanup
```

### Update Procedure

```bash
# 1. Create feature branch
git checkout -b deploy/update-gemini

# 2. Update dependencies
pip install --upgrade -r backend/requirements.txt
npm upgrade --prefix frontend

# 3. Test locally
npm run test --prefix frontend
pytest backend/

# 4. Deploy to staging
# 5. Smoke tests
# 6. Deploy to production
git merge deploy/update-gemini --no-ff
git tag v1.2.0
git push origin --all --tags
```

### Rollback Procedure

```bash
# If deployment fails:
# 1. Identify issue
# 2. Revert code
git revert HEAD

# 3. Redeploy
git push

# 4. Restore database if needed
gcloud firestore restore gs://backup/point-in-time
```

---

## 📋 Deployment Checklist

**Pre-deployment:**
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Environment variables configured
- [ ] Database backed up
- [ ] Security scan passed

**Deployment:**
- [ ] Build successful
- [ ] Tests in CI/CD passed
- [ ] Deploy to staging
- [ ] Smoke tests passed
- [ ] Deploy to production

**Post-deployment:**
- [ ] Verify functionality
- [ ] Check logs
- [ ] Monitor metrics
- [ ] Update status page
- [ ] Notify team

---

## 📞 Emergency Contacts

- **Backend Issue:** DevOps Team
- **Database Issue:** Database Admin
- **Security Issue:** Security Team
- **General Support:** support@upj.ac.id

---

**Document Version:** 1.0
**Last Updated:** 6 Mei 2026
