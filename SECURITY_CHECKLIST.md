# Security & Cost Protection Checklist

Before launching, verify ALL of these:

## 🔒 API Key Security

### Google Maps API Key
- [ ] **Added HTTP referrer restrictions** in Google Cloud Console
  - Go to: https://console.cloud.google.com/apis/credentials
  - Click your API key → "Application restrictions"
  - Select "HTTP referrers"
  - Add: `https://your-app.vercel.app/*`, `https://*.vercel.app/*`, `http://localhost:3000/*`

- [ ] **Added API restrictions**
  - Same page, under "API restrictions"
  - Select "Restrict key"
  - Only allow: Directions API, Places API, Maps JavaScript API

- [ ] **Billing set up** (required for API to work)
  - https://console.cloud.google.com/billing

### OpenAI API Key
- [ ] **Set hard spending limit to $20**
  - Go to: https://platform.openai.com/settings/organization/limits
  - Set "Hard limit" to $20
  - THIS IS CRITICAL - Without this, you could spend more

- [ ] **Set email alert at $15**
  - Same page, set alert threshold
  - You'll get warning before hitting limit

- [ ] **Payment method added**
  - https://platform.openai.com/settings/organization/billing

### Vercel Environment Variables
- [ ] **All 3 environment variables added** in Vercel dashboard
  - `GOOGLE_MAPS_API_KEY`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - `OPENAI_API_KEY`

- [ ] **Never commit .env.local to git**
  - Already in .gitignore ✓
  - Double check with: `git status` (should not show .env.local)

## 💰 Cost Protection

- [ ] **OpenAI hard limit set to $20** (MOST IMPORTANT)
- [ ] **Code limits in place** (already done ✓)
  - 1,500 total requests
  - 10 requests/hour per IP
- [ ] **Monitor usage at**: https://platform.openai.com/usage

## 🚀 Before Launch

- [ ] **Test the app** with a few real addresses
- [ ] **Check autocomplete** works (type "RT Roti" should suggest restaurants)
- [ ] **Verify rate limiting** works:
  - Visit: `your-url.vercel.app/api/status`
  - Should show: `{"remaining":1500,"limit":1500,"used":0}`
- [ ] **Test error handling** (try invalid addresses)

## 🔍 After Launch

### Monitor Every Few Hours
- [ ] **OpenAI usage**: https://platform.openai.com/usage
- [ ] **App usage**: `your-url.vercel.app/api/status`
- [ ] **Vercel logs**: Check for errors in Vercel dashboard

### If Usage Is High
- Check `/api/status` endpoint
- If approaching 1,500 requests, the app will auto-stop
- If costs approaching $15, you'll get email from OpenAI

### Emergency Stop
If you need to pause everything immediately:
1. **Vercel**: Project Settings → "Pause Deployment"
2. **OpenAI**: Settings → Limits → Set hard limit to $0
3. **Google Maps**: Cloud Console → Disable APIs

## ⚠️ What NOT To Do

- ❌ Don't share your .env.local file
- ❌ Don't commit API keys to git
- ❌ Don't share API keys in Discord/Slack/Twitter
- ❌ Don't skip setting OpenAI hard limit
- ❌ Don't skip Google Maps domain restrictions

## ✅ What's Safe

- ✓ Sharing your Vercel URL publicly
- ✓ Open sourcing the code (API keys are in environment variables, not code)
- ✓ Tweeting about the app
- ✓ Having it on your GitHub (as long as .env.local is gitignored)

## 📊 Expected Costs

With all protections in place:
- **Google Maps**: $0 (within free tier)
- **OpenAI**: $0-20 (hard capped at $20)
- **Vercel**: $0 (free tier)

**Maximum possible cost: $20**

## 🆘 If Something Goes Wrong

### "My OpenAI costs are climbing fast"
- Go to https://platform.openai.com/settings/organization/limits
- Set hard limit to $0 immediately
- This stops all requests instantly

### "Someone is spamming my app"
- The app will auto-stop at 1,500 requests
- Each IP limited to 10 requests/hour
- If needed, pause Vercel deployment

### "My API key leaked"
1. **Immediately revoke** the key in Google Cloud Console or OpenAI
2. Create a new key
3. Update Vercel environment variables
4. Redeploy

## ✅ You're Protected If:

- ✅ OpenAI hard limit is set to $20
- ✅ Google Maps API key is domain-restricted
- ✅ .env.local is not in git
- ✅ All environment variables are in Vercel (not code)

**With all these in place, you cannot spend more than $20 and your keys are secure.**
