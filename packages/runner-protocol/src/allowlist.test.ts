import { describe, it, expect } from 'vitest';
import { REMOTE_V1_1_NODE_TYPES, isRemoteV11NodeType } from './allowlist.js';

describe('REMOTE_V1_1_NODE_TYPES', () => {
  it('contains code, executeCommand, httpRequest, and readWriteFile', () => {
    expect([...REMOTE_V1_1_NODE_TYPES]).toEqual([
      'code',
      'executeCommand',
      'httpRequest',
      'readWriteFile',
    ]);
  });

  it('isRemoteV11NodeType', () => {
    expect(isRemoteV11NodeType('code')).toBe(true);
    expect(isRemoteV11NodeType('httpRequest')).toBe(true);
    expect(isRemoteV11NodeType('readWriteFile')).toBe(true);
    expect(isRemoteV11NodeType('set')).toBe(false);
  });
});
