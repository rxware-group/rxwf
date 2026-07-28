const FIELD_MODES_KEY = '_fieldModes';

/** Remove deprecated `_fieldModes` from a parameter snapshot. */
export function stripFieldModes(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...config };
  delete out[FIELD_MODES_KEY];
  return out;
}
