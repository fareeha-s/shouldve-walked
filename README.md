# what you missed

a playful guilt trip for people who take robotaxis six blocks in San Francisco.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env.local` and add your API keys:
```bash
cp .env.example .env.local
```

You'll need:
- **Google Maps API Key**: Enable Directions API, Places API, and Maps JavaScript API
- **OpenAI API Key**: For generating the deadpan descriptions

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Enter pickup and dropoff addresses in San Francisco
- See what you missed by not walking:
  - Coffee shops, restaurants, bars
  - Murals and public art
  - Parks and viewpoints
  - Notable trees and gardens
- Health stats with food equivalents
- Hyper-specific time comparisons for SF startup culture
- Safety warnings for sketchy areas
- Dark mode, minimal UI

## Tech Stack

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Google Maps API
- OpenAI API

## Design Philosophy

The tone is deadpan internet humor. Not trying too hard to be funny. Just stating facts that happen to be relatable to SF tech people who are chronically online.

Think Linear/Vercel/Arc aesthetic: sharp, fast, developer-friendly. No gradients, no generic SaaS look.
