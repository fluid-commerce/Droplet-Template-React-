# Droplet Setup Scripts

This directory contains helpful scripts for setting up and managing your Fluid droplet.

## Available Scripts

### `create-droplet.js`

Creates a new droplet in the Fluid platform and provides the droplet UUID for configuration.

**Usage:**
```bash
# Set your Fluid API key and run the script
FLUID_API_KEY=your_api_key_here node scripts/create-droplet.js

# Or set your embed URL as well
FLUID_API_KEY=your_api_key_here EMBED_URL=https://your-app.onrender.com/ node scripts/create-droplet.js
```

**What it does:**
1. Creates a new droplet in Fluid with your app name and embed URL
2. Returns the droplet UUID that you need for configuration
3. Provides step-by-step instructions for updating your environment variables

**Configuration:**
- Update `FLUID_API_KEY` in the script or set as environment variable
- Update `EMBED_URL` to your deployed frontend URL
- The script automatically reads your app name from `package.json`

**Output:**
The script will provide:
- Droplet UUID for your `DROPLET_ID` environment variable
- Instructions for updating `render.yaml`
- Next steps for deployment

## Environment Variables

Make sure you have these set before running the scripts:

- `FLUID_API_KEY` - Your Fluid platform API key (required)
- `EMBED_URL` - Your deployed frontend URL (optional, defaults to placeholder)

## Example Workflow

1. **Deploy your droplet** to Render or your preferred platform
2. **Get your frontend URL** (e.g., `https://your-app.onrender.com/`)
3. **Run the create script:**
   ```bash
   FLUID_API_KEY=PT-your-key-here EMBED_URL=https://your-app.onrender.com/ node scripts/create-droplet.js
   ```
4. **Update your backend** with the returned droplet UUID
5. **Redeploy your backend** with the new `DROPLET_ID`
6. **Test your droplet** installation flow

## Troubleshooting

**Authentication Error (401):**
- Check that your `FLUID_API_KEY` is correct
- Ensure your API key has permission to create droplets

**Embed URL Error:**
- Make sure your frontend is deployed and accessible
- The URL should end with a trailing slash (`/`)

**Droplet Creation Failed:**
- Check the Fluid API documentation for any changes
- Verify your API key permissions
- Try with a simpler droplet configuration first
