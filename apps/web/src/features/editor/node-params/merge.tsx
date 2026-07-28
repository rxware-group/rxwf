/** Merge node parameter helpers (panel visibility + save validation). */

export function shouldShowMergeParamField(
  parameters: Record<string, unknown>,
  fieldKey: string,
): boolean {
  if (fieldKey === 'matchField') {
    return String(parameters.mode ?? 'append') === 'combineByKey';
  }
  return true;
}

export type MergeValidationIssue = {
  code: 'E2002';
  message: string;
};

export function validateMergeParameters(
  parameters: Record<string, unknown>,
): MergeValidationIssue | null {
  const mode = String(parameters.mode ?? 'append');
  if (mode === 'combineByKey') {
    const matchField = String(parameters.matchField ?? '').trim();
    if (!matchField) {
      return {
        code: 'E2002',
        message: 'merge combineByKey requires matchField',
      };
    }
  }
  const allowed = new Set(['append', 'combineByKey', 'combineAll']);
  if (!allowed.has(mode)) {
    return {
      code: 'E2002',
      message: `Unsupported merge mode: ${mode}`,
    };
  }
  return null;
}
