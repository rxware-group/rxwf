import { useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../../layout/app-outlet-context.js';
import { t } from './chat-labels.js';

export function useChatLabels() {
  const { labels } = useOutletContext<AppOutletContext>();
  return (key: string) => t(labels, key);
}
