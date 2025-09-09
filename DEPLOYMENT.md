# Deployment Guide

This guide covers how to deploy the Fluid Droplet Template to production with proper database migration handling.

## 🚀 Deployment Platforms

### Render.com (Recommended)

1. **Connect your GitHub repository** to Render
2. **Create services** using the `render.yaml` configuration
3. **Set environment variables** in the Render dashboard
4. **Run migrations manually** before deploying

### Heroku

1. **Create Heroku apps** for frontend and backend
2. **Add PostgreSQL addon** to backend app
3. **Set environment variables**
4. **Run migrations** before deploying

## 📋 Pre-Deployment Checklist

### 1. Environment Variables

Set these in your deployment platform:

**Backend Environment Variables:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/database
FLUID_API_KEY=your-builder-api-key
FLUID_API_URL=https://your-org.fluid.app
FLUID_WEBHOOK_SECRET=your-webhook-secret
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

**Frontend Environment Variables:**
```bash
VITE_API_BASE_URL=https://your-backend-url.com
VITE_FLUID_API_URL=https://your-org.fluid.app
```

### 2. Database Setup

**Option A: Manual Migration (Recommended)**
```bash
# 1. Deploy your backend first
# 2. Connect to your production database
# 3. Run migrations manually
npm run migrate

# 4. Verify migrations
npm run migrate:status
```

**Option B: Automated Migration (Advanced)**
```bash
# Add to your build command in render.yaml:
buildCommand: cd backend && npm install && npm run build && cd .. && npm run migrate
```

## 🔄 Migration Strategy

### ✅ Recommended Approach: Manual Migrations

1. **Deploy backend** without running migrations
2. **Connect to production database** 
3. **Run migrations manually** with monitoring
4. **Verify data integrity**
5. **Deploy frontend**

### ⚠️ Alternative: Automated Migrations

Only use this if you're confident in your migrations:

```yaml
# In render.yaml
buildCommand: cd backend && npm install && npm run build && cd .. && npm run migrate
```

**Risks:**
- Can break production if migration fails
- No rollback capability
- Harder to debug issues

## 🛠️ Deployment Commands

### Render.com
```bash
# 1. Push to GitHub
git add .
git commit -m "Deploy droplet template"
git push

# 2. Deploy services (automatic via GitHub integration)
# 3. Run migrations manually
npm run migrate
```

### Heroku
```bash
# 1. Create apps
heroku create your-droplet-backend
heroku create your-droplet-frontend

# 2. Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev -a your-droplet-backend

# 3. Set environment variables
heroku config:set NODE_ENV=production -a your-droplet-backend
heroku config:set FLUID_API_KEY=your-key -a your-droplet-backend

# 4. Deploy
git push heroku main

# 5. Run migrations
heroku run npm run migrate -a your-droplet-backend
```

## 🔍 Post-Deployment Verification

1. **Check migration status:**
   ```bash
   npm run migrate:status
   ```

2. **Test database connection:**
   ```bash
   node -e "require('./database/config').Database.testConnection()"
   ```

3. **Verify API endpoints:**
   ```bash
   curl https://your-backend-url.com/health
   ```

4. **Test droplet configuration:**
   - Create droplet in Fluid with your deployed URL
   - Install the droplet
   - Verify configuration flow works

## 🚨 Troubleshooting

### Migration Issues
```bash
# Check database connection
psql $DATABASE_URL

# Verify tables exist
\dt

# Check migration history
SELECT * FROM migrations;
```

### Deployment Issues
```bash
# Check logs
heroku logs --tail -a your-app-name

# Restart services
heroku restart -a your-app-name
```

## 📚 Best Practices

1. **Always backup** before running migrations
2. **Test migrations** on staging environment first
3. **Run migrations** during low-traffic periods
4. **Monitor** application after migration
5. **Have rollback plan** ready
6. **Document** any manual steps required

## 🔒 Security Considerations

- **Never commit** database credentials
- **Use environment variables** for all secrets
- **Enable SSL** for all connections
- **Rotate secrets** regularly
- **Monitor** for security issues

## 📞 Support

If you encounter issues during deployment:
1. Check the logs in your deployment platform
2. Verify environment variables are set correctly
3. Ensure database is accessible
4. Test migrations locally first
