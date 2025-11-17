# Architectural Recommendations
## African Family Tree - Multi-Tenant SaaS Platform

## 📋 Executive Summary

This document provides comprehensive architectural recommendations for scaling the African Family Tree application from MVP to production-ready, enterprise-grade multi-tenant SaaS platform.

**Current State:** Well-structured MVP with solid foundations
**Target State:** Scalable, secure, performant production system
**Timeline:** Phased approach over 6-12 months

---

## 🏗️ 1. Database Architecture

### Current State
- ✅ PostgreSQL with connection pooling
- ✅ Proper schema design with relationships
- ✅ Multi-tenant data isolation
- ⚠️ No connection pool configuration
- ⚠️ No read replicas
- ⚠️ No database migrations system

### Recommendations

#### 1.1 Connection Pool Optimization
```javascript
// backend/src/db/connection.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idleTimeoutMillis: 30000,   // Close idle clients after 30s
  connectionTimeoutMillis: 2000, // Return error after 2s if connection unavailable
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});
```

#### 1.2 Database Migrations
**Use:** `node-pg-migrate` or `knex.js`

**Why:**
- Version control for schema changes
- Rollback capabilities
- Team collaboration
- Production-safe deployments

**Implementation:**
```bash
npm install node-pg-migrate
```

#### 1.3 Read Replicas (Phase 2)
- **Primary DB:** Write operations (CREATE, UPDATE, DELETE)
- **Read Replica:** SELECT queries (tree views, listings)
- **Benefits:** 3-5x read performance improvement

**Implementation Strategy:**
```javascript
// Separate read/write pools
const writePool = new Pool({ connectionString: process.env.DATABASE_URL });
const readPool = new Pool({ connectionString: process.env.READ_REPLICA_URL });

// Route reads to replica
function query(sql, params, useReplica = false) {
  return (useReplica ? readPool : writePool).query(sql, params);
}
```

#### 1.4 Database Indexing Strategy
**Critical Indexes to Add:**
```sql
-- Composite indexes for common queries
CREATE INDEX idx_persons_family_birth ON persons(family_id, date_of_birth);
CREATE INDEX idx_relationships_family_type ON relationships(person1_id, relationship_type);
CREATE INDEX idx_documents_family_type ON documents(family_id, document_type);
CREATE INDEX idx_families_tier_status ON families(subscription_tier, subscription_status);

-- Full-text search for names
CREATE INDEX idx_persons_name_search ON persons USING gin(to_tsvector('english', full_name));
```

#### 1.5 Partitioning (Phase 3 - Large Scale)
For families with 10,000+ persons:
- Partition `persons` table by `family_id`
- Partition `documents` by `created_at` (time-based)

---

## 🔐 2. Security Architecture

### Current State
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Family-level access control
- ⚠️ No rate limiting
- ⚠️ No input sanitization
- ⚠️ No API versioning
- ⚠️ CORS too permissive

### Recommendations

#### 2.1 Rate Limiting
**Use:** `express-rate-limit` + Redis

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const limiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

// Tiered rate limiting
const freeTierLimiter = rateLimit({ max: 50 });
const premiumTierLimiter = rateLimit({ max: 200 });
```

#### 2.2 Input Validation & Sanitization
**Use:** `express-validator` (already using) + `helmet` + `express-mongo-sanitize`

```javascript
const helmet = require('helmet');
app.use(helmet()); // Security headers
app.use(express.json({ limit: '10mb' })); // Prevent DoS
```

#### 2.3 API Versioning
```javascript
// Version 1 API
app.use('/api/v1/auth', require('./src/routes/v1/auth'));
app.use('/api/v1/persons', require('./src/routes/v1/persons'));

// Future: Version 2
app.use('/api/v2/auth', require('./src/routes/v2/auth'));
```

#### 2.4 CORS Configuration
```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

#### 2.5 SQL Injection Prevention
- ✅ Already using parameterized queries (good!)
- Add: Query timeout limits
- Add: Database user with minimal privileges

#### 2.6 Data Encryption
- **At Rest:** Enable PostgreSQL encryption
- **In Transit:** Always use HTTPS (TLS 1.3)
- **Sensitive Fields:** Encrypt PII in database (phone numbers, emails)

---

## ⚡ 3. Performance Optimization

### 3.1 Caching Strategy

