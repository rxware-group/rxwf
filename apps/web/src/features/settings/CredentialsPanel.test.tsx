import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../../i18n/labels.js';
import { api } from '../../api/client.js';
import { CredentialsPanel, NodeCredentialSelect } from './CredentialsPanel.js';
import { HTTP_ACCEPTED_CREDENTIAL_TYPES } from './credential-types.js';

vi.mock('../../api/client.js', () => ({
  api: {
    credentials: {
      list: vi.fn(),
      listTypes: vi.fn(),
      create: vi.fn(),
      test: vi.fn(),
      remove: vi.fn(),
    },
  },
  AwfClientError: class AwfClientError extends Error {},
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = getLocaleBundle('zh-CN');

const mockTypes = {
  types: [
    {
      id: 'apiKey',
      displayName: 'API Key',
      fields: [
        { key: 'apiKey', label: 'API Key', type: 'secret' as const, required: true },
        {
          key: 'headerName',
          label: 'Header Name',
          type: 'text' as const,
          defaultValue: 'Authorization',
        },
      ],
    },
    {
      id: 'basicAuth',
      displayName: 'Username / Password',
      fields: [
        { key: 'username', label: 'Username', type: 'text' as const, required: true },
        { key: 'password', label: 'Password', type: 'secret' as const, required: true },
      ],
    },
  ],
};

const mockCredentials = [
  { id: 'cred-api-1', name: 'Prod API Key', type: 'apiKey' },
  { id: 'cred-basic-1', name: 'Basic Auth', type: 'basicAuth' },
];

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderNodeCredentialSelect(
  props: {
    value?: string;
    onChange?: (credentialId: string) => void;
    acceptedTypes?: string[];
  } = {},
) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onChange = props.onChange ?? vi.fn();

  act(() => {
    root.render(
      <LabelsProvider labels={labels}>
        <NodeCredentialSelect
          value={props.value ?? ''}
          onChange={onChange}
          acceptedTypes={props.acceptedTypes ?? HTTP_ACCEPTED_CREDENTIAL_TYPES}
        />
      </LabelsProvider>,
    );
  });

  return { host, root, onChange };
}

function renderCredentialsPanel() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <LabelsProvider labels={labels}>
        <CredentialsPanel />
      </LabelsProvider>,
    );
  });

  return { host, root };
}

describe('NodeCredentialSelect', () => {
  let roots: Array<{ root: Root; host: HTMLDivElement }> = [];

  beforeEach(() => {
    vi.mocked(api.credentials.list).mockResolvedValue(mockCredentials);
    vi.mocked(api.credentials.listTypes).mockResolvedValue(mockTypes);
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

  it('节点选 credential 下拉在存在匹配凭据时不应仅有空选项', async () => {
    const { host, root } = renderNodeCredentialSelect({
      acceptedTypes: ['apiKey'],
    });
    roots.push({ root, host });

    await flushPromises();

    const trigger = host.querySelector('.rxwf-select-trigger') as HTMLButtonElement | null;
    expect(trigger).toBeTruthy();

    act(() => {
      trigger!.click();
    });

    const panel = document.body.querySelector('.rxwf-select-panel');
    expect(panel).toBeTruthy();
    expect(panel!.textContent).toContain('Prod API Key');
    expect(panel!.textContent).not.toContain('Basic Auth');
  });
});

describe('CredentialsPanel', () => {
  let roots: Array<{ root: Root; host: HTMLDivElement }> = [];

  beforeEach(() => {
    vi.mocked(api.credentials.list).mockResolvedValue(mockCredentials);
    vi.mocked(api.credentials.listTypes).mockResolvedValue(mockTypes);
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
  });

  it('loads credential types and renders schema-driven fields', async () => {
    const { host, root } = renderCredentialsPanel();
    roots.push({ root, host });

    await flushPromises();

    expect(host.textContent).toContain('Prod API Key');
    expect(host.textContent).toContain('API Key');
    expect(host.querySelector('input[type="password"]')).toBeTruthy();
  });
});
