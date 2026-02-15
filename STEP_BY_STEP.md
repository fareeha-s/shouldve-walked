# Exact Step-by-Step Deployment Guide

Follow these instructions EXACTLY. Every button click is listed.

---

## PART 1: Get Google Maps API Key (15 minutes)

### Step 1: Create Google Cloud Project

1. **Open browser** and go to: https://console.cloud.google.com/
2. **Sign in** with your Google account
3. At the top of the page, you'll see "Select a project"
4. **Click** on "Select a project" dropdown
5. In the popup, **click** the blue "NEW PROJECT" button (top right)
6. Type name: `what-you-missed`
7. **Click** the blue "CREATE" button
8. Wait 10 seconds for it to create
9. **Click** "SELECT PROJECT" when it appears

### Step 2: Enable the 3 Required APIs

**Enable Directions API:**
1. At the very top, there's a search bar that says "Search products and resources"
2. **Click** in that search bar
3. **Type**: `Directions API`
4. **Click** on "Directions API" when it appears in the dropdown
5. You'll see a blue "ENABLE" button
6. **Click** "ENABLE"
7. Wait 5 seconds

**Enable Places API:**
1. **Click** the back arrow (top left) OR search again
2. In the search bar at top, **type**: `Places API`
3. **Click** on "Places API" in the dropdown
4. **Click** the blue "ENABLE" button
5. Wait 5 seconds

**Enable Maps JavaScript API:**
1. **Click** back arrow OR search again
2. In search bar, **type**: `Maps JavaScript API`
3. **Click** on "Maps JavaScript API" in the dropdown
4. **Click** the blue "ENABLE" button
5. Wait 5 seconds

### Step 3: Create API Key

1. On the left sidebar, find and **click** "Credentials" (has a key icon)
2. At the top, **click** the blue "+ CREATE CREDENTIALS" button
3. **Click** "API key" from the dropdown
4. A popup appears with your API key
5. **Click** the copy icon (📋) next to the key
6. **Paste** this key somewhere safe (Notes app, TextEdit, etc.)
7. **IMPORTANT: Don't close this popup yet**
8. **Click** "RESTRICT KEY" button in the popup

### Step 4: Restrict the API Key (IMPORTANT)

1. You're now on the "Edit API key" page
2. Under "API restrictions" section:
   - **Click** the radio button next to "Restrict key"
   - A dropdown appears labeled "Select APIs"
   - **Click** on this dropdown
   - **Check the box** next to "Directions API"
   - **Check the box** next to "Places API"
   - **Check the box** next to "Maps JavaScript API"
   - **Click** outside the dropdown to close it
3. Scroll to the bottom
4. **Click** the blue "SAVE" button
5. Wait for "Changes saved" message

### Step 5: Set Up Billing (Required - But $200/month Free)

1. On the left sidebar, **click** "Billing"
2. **Click** "LINK A BILLING ACCOUNT" button
3. If you don't have one, **click** "CREATE BILLING ACCOUNT"
4. Fill in your info and credit card
5. **Click** through the steps (accept terms, etc.)
6. **Important**: You get $200/month FREE - won't be charged unless you go way over

**✅ DONE! Save this key - you'll need it for Vercel later**

---

## PART 2: Get OpenAI API Key (10 minutes)

### Step 1: Sign Up / Sign In

1. Go to: https://platform.openai.com/
2. **Click** "Sign up" (top right) or "Log in" if you have account
3. Create account with email/password OR use Google
4. Verify your email if needed

### Step 2: Add Payment Method

1. Once logged in, **click** your name/profile icon (top right)
2. **Click** "Settings" from the dropdown
3. On the left sidebar, **click** "Billing"
4. **Click** "Add payment method" button
5. Enter your credit card info
6. **Click** "Add payment method" to save

### Step 3: Set Spending Limits (CRITICAL - THIS PROTECTS YOU)

1. Still in Billing section, look for tabs at the top
2. **Click** the "Limits" tab
3. You'll see "Monthly budget"
4. **Click** in the field and **type**: `20`
5. Scroll down to "Email notifications"
6. **Check the box** next to "Email me when I reach..."
7. In the field, **type**: `15`
8. Scroll to bottom
9. **Click** the blue "Save" button

**THIS IS CRITICAL - Without this limit, you could spend more than $20**

### Step 4: Create API Key

1. On the left sidebar, **click** "API keys"
2. **Click** the green "+ Create new secret key" button
3. In the popup:
   - Name: **type** `what-you-missed`
   - **Click** "Create secret key" button
4. A long key appears (starts with "sk-...")
5. **Click** the copy icon (📋)
6. **Paste** this somewhere safe (Notes app, etc.)
7. **IMPORTANT: You can never see this again! Save it now!**
8. **Click** "Done"

**✅ DONE! You now have both API keys**

---

## PART 3: Push Code to GitHub (5 minutes)

### If You Don't Have GitHub Account:

1. Go to: https://github.com/
2. **Click** "Sign up" (top right)
3. Create account with email
4. Verify email

### Push Your Code:

1. **Open Terminal** (on Mac: Cmd+Space, type "Terminal")
2. **Navigate** to your project:
   ```bash
   cd /Users/fareeha/conductor/workspaces/shouldve-walked/dallas
   ```
3. **Create GitHub repo**:
   - Go to: https://github.com/new
   - Repository name: **type** `what-you-missed`
   - Leave everything else default
   - **Click** green "Create repository" button
