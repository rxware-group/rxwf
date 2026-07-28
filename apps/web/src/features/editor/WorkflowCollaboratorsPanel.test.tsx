import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../../i18n/labels.js';
import { api } from '../../api/client.js';
import { WorkflowCollaboratorsPanel } from './WorkflowCollaboratorsPanel.js';

vi.mock('../../api/client.js', () => ({
  api: {
    workflows: {
      listCollaborators: vi.fn(),
      updateCollaborators: vi.fn(),
      listCollaboratorCandidates: vi.fn(),
    },
  },
}));

const labels = {
  ...getLocaleBundle('zh-CN'),
  'editor.addCollaborator': '添加协作者',
};

const WORKFLOW_ID = 'wf-test-1';

const baseCollaboratorsResponse = {
  creatorUserId: 'creator-1',
  creatorEmail: 'creator@example.com',
  collaborators: [
    {
      userId: 'user-editor',
      email: 'editor@example.com',
      role: 'editor' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderPanel(readOnly = false) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <MemoryRouter>
        <LabelsProvider labels={labels}>
          <WorkflowCollaboratorsPanel workflowId={WORKFLOW_ID} readOnly={readOnly} />
        </LabelsProvider>
      </MemoryRouter>,
    );
  });

  return { host, root };
}

describe('WorkflowCollaboratorsPanel', () => {
  let roots: Array<{ root: Root; host: HTMLDivElement }> = [];

  beforeEach(() => {
    vi.mocked(api.workflows.listCollaborators).mockResolvedValue(
      baseCollaboratorsResponse,
    );
    vi.mocked(api.workflows.updateCollaborators).mockImplementation(
      async (_workflowId, payload) => ({
        ...baseCollaboratorsResponse,
        collaborators: baseCollaboratorsResponse.collaborators.map((collaborator) => {
          const next = payload.find((item) => item.userId === collaborator.userId);
          return next ? { ...collaborator, role: next.role } : collaborator;
        }),
      }),
    );
    vi.mocked(api.workflows.listCollaboratorCandidates).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    for (const { root, host } of roots) {
      act(() => {
        root.unmount();
      });
      host.remove();
    }
    roots = [];
    document.body
      .querySelectorAll('.rxwf-select-panel')
      .forEach((node) => node.remove());
  });

  it('hides invite button when user lacks share permission (readOnly)', async () => {
    const { host, root } = renderPanel(true);
    roots.push({ root, host });

    await flushPromises();

    const inviteButton = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button.btn-secondary'),
    ).find((button) => button.textContent?.includes('添加协作者'));

    expect(inviteButton).toBeUndefined();
    expect(host.textContent).toContain('editor@example.com');
  });

  it('calls updateCollaborators API when collaborator role changes', async () => {
    const { host, root } = renderPanel(false);
    roots.push({ root, host });

    await flushPromises();

    const roleSelectTrigger = host.querySelector(
      'tbody tr:nth-child(2) .rxwf-select-trigger',
    ) as HTMLButtonElement | null;
    expect(roleSelectTrigger).toBeTruthy();

    await act(async () => {
      roleSelectTrigger!.click();
    });

    const viewerOption = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.rxwf-select-option'),
    ).find((option) => option.textContent === 'Viewer');
    expect(viewerOption).toBeTruthy();

    await act(async () => {
      viewerOption!.click();
    });

    await flushPromises();

    expect(api.workflows.updateCollaborators).toHaveBeenCalledWith(WORKFLOW_ID, [
      { userId: 'user-editor', role: 'viewer' },
    ]);
  });
});