#### Redis Caching Layer
**Use Cases:**
1. **User Sessions** (replace JWT in-memory)
2. **Family Tier Limits** (cache for 5 minutes)
3. **Tree Data** (cache for 1 minute)
4. **API Rate Limits**

```javascript
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// Cache middleware
async function cacheMiddleware(key, ttl = 60) {
  return async (req, res, next) => {
    const cacheKey = `${key}:${req.params.familyId}`;
    const cached = await client.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.sendResponse = res.json;
    res.json = (data) => {
      client.setex(cacheKey, ttl, JSON.stringify(data));
      res.sendResponse(data);
    };
    next();
  };
}
```

#### CDN for Static Assets
- **Frontend:** CloudFront / Cloudflare
- **Images:** CloudFront with S3 origin
- **Documents:** Direct S3 with CloudFront

### 3.2 Database Query Optimization

#### N+1 Query Problem
**Current Issue:** Fetching relationships separately

**Solution:** Use JOINs or DataLoader pattern
```javascript
// Instead of multiple queries, use JOIN
const personsWithRelations = await pool.query(`
  SELECT 
    p.*,
    json_agg(DISTINCT r.*) as relationships,
    json_agg(DISTINCT d.*) as documents
  FROM persons p
  LEFT JOIN relationships r ON r.person1_id = p.person_id
  LEFT JOIN documents d ON d.person_id = p.person_id
  WHERE p.family_id = $1
  GROUP BY p.person_id
`, [familyId]);
```

#### Pagination
```javascript
// Add pagination to all list endpoints
const limit = Math.min(parseInt(req.query.limit) || 50, 100);
const offset = parseInt(req.query.offset) || 0;

const result = await pool.query(
  'SELECT * FROM persons WHERE family_id = $1 LIMIT $2 OFFSET $3',
  [familyId, limit, offset]
);
```

### 3.3 Frontend Performance

#### Code Splitting
```javascript
// Lazy load tree views
const VerticalTreeView = React.lazy(() => import('./TreeViews/VerticalTreeView'));
const HorizontalTreeView = React.lazy(() => import('./TreeViews/HorizontalTreeView'));

// Use Suspense
<Suspense fallback={<Loading />}>
  <VerticalTreeView />
</Suspense>
```

#### Image Optimization
- Use WebP format
- Implement lazy loading
- Responsive images (srcset)
- Image compression on upload

#### Bundle Optimization
- Tree-shaking unused code
- Minification
- Gzip/Brotli compression
- Service Worker for offline support

---

## 📈 4. Scalability Architecture

### 4.1 Horizontal Scaling

#### Load Balancing
```
                    ┌─────────────┐
                    │   Load      │
                    │  Balancer   │
                    │ (Nginx/ALB) │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │  API    │       │  API    │       │  API    │
   │ Server  │       │ Server  │       │ Server  │
   │   #1    │       │   #2    │       │   #3    │
   └────┬────┘       └────┬────┘       └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │  (Primary)  │
                    └─────────────┘
```

**Implementation:**
- **AWS:** Application Load Balancer + ECS/EKS
- **Docker:** Containerize application
- **Kubernetes:** For advanced orchestration

### 4.2 Microservices Consideration (Phase 3)

**Current:** Monolithic (good for MVP)
**Future:** Consider splitting:

1. **Auth Service** - Authentication & authorization
2. **Family Service** - Family management & subscriptions
3. **Genealogy Service** - Persons & relationships
4. **Media Service** - Document uploads & processing
5. **Analytics Service** - Usage tracking & reporting

**When to Split:**
- Team size > 10 developers
- Different scaling needs per service
- Independent deployment requirements

### 4.3 Message Queue (Phase 2)

**Use:** RabbitMQ or AWS SQS

**Use Cases:**
- Async document processing (thumbnails, transcription)
- Email notifications
- Background jobs (usage calculations)
- Event-driven architecture

```javascript
// Example: Async document processing
await queue.publish('document.uploaded', {
  documentId,
  familyId,
  fileUrl
});

// Worker processes in background
queue.subscribe('document.uploaded', async (job) => {
  await generateThumbnail(job.fileUrl);
  await extractMetadata(job.documentId);
});
```

---

## 🗄️ 5. File Storage Architecture

### Current State
- ✅ AWS S3 integration
- ⚠️ No CDN
- ⚠️ No image processing
- ⚠️ No virus scanning

### Recommendations

