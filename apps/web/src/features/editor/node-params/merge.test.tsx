import { describe, expect, it } from 'vitest';
import { shouldShowMergeParamField, validateMergeParameters } from './merge.js';

describe('merge node params', () => {
  it('shows matchField only when mode is combineByKey', () => {
    expect(
      shouldShowMergeParamField({ mode: 'append' }, 'matchField'),
    ).toBe(false);
    expect(
      shouldShowMergeParamField({ mode: 'combineAll' }, 'matchField'),
    ).toBe(false);
    expect(
      shouldShowMergeParamField({ mode: 'combineByKey' }, 'matchField'),
    ).toBe(true);
    expect(shouldShowMergeParamField({ mode: 'append' }, 'mode')).toBe(true);
  });

  it('validateMergeParameters rejects combineByKey without matchField', () => {
    expect(validateMergeParameters({ mode: 'combineByKey' })).toEqual({
      code: 'E2002',
      message: 'merge combineByKey requires matchField',
    });
    expect(
      validateMergeParameters({ mode: 'combineByKey', matchField: 'id' }),
    ).toBeNull();
  });

  it('validateMergeParameters rejects unsupported mode', () => {
    expect(validateMergeParameters({ mode: 'invalid' })).toEqual({
      code: 'E2002',
      message: 'Unsupported merge mode: invalid',
    });
  });
});
