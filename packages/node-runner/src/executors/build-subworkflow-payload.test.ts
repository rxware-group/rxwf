import { describe, expect, it } from 'vitest';
import { buildSubworkflowPayload } from './build-subworkflow-payload.js';

describe('buildSubworkflowPayload', () => {
  it('passes llm args when child schema is fields and no mapping', async () => {
    const payload = await buildSubworkflowPayload({
      llmArgs: { query: 'hello' },
      childSchema: {
        mode: 'fields',
        fields: [{ name: 'query', type: 'string', required: true }],
        jsonSchema: {},
      },
      inputItems: [],
    });
    expect(payload).toEqual({ query: 'hello' });
  });

  it('throws E1054 when required field missing', async () => {
    await expect(
      buildSubworkflowPayload({
        llmArgs: {},
        childSchema: {
          mode: 'fields',
          fields: [{ name: 'query', type: 'string', required: true }],
          jsonSchema: {},
        },
        inputItems: [],
      }),
    ).rejects.toMatchObject({ code: 'E1054' });
  });

  it('acceptAll returns llm args unchanged', async () => {
    const payload = await buildSubworkflowPayload({
      llmArgs: { any: 'value' },
      childSchema: {
        mode: 'acceptAll',
        fields: [],
        jsonSchema: { type: 'object', additionalProperties: true },
      },
      inputItems: [],
    });
    expect(payload).toEqual({ any: 'value' });
  });
});