#### 5.1 S3 Bucket Structure
```
familytree-media/
├── families/
│   ├── {familyId}/
│   │   ├── documents/
│   │   │   ├── {year}/
│   │   │   │   ├── {documentId}.{ext}
│   │   ├── photos/
│   │   │   ├── {year}/
│   │   │   │   ├── {personId}/
│   │   │   │   │   ├── original/
│   │   │   │   │   ├── thumbnails/
│   │   │   │   │   └── optimized/
│   │   └── audio/
│   │       ├── {year}/
│   │       │   ├── {storyId}.mp3
```

#### 5.2 Image Processing Pipeline
**Use:** AWS Lambda + Sharp or ImageMagick

**Process:**
1. Upload original to S3
2. Trigger Lambda function
3. Generate thumbnails (150x150, 300x300, 800x800)
4. Optimize images (WebP conversion)
5. Store in separate S3 paths
6. Update database with URLs

#### 5.3 Virus Scanning
**Use:** ClamAV on Lambda or AWS GuardDuty

#### 5.4 Direct Upload (Phase 2)
**Use:** Presigned S3 URLs

**Benefits:**
- Reduced server load
- Faster uploads
- Better user experience

```javascript
// Generate presigned URL
const s3 = new AWS.S3();
const url = s3.getSignedUrl('putObject', {
  Bucket: 'familytree-media',
  Key: `families/${familyId}/documents/${filename}`,
  Expires: 300 // 5 minutes
});
```

---

## 🎨 6. Frontend Architecture

### Current State
- ✅ React with Material-UI
- ✅ Context API for state
- ⚠️ No state management library
- ⚠️ No error boundary
- ⚠️ No offline support

### Recommendations

#### 6.1 State Management
**For Complex State:** Redux Toolkit or Zustand

**When to Add:**
- Multiple tree views with shared state
- Real-time collaboration features
- Complex form state management

#### 6.2 Error Boundaries
```javascript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to error tracking service
    logErrorToService(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

#### 6.3 Progressive Web App (PWA)
- Service Worker for offline support
- Cache tree data locally
- Background sync for uploads
- Install prompt

#### 6.4 Real-time Updates (Phase 2)
**Use:** WebSockets (Socket.io) or Server-Sent Events

**Use Cases:**
- Live collaboration on family tree
- Real-time notifications
- Presence indicators

---

## 📊 7. Monitoring & Observability

### 7.1 Application Monitoring
**Use:** 
- **APM:** New Relic, Datadog, or AWS X-Ray
- **Error Tracking:** Sentry
- **Logging:** Winston + CloudWatch/ELK Stack

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Structured logging
logger.info('Person created', {
  personId,
  familyId,
  userId,
  timestamp: new Date()
});
```

### 7.2 Metrics to Track

**Business Metrics:**
- Active families
- Subscription conversions
- Feature usage
- User retention

**Technical Metrics:**
- API response times
- Error rates
- Database query performance
- Cache hit rates
- Storage usage per family

### 7.3 Health Checks
```javascript
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: await checkDatabase(),
    redis: await checkRedis(),
    s3: await checkS3()
  };
  
  const statusCode = health.database && health.redis ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

## 🚀 8. Deployment Architecture

### 8.1 Recommended Stack

#### Option A: AWS (Recommended)
```
┌─────────────────────────────────────┐
│         CloudFront (CDN)            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    Application Load Balancer        │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│  ECS  │ │  ECS  │ │  ECS  │
│ Task  │ │ Task  │ │ Task  │
└───┬───┘ └───┬───┘ └───┬───┘
    │          │          │
    └──────────┼──────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│  RDS  │ │ ElastiCache│  S3  │
│(Postgres)│  (Redis)  │      │
└────────┘ └──────────┘ └──────┘
```

**Services:**
- **Compute:** ECS Fargate or EKS
- **Database:** RDS PostgreSQL (Multi-AZ)
- **Cache:** ElastiCache (Redis)
- **Storage:** S3 + CloudFront
- **Monitoring:** CloudWatch
- **CI/CD:** CodePipeline + CodeBuild

#### Option B: Docker + Kubernetes
```
Kubernetes Cluster
├── API Deployment (3+ replicas)
├── Redis Deployment
├── PostgreSQL StatefulSet
└── Ingress Controller (Nginx)
```

### 8.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - build Docker image
      - push to ECR

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - deploy to ECS
      - run database migrations
      - health check
```

