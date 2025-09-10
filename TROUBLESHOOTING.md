# 🔧 Troubleshooting Guide

This guide helps you resolve common issues when developing, deploying, and using your Fluid droplet.

## 🚀 Quick Diagnostics

If something isn't working, run these commands first:

```bash
# Check if your backend is running
curl http://localhost:3001/health

# Test your Fluid API connection
curl -X POST http://localhost:3001/api/droplet/test-connection \
  -H "Content-Type: application/json" \
  -d '{"fluidApiKey":"YOUR_API_KEY"}'

# Run the test suite
npm test
```

---

## 🏗️ Setup and Installation Issues

### ❌ Auto-setup fails with "PostgreSQL not found"

**Symptoms:**
- `./setup.sh` or `npm run setup` fails
- Error: "PostgreSQL is not installed"

**Solutions:**
```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/

# Then retry setup
npm run setup:full
```

### ❌ Database connection fails

**Symptoms:**
- "connection refused" errors
- "password authentication failed"

**Solutions:**
```bash
# Check if PostgreSQL is running
pg_isready

# Check your DATABASE_URL in backend/.env
cat backend/.env | grep DATABASE_URL

# Test connection manually
psql "postgresql://user:password@localhost:5432/fluid_droplet_db"

# Reset database if needed
dropdb fluid_droplet_db
createdb fluid_droplet_db
npm run migrate
```

### ❌ Node.js version issues

**Symptoms:**
- "node: command not found"
- Version compatibility errors

**Solutions:**
```bash
# Check Node.js version
node --version

# Should be 18+. If not, install latest:
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
nvm use node

# Or download from https://nodejs.org/
```

### ❌ npm install fails

**Symptoms:**
- Permission errors
- Network timeouts
- Missing dependencies

**Solutions:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
npm run install:all

# If permission issues (avoid using sudo)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

---

## 🌐 API and Connection Issues

### ❌ Fluid API connection fails

**Symptoms:**
- "Authentication failed" (401)
- "Unable to connect to Fluid platform"

**Solutions:**
1. **Check your API key:**
   ```bash
   # API key should start with "PT-"
   echo $FLUID_API_KEY
   
   # Test the key manually
   curl -H "Authorization: Bearer YOUR_API_KEY" https://api.fluid.app/api/company/users
   ```

2. **Verify API permissions:**
   - Ensure your API key has droplet creation/management permissions
   - Check in Fluid platform dashboard under API keys

3. **Check API URL:**
   ```bash
   # Should be https://api.fluid.app (default)
   echo $FLUID_API_URL
   ```

### ❌ CORS errors in browser

**Symptoms:**
- "blocked by CORS policy"
- Cross-origin request errors

**Solutions:**
```bash
# Check FRONTEND_URL in backend/.env
cat backend/.env | grep FRONTEND_URL

# Should match your actual frontend URL
# For local development: http://localhost:3000
# For production: https://your-frontend.onrender.com
```

### ❌ Webhook signature validation fails

**Symptoms:**
- "Invalid webhook signature"
- Webhook events not processing

**Solutions:**
1. **Check webhook secret:**
   ```bash
   # Ensure FLUID_WEBHOOK_SECRET is set and matches Fluid platform
   cat backend/.env | grep FLUID_WEBHOOK_SECRET
   ```

2. **Test webhook endpoint:**
   ```bash
   # Test webhook health
   curl -X POST http://localhost:3001/api/webhook/health
   
   # Test with sample payload
   curl -X POST http://localhost:3001/api/webhook/fluid \
     -H "Content-Type: application/json" \
     -H "X-Fluid-Signature: sha256=test" \
     -d '{"event":"droplet_installation.created","data":{"droplet_installation":{"id":"test"}}}'
   ```

---

## 🚀 Deployment Issues

### ❌ Render deployment fails

**Symptoms:**
- Build failures
- Environment variable issues
- Database connection errors in production

**Solutions:**
1. **Check build logs in Render dashboard**

2. **Verify environment variables:**
   ```bash
   # Required variables in Render backend service:
   - FLUID_API_KEY=PT-your-key
   - DROPLET_ID=drp-your-uuid
   - FLUID_WEBHOOK_SECRET=your-secret
   - DATABASE_URL (auto-set by Render)
   - FRONTEND_URL=https://your-frontend.onrender.com
   ```

3. **Run migrations manually:**
   ```bash
   # In Render shell for backend service:
   npm run migrate
   ```

4. **Check service URLs:**
   - Frontend service should be accessible
   - Backend service should respond to health checks
   - Database should be connected

### ❌ Migration failures

**Symptoms:**
- "migration failed" errors
- Database schema issues

**Solutions:**
```bash
# Check migration status
npm run migrate:status

# Reset migrations (CAUTION: loses data)
# Connect to database and drop tables:
psql $DATABASE_URL
DROP TABLE IF EXISTS migrations, droplet_installations, activity_logs, webhook_events, custom_data;
\q

# Re-run migrations
npm run migrate
```

### ❌ Frontend can't connect to backend

**Symptoms:**
- API calls fail
- "Network Error" in browser console

**Solutions:**
1. **Check environment variables:**
   ```bash
   # Frontend .env.local should have:
   VITE_API_BASE_URL=http://localhost:3001  # local
   # OR
   VITE_API_BASE_URL=https://your-backend.onrender.com  # production
   ```

