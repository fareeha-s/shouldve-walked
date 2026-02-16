# Complete Deployment Guide (Non-Technical)

This guide walks you through deploying "what you missed" to Vercel so anyone can use it online.

## Part 1: Get Your API Keys (15 minutes)

### Google Maps API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a new project**
   - Click the project dropdown at the top
   - Click "New Project"
   - Name it: "what-you-missed"
   - Click "Create"

3. **Enable the APIs**
   - In the search bar at the top, type: "Directions API"
   - Click on it, then click "Enable"
   - Repeat for: "Places API" and "Maps JavaScript API"

4. **Create an API key**
   - In the left sidebar, click "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the key that appears (save it somewhere!)
   - Click "Restrict Key" (recommended)
   - Under "API restrictions", select "Restrict key"
   - Choose these 3 APIs:
     - Directions API
     - Places API
     - Maps JavaScript API
   - Click "Save"

5. **Set up billing** (don't worry - you get $200/month free)
   - Click "Billing" in the left sidebar
   - Click "Link a billing account"
   - Add a credit card (won't be charged unless you go over $200/month)

### OpenAI API Key

1. **Go to OpenAI Platform**
   - Visit: https://platform.openai.com/
   - Sign in or create an account

2. **Add payment method**
   - Click your profile icon → "Settings"
   - Go to "Billing"
   - Click "Add payment method"
   - Add a credit card

3. **Set spending limits** (IMPORTANT!)
   - Still in Billing, click "Limits"
   - Set "Hard limit" to $20
   - Set "Email alerts" at $15
   - Click "Save"

4. **Create API key**
   - Click "API Keys" in the left sidebar
   - Click "Create new secret key"
   - Name it: "what-you-missed"
   - Copy the key (you'll never see it again!)
   - Save it somewhere safe

## Part 2: Deploy to Vercel (10 minutes)

### Option A: Deploy from GitHub (Recommended)

1. **Push code to GitHub**
   - If you haven't already, create a GitHub account: https://github.com/
   - Create a new repository called "what-you-missed"
   - Follow GitHub's instructions to push your code

2. **Sign up for Vercel**
   - Go to: https://vercel.com/signup
   - Click "Continue with GitHub"
   - Authorize Vercel

3. **Import your project**
   - Click "Add New..." → "Project"
   - Find "what-you-missed" in the list
   - Click "Import"

   **IMPORTANT: Configure Root Directory**
   - On the "Configure Project" screen, look for "Root Directory"
   - Click "Edit" next to Root Directory
   - Type: `dallas`
   - Click "Continue"

   (This is required because the Next.js app is in the `/dallas` folder, not the repository root)

4. **Add environment variables**
   - Before deploying, scroll down to "Environment Variables"
   - Add these 3 variables:

   **Variable 1:**
   - Name: `GOOGLE_MAPS_API_KEY`
   - Value: [paste your Google Maps API key]

   **Variable 2:**
   - Name: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - Value: [paste the SAME Google Maps API key]

   **Variable 3:**
   - Name: `OPENAI_API_KEY`
   - Value: [paste your OpenAI API key]

5. **Deploy!**
   - Click "Deploy"
   - Wait 2-3 minutes
   - You'll get a URL like: `what-you-missed.vercel.app`

### Option B: Deploy with Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked for environment variables, add the 3 API keys above

## Part 3: Update Google Maps API Restrictions

Now that you have a Vercel URL, secure your Google Maps API key:

1. **Go back to Google Cloud Console**
   - https://console.cloud.google.com/apis/credentials

2. **Click on your API key**

3. **Add website restrictions**
   - Under "Application restrictions"
   - Select "HTTP referrers"
   - Click "Add an item"
   - Add these:
     - `https://what-you-missed.vercel.app/*` (your actual URL)
     - `https://*.vercel.app/*` (for preview deployments)
     - `http://localhost:3000/*` (for local development)

4. **Save**

## Part 4: Test It!

1. **Visit your URL**
   - Go to your Vercel URL
   - Try entering two SF addresses like:
     - Pickup: "Tartine Bakery"
     - Dropoff: "Dolores Park"

2. **Check if autocomplete works**
   - Start typing "RT Roti" in the pickup field
   - You should see "RT Rotisserie" appear in the dropdown

3. **Monitor usage**
   - Visit: `your-url.vercel.app/api/status`
   - Should show: `{"remaining":1500,"limit":1500,"used":0}`

## Troubleshooting

### "No framework detected" or 404 error on Vercel

This happens when Vercel can't find the Next.js app because it's in the `/dallas` subdirectory.

**Fix for existing deployments:**
1. Go to your project on Vercel
2. Click "Settings" (top right)
3. Scroll down to "Build & Development Settings"
4. Find "Root Directory"
5. Click "Edit"
6. Enter: `dallas`
7. Click "Save"
8. Go to "Deployments" tab
9. Click the three dots (...) on the latest deployment
10. Click "Redeploy"

**Fix during new deployment:**
- When importing the project, on the "Configure Project" screen
- Look for "Root Directory" section
- Click "Edit"
- Type: `dallas`
- Then continue with environment variables

If you still don't see the Root Directory option:
- Make sure you're on the "Configure Project" page (right after clicking Import)
- It should be under "Framework Preset" section
- If you already deployed and can't find it in Settings, try deleting the project and re-importing it

### "Failed to load Google Maps"
- Check that all 3 APIs are enabled in Google Cloud Console
- Verify your API key is added to Vercel environment variables
- Make sure you added BOTH `GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### "Could not get directions"
- Verify addresses are in San Francisco
- Check Google Cloud Console → Billing is set up
- Look at Vercel logs: go to your project → "Logs" tab

### "Failed to generate descriptions"
- Check OpenAI API key is correct in Vercel
- Verify you have credits in OpenAI account
- Check OpenAI usage: https://platform.openai.com/usage

### Autocomplete not working
- Make sure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set (has to start with NEXT_PUBLIC_)
- Check browser console for errors (right-click → Inspect → Console)
- Verify Places API is enabled in Google Cloud

## Updating Your App

After you deploy, any changes you push to GitHub will automatically deploy to Vercel.

```bash
git add .
git commit -m "update something"
git push
```

Vercel will rebuild and deploy in ~2 minutes.

## Costs

With the limits in place:
- **Google Maps**: $0 (covered by $200/month free tier)
- **OpenAI**: Max $20 (hard limited)
- **Vercel**: $0 (free hobby plan)

**Total max cost: $20/month**

## Custom Domain (Optional)

Want to use your own domain like `whatyoumissed.com`?

1. **Buy a domain** (from Namecheap, Google Domains, etc.)

2. **Add to Vercel**
   - In your Vercel project, click "Settings"
   - Click "Domains"
   - Add your domain
   - Follow the DNS instructions

3. **Update Google Maps restrictions**
   - Add your custom domain to the HTTP referrers list
   - Format: `https://whatyoumissed.com/*`
