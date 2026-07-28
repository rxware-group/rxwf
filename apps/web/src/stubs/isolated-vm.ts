/** Browser stub — expression sandbox runs on the API/runner only. */
export class Isolate {
  constructor(_options?: { memoryLimit?: number }) {}
  createContextSync(): never {
    throw new Error('isolated-vm is not available in the browser');
  }
  compileScriptSync(_source: string): never {
    throw new Error('isolated-vm is not available in the browser');
  }
  compileScript(_source: string): never {
    throw new Error('isolated-vm is not available in the browser');
  }
  dispose(): void {}
}

export class Context {}
export class Script {}
export class ExternalCopy<T> {
  constructor(_value: T) {}
  copyInto(): never {
    throw new Error('isolated-vm is not available in the browser');
  }
}
