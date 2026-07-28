import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../../api/client.js';
import { normalizeLocale } from '../../i18n/locales.js';

function readEmbedLocale(searchParams: URLSearchParams): string {
  const fromQuery = searchParams.get('lang');
  if (fromQuery) return normalizeLocale(fromQuery);
  return normalizeLocale(localStorage.getItem('rxwf.locale'));
}

/** Loads i18n labels for embed pages (no AppShell outlet). */
export function useEmbedLabels() {
  const [searchParams] = useSearchParams();
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const locale = readEmbedLocale(searchParams);
    void api.i18n(locale).then(setLabels).catch(() => setLabels({}));
  }, [searchParams]);

  return labels;
}
