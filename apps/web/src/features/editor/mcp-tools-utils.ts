/** 与 React 组件分离，避免 Vite Fast Refresh 因非组件导出失效 */
export function normalizeMcpTools(parameters: Record<string, unknown>): string[] {
  if (Array.isArray(parameters.tools)) {
    return parameters.tools.filter((t): t is string => typeof t === 'string' && t.length > 0);
  }
  const single = parameters.tool;
  if (typeof single === 'string' && single) return [single];
  return [];
}
