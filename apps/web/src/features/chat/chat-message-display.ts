import { t } from './chat-labels.js';

export function formatChatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function chatMessageRoleLabel(labels: Record<string, string> | undefined, role: string): string {
  if (role === 'user') return t(labels, 'agentMemory.session.roleUser');
  if (role === 'assistant') return t(labels, 'agentMemory.session.roleAssistant');
  return role;
}
