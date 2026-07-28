import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { normalizeLocale } from './locales.js';
import type { AppOutletContext } from '../layout/app-outlet-context.js';

export type LabelMap = Record<string, string>;

const LabelsContext = createContext<LabelMap>({});

export function LabelsProvider({
  labels,
  children,
}: {
  labels: LabelMap;
  children: ReactNode;
}) {
  return createElement(LabelsContext.Provider, { value: labels }, children);
}

export function useLabels(): LabelMap {
  return useContext(LabelsContext);
}

export function useAppLabels(): LabelMap {
  const outlet = useOutletContext<AppOutletContext | null>();
  const ctx = useContext(LabelsContext);
  return outlet?.labels ?? ctx;
}

export function t(
  labels: LabelMap | undefined,
  key: string,
  vars?: Record<string, string>,
  fallback?: string,
): string {
  let text =
    labels?.[key] ??
    (typeof localStorage !== 'undefined'
      ? getLocaleBundle(normalizeLocale(localStorage.getItem('rxwf.locale')))[key]
      : undefined) ??
    fallback ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}
