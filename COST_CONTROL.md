# Cost Control Guide

## Built-in Protections

The app has these cost controls built in:

### 1. **Global Request Limit: 1,500 requests**
- Caps total requests at ~1,500 (keeps you under $20)
- Automatically resets every 24 hours
- When limit is reached, app shows: "daily limit reached. this app got too popular. check back tomorrow."

### 2. **Per-User Rate Limit: 10 requests/hour**
- Prevents single user from spamming
- IP-based tracking
- Error message: "you've analyzed enough routes for now. take a walk."

### 3. **Efficient API Usage**
- Only samples every 3rd step for POI lookups (reduces Places API calls)
- Single LLM call generates all descriptions at once

## Additional OpenAI Safeguards

Set hard limits in your OpenAI dashboard:

1. Go to [OpenAI Settings > Limits](https://platform.openai.com/settings/organization/limits)
2. Set **Monthly Budget** to $20
3. Set **Email Alert** at $15 (gives you warning before hitting limit)
4. Enable **Hard Limit** to automatically stop requests at $20

## Monitoring Costs Live

### Check OpenAI Usage
- Dashboard: https://platform.openai.com/usage
- Shows real-time costs
- Updates every few minutes

### Check Google Maps Usage
- Console: https://console.cloud.google.com/google/maps-apis/metrics
- You get $200/month free, so this won't be an issue

### Monitor App Usage
- Visit `/api/status` endpoint to see:
  - Requests remaining: `/api/status`
  - Returns JSON: `{ "remaining": 1234, "limit": 1500, "used": 266 }`

## Cost Breakdown

For 1,500 route analyses:

- **OpenAI (GPT-4o-mini)**: ~$15-20
  - 2 API calls per route (POI descriptions + time comparisons)
  - ~$0.01-0.013 per route
- **Google Maps**: ~$0 (covered by $200 free tier)
  - Directions API: ~$7.50
  - Places API: variable based on route length
  - Maps JS API: ~$10.50

**Total estimated cost: $15-20 for ~1,500 route analyses**

## If You Hit the Limit

The app will gracefully show an error message:
- "daily limit reached. this app got too popular. check back tomorrow."

Options:
1. **Wait 24 hours** - limit resets automatically
2. **Increase the limit** - edit `lib/ratelimit.ts` and change `GLOBAL_LIMIT`
3. **Add budget** - increase OpenAI budget in dashboard

## Pro Tips

- **Launch during evening** - gives you time to monitor before people find it
- **Set OpenAI alert at $15** - gives you buffer to pause if needed
- **Tweet the /api/status endpoint** - let people see remaining capacity
- **Pin a "daily limit" message** - set expectations upfront
