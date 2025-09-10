# 🚀 Fluid Droplet Setup Guide

This guide walks you through creating and configuring your droplet in the Fluid platform. Follow these steps after deploying your template to get your droplet live and ready for users to install.

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ **Deployed your droplet** to Render (or your preferred platform)
- ✅ **Frontend URL** (e.g., `https://your-frontend.onrender.com`)
- ✅ **Backend URL** (e.g., `https://your-backend.onrender.com`)
- ✅ **Fluid API Key** from your Fluid builder account
- ✅ **Logo URL** (optional - can use placeholder initially)

## 🎯 Step 1: Create Your Droplet

### Manual API Call Method:

**1. Create the droplet in Fluid:**

```bash
curl -X POST https://api.fluid.app/api/droplets \
  -H "Authorization: Bearer YOUR_FLUID_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "droplet": {
      "name": "Your Droplet Name",
      "embed_url": "https://your-frontend-url.onrender.com/",
      "active": true,
      "settings": {
        "marketplace_page": {
          "title": "Your Droplet Name",
          "summary": "Description of what your droplet does",
          "logo_url": "https://your-logo-url.com/logo.png"
        },
        "details_page": {
          "title": "Your Droplet Name", 
          "summary": "Description of what your droplet does",
          "logo_url": "https://your-logo-url.com/logo.png"
        }
      }
    }
  }'
```

**2. Extract the Droplet UUID from the response:**

The API will return something like:
```json
{
  "droplet": {
    "uuid": "drp_abc123xyz789",
    "name": "Your Droplet Name",
    "embed_url": "https://your-frontend.onrender.com/",
    "active": true
  }
}
```

**Copy the `uuid` value** - this is your `DROPLET_ID`.

### Alternative: Node.js Script Method

If you prefer using Node.js, create a temporary script:

```javascript
// temp-create-droplet.js
import axios from 'axios';

const FLUID_API_URL = 'https://api.fluid.app';
const FLUID_API_KEY = 'YOUR_FLUID_API_KEY_HERE';
const EMBED_URL = 'https://your-frontend.onrender.com/';
const LOGO_URL = 'https://your-logo-url.com/logo.png';
const APP_NAME = 'Your Droplet Name';
const APP_DESCRIPTION = 'Description of what your droplet does';

async function createDroplet() {
  try {
    const response = await axios.post(`${FLUID_API_URL}/api/droplets`, {
      droplet: {
        name: APP_NAME,
        embed_url: EMBED_URL,
        active: true,
        settings: {
          marketplace_page: {
            title: APP_NAME,
            summary: APP_DESCRIPTION,
            logo_url: LOGO_URL
          },
          details_page: {
            title: APP_NAME,
            summary: APP_DESCRIPTION,
            logo_url: LOGO_URL
          }
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${FLUID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const dropletId = response.data.droplet?.uuid;
    console.log('✅ Droplet created successfully!');
    console.log(`🆔 Droplet UUID: ${dropletId}`);
    console.log(`📋 Name: ${response.data.droplet.name}`);
    console.log(`🔗 Embed URL: ${response.data.droplet.embed_url}`);
    
    return dropletId;
  } catch (error) {
    console.error('❌ Failed to create droplet:', error.response?.data || error.message);
  }
}

createDroplet();
```

Run it:
```bash
node temp-create-droplet.js
```

Then delete the script when done.

## 🔧 Step 2: Configure Your Backend

**1. Update your backend environment variables:**

In your Render dashboard (or deployment platform), set:
```bash
DROPLET_ID=drp_abc123xyz789  # The UUID from step 1
```

**2. Update render.yaml (if using Render):**

```yaml
# In render.yaml, update the DROPLET_ID value:
envVars:
  - key: DROPLET_ID
    value: drp_abc123xyz789  # Your actual droplet UUID
```

**3. Redeploy your backend:**

In Render dashboard → Backend Service → Manual Deploy

## ✅ Step 3: Test Your Droplet

**1. Verify your droplet appears in Fluid:**
- Log into your Fluid builder account
- Go to Droplets section
- You should see your newly created droplet

**2. Test the installation flow:**
- Click "Install" on your droplet
- You should be redirected to your frontend
- The auto-setup should recognize your company and configure automatically
- You should see "Welcome, [Your Company]!" and be redirected to success page

## 🎨 Step 4: Enhance Your Droplet (Optional)

### Update Logo and Description

If you want to update your droplet's appearance later:

```bash
curl -X PATCH https://api.fluid.app/api/droplets/YOUR_DROPLET_ID \
  -H "Authorization: Bearer YOUR_FLUID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "droplet": {
      "name": "Updated Droplet Name",
      "settings": {
        "marketplace_page": {
          "title": "Updated Droplet Name",
          "summary": "🚀 Updated description with emojis and better copy",
          "logo_url": "https://your-new-logo-url.com/logo.png"
        },
        "details_page": {
          "title": "Updated Droplet Name",
          "summary": "🚀 Updated description with emojis and better copy", 
          "logo_url": "https://your-new-logo-url.com/logo.png"
        }
      }
    }
  }'
```

## 🔍 Troubleshooting

### Common Issues:

**❌ "Authentication failed" (401 error)**
- Verify your `FLUID_API_KEY` is correct
- Ensure your API key has droplet creation permissions
- Check that you're using `Bearer YOUR_KEY` format

**❌ "Droplet not found" (404 error)**
- Double-check your `DROPLET_ID` is correct
- Ensure the droplet exists in your Fluid account
- Verify you're using the UUID, not the name

**❌ "Embed URL not accessible"**
- Ensure your frontend is deployed and publicly accessible
- Test the URL in a browser
- Make sure CORS is properly configured

**❌ "Auto-setup not working"**
- Check that your backend is receiving webhooks at `/api/webhook/fluid`
- Verify the `DROPLET_ID` environment variable is set in backend
- Check backend logs for webhook processing errors

### Verification Steps:

**1. Check droplet status:**
```bash
curl -X GET https://api.fluid.app/api/droplets/YOUR_DROPLET_ID \
  -H "Authorization: Bearer YOUR_FLUID_API_KEY"
```

**2. Test your frontend directly:**
```bash
curl https://your-frontend.onrender.com/
# Should return your React app HTML
```

**3. Test your backend health:**
```bash
curl https://your-backend.onrender.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

**4. Test webhook endpoint:**
```bash
curl -X POST https://your-backend.onrender.com/api/webhook/health
# Should return webhook health status
```

## 📞 Getting Help

If you encounter issues:

1. **Check the logs** in your deployment platform
2. **Verify environment variables** are set correctly
3. **Test API endpoints** manually with curl
4. **Check Fluid platform status** for any outages
5. **Review the webhook payload** in backend logs

## 🎉 Success!

Once completed, your droplet will:
- ✅ Appear in the Fluid marketplace
- ✅ Auto-configure when users click "Install"
- ✅ Show the user's company name immediately
- ✅ Redirect to your success/dashboard page
- ✅ Handle all edge cases with fallback configuration form

Your droplet is now live and ready for users to install! 🚀

---

## 🗑️ Cleanup

After successfully creating your droplet, you can safely delete:
- Any temporary scripts you created
- The `scripts/` directory (no longer needed)
- This guide (keep for reference if helpful)

The droplet will continue working without these files since it's now registered in the Fluid platform.