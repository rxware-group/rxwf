import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import {
  parseScheduleTriggerOutput,
  scheduleTriggerExecutor,
} from './schedule.js';

describe('scheduleTriggerExecutor registration', () => {
  it('registerBuiltinExecutors registers scheduleTrigger', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('scheduleTrigger')).toBe(true);
  });
});

describe('parseScheduleTriggerOutput', () => {
  it('passes through input items when provided', () => {
    const items = [{ json: { scheduled: true } }];
    expect(parseScheduleTriggerOutput({ cron: '0 10 * * *' }, items)).toEqual(items);
  });

  it('emits cron in json when no input items', () => {
    expect(parseScheduleTriggerOutput({ cron: '0 10 * * *' }, [])).toEqual([
      { json: { cron: '0 10 * * *' } },
    ]);
  });

  it('emits empty json when cron is blank', () => {
    expect(parseScheduleTriggerOutput({ cron: '  ' }, [])).toEqual([{ json: {} }]);
  });
});

describe('scheduleTriggerExecutor', () => {
  it('emits cron item when no input items', async () => {
    const result = await scheduleTriggerExecutor.execute({
      config: { cron: '0 10 * * *' },
      inputItems: [],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { cron: '0 10 * * *' } }]);
  });

  it('passes through input items when provided', async () => {
    const result = await scheduleTriggerExecutor.execute({
      config: {},
      inputItems: [{ json: { scheduled: true } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { scheduled: true } }]);
  });
});