2. **Verify backend is running:**
   ```bash
   # Should return health status
   curl https://your-backend.onrender.com/health
   ```

---

## 🧪 Droplet Functionality Issues

### ❌ Auto-setup not working

**Symptoms:**
- Droplet installation doesn't auto-configure
- User sees configuration form instead of dashboard

**Solutions:**
1. **Check webhook processing:**
   ```bash
   # Look for webhook events in database
   psql $DATABASE_URL -c "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 5;"
   ```

2. **Verify droplet ID:**
   ```bash
   # Should match the UUID from create-droplet script
   cat backend/.env | grep DROPLET_ID
   ```

3. **Check installation flow:**
   - Installation URL should include proper parameters
   - Company data should be available from webhooks

### ❌ Company name not appearing correctly

**Symptoms:**
- Shows "Your Company" instead of real company name
- Dashboard shows placeholder data

**Solutions:**
1. **Check webhook data:**
   ```bash
   # Look for company data in installations
   psql $DATABASE_URL -c "SELECT installation_id, company_name, configuration FROM droplet_installations;"
   ```

2. **Verify API responses:**
   ```bash
   # Test company info endpoint
   curl -H "Authorization: Bearer YOUR_API_KEY" https://api.fluid.app/api/company/users
   ```

### ❌ Dashboard not loading

**Symptoms:**
- Blank dashboard
- API errors in browser console

**Solutions:**
1. **Check installation ID:**
   ```bash
   # URL should have valid installation_id parameter
   # Example: /dashboard?installation_id=install_abc123&fluid_api_key=PT-key
   ```

2. **Verify database records:**
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM droplet_installations WHERE installation_id = 'YOUR_ID';"
   ```

---

## 🔍 Debugging Tips

### Enable Debug Logging

```bash
# Backend - add to .env
LOG_LEVEL=debug

# Check logs in production (Render)
# Go to: Dashboard → Backend Service → Logs
```

### Browser Developer Tools

1. **Open browser dev tools (F12)**
2. **Check Console tab** for JavaScript errors
3. **Check Network tab** for failed API calls
4. **Look for CORS or authentication errors**

### Database Inspection

```bash
# Connect to your database
psql $DATABASE_URL

# Check table contents
\dt  # List tables
SELECT * FROM droplet_installations;
SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10;

# Exit
\q
```

### API Testing

```bash
# Test each endpoint manually
curl -X GET http://localhost:3001/health
curl -X GET http://localhost:3001/api/droplet/status/new-installation
curl -X POST http://localhost:3001/api/droplet/test-connection \
  -H "Content-Type: application/json" \
  -d '{"fluidApiKey":"YOUR_KEY"}'
```

---

## 📞 Getting Help

### 1. Check logs first
- **Local development:** Check terminal output
- **Production (Render):** Check service logs in dashboard
- **Browser:** Check developer console

### 2. Run diagnostics
```bash
# Run the test suite
npm test

# Check system status
node -e "console.log('Node:', process.version); console.log('Platform:', process.platform);"
pg_isready
```

### 3. Common error patterns

| Error Pattern | Likely Cause | Solution |
|--------------|-------------|----------|
| `ECONNREFUSED` | Service not running | Start the service |
| `401 Unauthorized` | Invalid API key | Check API key format |
| `404 Not Found` | Wrong URL/endpoint | Verify API URLs |
| `CORS error` | Frontend/backend mismatch | Update FRONTEND_URL |
| `Migration failed` | Database schema issue | Reset and re-run migrations |
| `Webhook signature invalid` | Wrong secret | Update FLUID_WEBHOOK_SECRET |

### 4. Create minimal reproduction

If you're still stuck:

1. **Create a minimal test case** that reproduces the issue
2. **Include relevant logs** and error messages
3. **Check if the issue exists in a fresh clone** of the template
4. **Document your environment:** OS, Node version, deployment platform

### 5. Reset everything (last resort)

```bash
# Nuclear option - start completely fresh
rm -rf node_modules backend/node_modules
rm -rf .env.local backend/.env
dropdb fluid_droplet_db
createdb fluid_droplet_db

# Re-run setup
npm run install:all
npm run setup:full
```

---

## ⚡ Performance Issues

### Slow API responses

1. **Check database indexes:**
   ```sql
   -- All tables should have proper indexes (already included in migrations)
   \d+ droplet_installations
   ```

2. **Monitor database connections:**
   ```bash
   # Check for connection leaks
   psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'droplet_db';"
   ```

3. **Add caching if needed** (not included in template)

### High memory usage

1. **Check for memory leaks** in Node.js code
2. **Monitor database query performance**
3. **Consider connection pooling** for high-traffic applications

---

## 🔒 Security Issues

### Exposed secrets

1. **Check git history:**
   ```bash
   git log --grep="password\|secret\|key" --oneline
   ```

2. **Use environment variables only:**
   - Never commit `.env` files
   - Use Render's environment variable settings
   - Rotate any exposed secrets immediately

### API security

1. **Verify webhook signatures** are being validated
2. **Check CORS settings** allow only your domains
3. **Use HTTPS** in production only
4. **Monitor for unusual API activity**

---

Remember: Most issues are environment-related. Double-check your `.env` files and environment variables first! 🎯