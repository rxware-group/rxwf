import { useCallback, useEffect, useState } from 'react';
import {
  fetchOllamaModelNamesFromUrl,
  isLiteralHttpUrl,
  loadOllamaModelNames,
} from './ollama-model-names.js';

export type UseOllamaModelNamesOptions = {
  /** 仅从节点服务地址拉取，不合并模型目录 */
  liveOnly?: boolean;
  /** 首次聚焦 Model 输入框时再拉取 */
  fetchOnFocus?: boolean;
};

export function useOllamaModelNames(
  baseUrl?: string,
  options?: UseOllamaModelNamesOptions,
) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (options?.liveOnly) {
        const url = (baseUrl ?? '').trim();
        if (!isLiteralHttpUrl(url)) {
          setModels([]);
          return;
        }
        const names = await fetchOllamaModelNamesFromUrl(url);
        setModels(names);
        return;
      }
      const names = await loadOllamaModelNames(baseUrl);
      setModels(names);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, options?.liveOnly]);

  useEffect(() => {
    if (options?.fetchOnFocus) {
      setModels([]);
      return;
    }
    void load();
  }, [load, options?.fetchOnFocus]);

  const ensureLoaded = useCallback(() => {
    if (!loading) void load();
  }, [load, loading]);

  return { models, loading, ensureLoaded };
}
