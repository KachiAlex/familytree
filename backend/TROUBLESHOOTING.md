# Troubleshooting Guide

## Network Connection Issues with npm install

If you're experiencing `ECONNRESET` errors when running `npm install`, try these solutions:

### Solution 1: Retry with Increased Timeout
```powershell
npm install --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
```

### Solution 2: Clear npm Cache
```powershell
npm cache clean --force
npm install
```

### Solution 3: Use Alternative Registry (if behind firewall)
```powershell
npm install --registry https://registry.npmmirror.com
```

### Solution 4: Install Dependencies One by One
If bulk install fails, install critical packages individually:
```powershell
npm install helmet
npm install morgan
npm install express-rate-limit
npm install joi
```

### Solution 5: Check Network/Proxy Settings
```powershell
# Check npm config
npm config list

# If behind proxy, configure it:
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Or remove proxy if not needed:
npm config delete proxy
npm config delete https-proxy
```

### Solution 6: Use Yarn (Alternative Package Manager)
```powershell
# Install yarn globally first
npm install -g yarn

# Then use yarn instead
yarn install
```

### Solution 7: Install Without Optional Dependencies
```powershell
npm install --no-optional
```

---

## If Dependencies Still Won't Install

### Workaround: Run Without New Dependencies (Temporary)

You can temporarily comment out the new features to get the server running:

1. **Comment out new imports in `server.js`:**
```javascript
// const helmet = require('helmet');
// const morgan = require('morgan');
// const { apiLimiter } = require('./src/middleware/rateLimiter');
```

2. **Comment out middleware usage:**
```javascript
// app.use(helmet());
// app.use(morgan('dev'));
// app.use('/api/', apiLimiter);
```

3. **Comment out environment validation:**
```javascript
// require('./src/config/env');
```

This will let you run the server with existing functionality while you resolve the network issues.

---

## Verify Installation

After successful installation, verify:
```powershell
npm list --depth=0
```

You should see:
- helmet
- morgan
- express-rate-limit
- joi

---

## Alternative: Manual Package Installation

If network issues persist, you can download packages manually or use a different network connection.

