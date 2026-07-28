import { describe, it, expect, vi } from 'vitest';
import { createErrorWorkflowService } from './error-workflow-service.js';

describe('ErrorWorkflowService', () => {
  it('does not enqueue when maxErrorDepth exceeded', async () => {
    const enqueue = vi.fn();
    const svc = createErrorWorkflowService({ enqueue, maxErrorDepth: 2 });
    await svc.handleFailure({
      executionId: 'ex-1',
      workflowId: 'wf-1',
      errorWorkflowId: 'wf-err',
      failedNode: 'n1',
      errorMessage: 'fail',
      currentDepth: 2,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enqueues error trigger when depth allows', async () => {
    const enqueue = vi.fn();
    const svc = createErrorWorkflowService({ enqueue, maxErrorDepth: 2 });
    await svc.handleFailure({
      executionId: 'ex-1',
      workflowId: 'wf-1',
      errorWorkflowId: 'wf-err',
      failedNode: 'n1',
      errorMessage: 'fail',
      currentDepth: 0,
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-err',
        triggerType: 'error',
      }),
    );
  });
});
