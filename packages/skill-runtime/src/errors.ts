import { AwfError } from '@rxwf/shared';

export function skillError(code: string, message: string): AwfError {
  return new AwfError(code, message);
}