### 8.3 Environment Strategy
- **Development:** Local + Docker Compose
- **Staging:** Small AWS instance (mirrors production)
- **Production:** Full AWS stack with auto-scaling

---

## 🧪 9. Testing Strategy

### 9.1 Test Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /────\     
     /      \    Integration Tests (30%)
    /────────\   
   /          \  Unit Tests (60%)
  /────────────\
```

### 9.2 Testing Stack

**Backend:**
- **Unit:** Jest
- **Integration:** Supertest
- **E2E:** Postman/Newman

**Frontend:**
- **Unit:** Jest + React Testing Library
- **E2E:** Cypress or Playwright

### 9.3 Test Coverage Goals
- Unit Tests: 80%+
- Integration Tests: Critical paths
- E2E Tests: User journeys

---

## 🔮 10. Future Considerations

### 10.1 Graph Database (Phase 3)
**Consider:** Neo4j for complex relationship queries

**When:**
- Families with 1000+ persons
- Complex relationship queries
- Relationship pathfinding

### 10.2 Search Functionality
**Use:** Elasticsearch or Algolia

**Features:**
- Full-text search across persons
- Fuzzy name matching
- Advanced filters

### 10.3 AI/ML Features
- **Face Recognition:** Match photos to persons
- **Relationship Prediction:** Suggest missing relationships
- **Story Generation:** AI-assisted biography writing
- **Duplicate Detection:** Find duplicate persons

### 10.4 Mobile App
- **React Native:** Share codebase with web
- **Offline-first:** Sync when online
- **Native features:** Camera, GPS, contacts

---

## 📋 11. Implementation Roadmap

### Phase 1: Foundation (Months 1-2)
- [ ] Database connection pool optimization
- [ ] Add database migrations
- [ ] Implement rate limiting
- [ ] Add comprehensive logging
- [ ] Set up error tracking (Sentry)
- [ ] Add health checks
- [ ] Implement caching (Redis)

### Phase 2: Performance (Months 3-4)
- [ ] Add database indexes
- [ ] Implement pagination
- [ ] Set up CDN
- [ ] Image processing pipeline
- [ ] Query optimization
- [ ] Frontend code splitting

### Phase 3: Scale (Months 5-6)
- [ ] Horizontal scaling setup
- [ ] Read replicas
- [ ] Message queue
- [ ] Advanced monitoring
- [ ] Load testing

### Phase 4: Advanced (Months 7-12)
- [ ] Microservices consideration
- [ ] Graph database evaluation
- [ ] Search functionality
- [ ] AI/ML features
- [ ] Mobile app

---

## 🎯 12. Key Metrics & KPIs

### Technical KPIs
- **API Response Time:** < 200ms (p95)
- **Uptime:** 99.9%
- **Error Rate:** < 0.1%
- **Database Query Time:** < 50ms (p95)

### Business KPIs
- **User Registration:** Track conversion
- **Active Families:** DAU/MAU
- **Subscription Conversion:** Free → Premium
- **Feature Adoption:** Tree view usage

---

## 📚 13. Recommended Tools & Services

### Development
- **Database Migrations:** node-pg-migrate
- **API Documentation:** Swagger/OpenAPI
- **Code Quality:** ESLint, Prettier
- **Type Safety:** TypeScript (consider migration)

### Infrastructure
- **Containerization:** Docker
- **Orchestration:** Kubernetes or ECS
- **Monitoring:** Datadog or New Relic
- **Error Tracking:** Sentry
- **Logging:** CloudWatch or ELK

### Security
- **Secrets Management:** AWS Secrets Manager
- **Vulnerability Scanning:** Snyk
- **DDoS Protection:** Cloudflare or AWS Shield

---

## ✅ Summary

**Immediate Priorities:**
1. Database connection pool configuration
2. Add database migrations
3. Implement rate limiting
4. Set up monitoring & logging
5. Add Redis caching

**Quick Wins:**
- Database indexes (30 min, huge impact)
- Pagination (2 hours)
- Error boundaries (1 hour)
- Health checks (1 hour)

**Long-term Vision:**
- Scalable multi-tenant architecture
- High availability (99.9% uptime)
- Global reach with CDN
- AI-powered features
- Mobile presence

---

*This architecture is designed to scale from hundreds to millions of families while maintaining performance, security, and developer productivity.*

