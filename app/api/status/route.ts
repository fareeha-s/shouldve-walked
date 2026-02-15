import { NextResponse } from 'next/server';
import { getRemainingGlobalLimit } from '@/lib/ratelimit';

export async function GET() {
  const remaining = getRemainingGlobalLimit();

  return NextResponse.json({
    remaining,
    limit: 1500,
    used: 1500 - remaining,
  });
}
