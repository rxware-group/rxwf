import { describe, expect, it } from 'vitest';
import { crewCredentialBridgeId } from './crew-bridge-ids.js';

describe('crewCredentialBridgeId', () => {
  it('prefixes credential ref for bridge token map', () => {
    expect(crewCredentialBridgeId('cred-abc')).toBe('credential:cred-abc');
  });
});
