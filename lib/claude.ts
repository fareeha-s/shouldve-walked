import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key-for-build',
});

// One short, deadpan completion. Outputs are a few lines, so max_tokens stays small to cap cost.
export async function generateText(prompt: string, temperature = 0.9): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
}
