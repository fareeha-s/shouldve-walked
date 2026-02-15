# Setup Guide

## Getting Your API Keys

### Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Directions API** (for calculating walking routes)
   - **Places API** (for finding POIs along the route)
   - **Maps JavaScript API** (for displaying the map)
4. Go to "Credentials" and create an API key
5. (Optional but recommended) Restrict the API key:
   - Add HTTP referrers: `http://localhost:3000/*` and your production domain
   - Restrict to the three APIs listed above

### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to API keys section
4. Create a new API key
5. Copy the key (you won't be able to see it again)

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Google Maps - same key for both (client and server)
GOOGLE_MAPS_API_KEY=your_actual_google_maps_api_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_google_maps_api_key

# OpenAI
OPENAI_API_KEY=your_actual_openai_api_key
```

**Important:**
- Don't commit `.env.local` to git (it's already in .gitignore)
- The `NEXT_PUBLIC_` prefix makes the Google Maps key available to the browser
- The non-prefixed `GOOGLE_MAPS_API_KEY` is used for server-side API calls

## Cost Considerations

### Google Maps API
- **Directions API**: $5 per 1000 requests (first $200/month free)
- **Places API**: $32 per 1000 requests (first $200/month free)
- **Maps JavaScript API**: $7 per 1000 loads (first $200/month free)

A typical request uses all three APIs, but you get $200/month in free credits.

### OpenAI API
- **GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Each route analysis makes 2 API calls (POI descriptions + time comparisons)
- Estimated cost: ~$0.01-0.02 per route analysis

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### "Failed to load Google Maps"
- Check that `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in `.env.local`
- Verify the Maps JavaScript API is enabled in Google Cloud Console
- Check browser console for specific error messages

### "Could not get directions"
- Verify both addresses are in San Francisco
- Check that Directions API is enabled
- Make sure the API key has proper permissions

### "Failed to generate descriptions"
- Check that `OPENAI_API_KEY` is set in `.env.local`
- Verify your OpenAI account has credits
- Check server logs for specific errors

### Map not displaying
- Clear browser cache and reload
- Check that the geometry library is loading (check browser console)
- Verify the polyline data is being received in the API response
