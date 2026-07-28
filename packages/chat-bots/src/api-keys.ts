import { createHash, randomBytes } from 'node:crypto';

export function hashBotApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function generateBotApiKey(): string {
  return `awf_bot_${randomBytes(24).toString('base64url')}`;
}
