/** Flex-grow weights for modal columns (sum is arbitrary; equal = 1:1:1 or 1:1). */
export type ModalColumnWeights = [number, number, number];

export const MODAL_SPLIT_DEFAULT_THREE: ModalColumnWeights = [1, 2, 1];
export const MODAL_SPLIT_EQUAL_TWO: ModalColumnWeights = [0, 1, 1];

export function initialModalSplit(hideInput: boolean): ModalColumnWeights {
  return hideInput ? [...MODAL_SPLIT_EQUAL_TWO] : [...MODAL_SPLIT_DEFAULT_THREE];
}

export function modalSplitGridColumns(
  widths: ModalColumnWeights,
  hideInput: boolean,
): string {
  if (hideInput) {
    return `${widths[1]}fr 5px ${widths[2]}fr`;
  }
  return `${widths[0]}fr 5px ${widths[1]}fr 5px ${widths[2]}fr`;
}
