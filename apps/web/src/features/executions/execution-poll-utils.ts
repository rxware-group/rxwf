export function isTerminalExecutionStatus(status: string): boolean {
  return status === 'success' || status === 'failed' || status === 'cancelled';
}