4. **Back in Terminal**, run these commands ONE AT A TIME:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/what-you-missed.git
   git branch -M main
   git push -u origin main
   ```
   Replace `YOUR-USERNAME` with your actual GitHub username

**✅ DONE! Code is on GitHub**

---

## PART 4: Deploy to Vercel (10 minutes)

### Step 1: Sign Up for Vercel

1. Go to: https://vercel.com/signup
2. **Click** "Continue with GitHub" button
3. **Click** "Authorize Vercel" when GitHub asks
4. You're now logged into Vercel

### Step 2: Import Your Project

1. You should see your dashboard
2. **Click** the "Add New..." button (top right)
3. **Click** "Project" from dropdown
4. You'll see a list of your GitHub repos
5. Find "what-you-missed" in the list
6. **Click** the "Import" button next to it

### Step 3: Add Environment Variables (CRITICAL)

1. You're now on the "Configure Project" page
2. Scroll down until you see "Environment Variables" section
3. **ADD FIRST VARIABLE:**
   - In "Name" field, **type**: `GOOGLE_MAPS_API_KEY`
   - In "Value" field, **paste** your Google Maps API key
   - **Click** "Add" button
4. **ADD SECOND VARIABLE:**
   - In "Name" field, **type**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - In "Value" field, **paste** the SAME Google Maps API key
   - **Click** "Add" button
5. **ADD THIRD VARIABLE:**
   - In "Name" field, **type**: `OPENAI_API_KEY`
   - In "Value" field, **paste** your OpenAI API key (starts with "sk-...")
   - **Click** "Add" button

**You should now see 3 environment variables listed**

### Step 4: Deploy!

1. Scroll to the bottom
2. **Click** the big blue "Deploy" button
3. Wait 2-3 minutes while it builds (you'll see a loading animation)
4. When done, you'll see confetti 🎉 and "Congratulations!"
5. **Click** "Continue to Dashboard"
6. At the top, you'll see your URL (like `what-you-missed.vercel.app`)
7. **Click** on that URL to open your live site!

**✅ DONE! Your app is live!**

---

## PART 5: Secure Google Maps API Key (CRITICAL - 5 minutes)

Now that you have your Vercel URL, secure your Google Maps key:

### Step 1: Add Domain Restrictions

1. Go back to: https://console.cloud.google.com/apis/credentials
2. **Click** on your API key (the one you created earlier)
3. Under "Application restrictions" section:
   - **Click** the radio button next to "HTTP referrers (web sites)"
4. Under "Website restrictions":
   - **Click** "+ ADD AN ITEM"
   - In the field, **type**: `https://*.vercel.app/*`
   - **Click** "+ ADD AN ITEM" again
   - In the field, **type**: `http://localhost:3000/*`
   - If you have a custom domain, add that too: `https://yourdomain.com/*`
5. Scroll to bottom
6. **Click** the blue "SAVE" button

**✅ DONE! Your API key is now secure**

---

## PART 6: Test It! (5 minutes)

### Test the App:

1. **Open** your Vercel URL (like `what-you-missed.vercel.app`)
2. In the "pickup" field, **type**: `tartine`
3. You should see autocomplete suggestions appear!
4. **Click** on "Tartine Bakery"
5. In the "dropoff" field, **type**: `dolores park`
6. **Click** on "Dolores Park"
7. **Click** "show me what i missed"
8. Wait 10-15 seconds
9. You should see:
   - Health stats
   - Time comparisons
   - A map with the route
   - Points of interest you missed

### Test the Usage Monitor:

1. Open: `your-url.vercel.app/api/status` (replace with your actual URL)
2. You should see: `{"remaining":1499,"limit":1500,"used":1}`

**✅ If all this works, YOU'RE DONE!**

---

## What You Should Have Now:

- ✅ Live app at `yourname.vercel.app`
- ✅ Autocomplete working
- ✅ Map showing routes
- ✅ Funny descriptions generating
- ✅ Cost capped at $20 max
- ✅ API keys secured

---

## If Something Doesn't Work:

### "Autocomplete not appearing"
- Make sure you added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to Vercel (must start with NEXT_PUBLIC_)
- Check that Places API is enabled in Google Cloud Console
- Try refreshing the page

### "Could not get directions"
- Check that all 3 APIs are enabled in Google Cloud Console
- Verify billing is set up in Google Cloud
- Make sure addresses are in San Francisco

### "Failed to generate descriptions"
- Check that `OPENAI_API_KEY` is correct in Vercel
- Verify you have credits in OpenAI (add payment method)
- Check OpenAI usage: https://platform.openai.com/usage

### "Map not showing"
- Check browser console for errors (right-click → Inspect → Console tab)
- Verify Maps JavaScript API is enabled
- Check that API key has proper restrictions

### Need to Update Environment Variables?
1. Go to your Vercel project dashboard
2. **Click** "Settings" tab
3. **Click** "Environment Variables" on the left
4. **Click** the ⋯ menu next to a variable
5. **Click** "Edit" to change it
6. **Click** "Save"
7. Go to "Deployments" tab
8. **Click** ⋯ on the latest deployment
9. **Click** "Redeploy"

---

## Monitoring Your App:

**Check costs:**
- OpenAI: https://platform.openai.com/usage
- Google Maps: https://console.cloud.google.com/google/maps-apis/metrics
- Your app usage: `your-url.vercel.app/api/status`

**Watch your email** - You'll get an alert at $15 from OpenAI

**The app will auto-stop at 1,500 requests** (about $15-20 cost)

---

## You're All Set! 🎉

Share your URL on Twitter and watch people use it!

Tweet ideas:
- "built a guilt trip for people who take robotaxis 6 blocks in sf"
- "find out what you missed by not walking: [your-url]"
- "waymo users look away: [your-url]"
