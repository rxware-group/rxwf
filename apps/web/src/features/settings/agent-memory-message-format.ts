export function formatAgentMemoryMessageContent(content: string, role: string): string {
  if (role !== 'assistant') return content;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return content;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'answer' in parsed &&
      typeof (parsed as { answer?: unknown }).answer === 'string'
    ) {
      return (parsed as { answer: string }).answer;
    }
  } catch {
    /* keep raw content */
  }
  return content;
}
