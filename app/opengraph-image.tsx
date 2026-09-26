import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Link preview (LinkedIn, Twitter, iMessage): the site's heading, as visitors see it
export const alt = 'should i have walked.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const interBold = await readFile(join(process.cwd(), 'app/Inter-Bold.ttf'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          backgroundColor: '#faf8f5',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Inter',
            fontSize: 124,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 0.9,
            color: '#1a1a1a',
            paddingBottom: 40,
            borderBottom: '6px solid #1a1a1a',
          }}
        >
          SHOULD I HAVE WALKED.
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Inter', data: interBold, weight: 700, style: 'normal' }] }
  );
}
