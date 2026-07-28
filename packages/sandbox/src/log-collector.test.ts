import { describe, it, expect } from 'vitest';
import { createLogCollector } from './log-collector.js';

describe('createLogCollector', () => {
  it('caps message length and entry count', () => {
    const log = createLogCollector({ maxEntries: 2, maxMessageLen: 4 });
    log.info('hello');
    log.info('world');
    log.info('drop');
    expect(log.entries()).toHaveLength(2);
    expect(log.entries()[0]!.message).toBe('hell');
  });
});
