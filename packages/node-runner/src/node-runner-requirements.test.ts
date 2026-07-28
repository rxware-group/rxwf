import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearRegisteredNodeRunnerRequirements,
  getNodeRunnerRequirements,
  registerNodeRunnerRequirements,
} from './node-runner-requirements.js';

describe('getNodeRunnerRequirements', () => {
  beforeEach(() => {
    clearRegisteredNodeRunnerRequirements();
  });

  it('returns built-in requirements for code, executeCommand, httpRequest, and readWriteFile', () => {
    expect(getNodeRunnerRequirements('code')).toEqual({ capabilities: ['code'] });
    expect(getNodeRunnerRequirements('executeCommand')).toEqual({
      capabilities: ['shell'],
      platforms: ['linux', 'windows', 'macos'],
    });
    expect(getNodeRunnerRequirements('httpRequest')).toEqual({ capabilities: ['http'] });
    expect(getNodeRunnerRequirements('readWriteFile')).toEqual({ capabilities: ['file'] });
  });

  it('returns undefined for unknown node types', () => {
    expect(getNodeRunnerRequirements('set')).toBeUndefined();
  });

  it('prefers registered manifest requirements over built-ins', () => {
    registerNodeRunnerRequirements('wmi.query', {
      platforms: ['windows'],
      capabilities: ['wmi'],
    });
    expect(getNodeRunnerRequirements('wmi.query')).toEqual({
      platforms: ['windows'],
      capabilities: ['wmi'],
    });
  });
});
