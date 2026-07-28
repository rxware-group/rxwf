/** Browser stub for Node-only worker pool dependencies. */
export default class EmptyNodeModule {
  constructor() {
    throw new Error('This module is not available in the browser');
  }
}
