export type InvokeCrewToolFn = (
  bridgeId: string,
  args: Record<string, unknown>,
  ctx: { executionId: string },
) => Promise<unknown>;
