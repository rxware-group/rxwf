import type { WebSearchPort } from '@rxwf/providers-contracts';
import { createBingProvider } from './providers/bing.js';
import { createBraveProvider } from './providers/brave.js';
import { createCustomProvider } from './providers/custom.js';
import { createTavilyProvider } from './providers/tavily.js';
import type { WebSearchProviderCreds, WebSearchProviderId } from './types.js';

export function createWebSearchPort(
  providerId: WebSearchProviderId,
  creds: WebSearchProviderCreds,
): WebSearchPort {
  switch (providerId) {
    case 'tavily':
      return createTavilyProvider(creds);
    case 'brave':
      return createBraveProvider(creds);
    case 'bing':
      return createBingProvider(creds);
    case 'custom':
      return createCustomProvider(creds);
    default: {
      const _exhaustive: never = providerId;
      throw new Error(`Unknown web search provider: ${_exhaustive}`);
    }
  }
}
