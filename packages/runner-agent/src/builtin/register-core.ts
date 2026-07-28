import { runInSandbox } from '@rxwf/sandbox';
import {
  createCodeExecutor,
  createHttpRequestExecutor,
  executeCommandExecutor,
  readWriteFileExecutor,
  type ExecutorRegistry,
} from '@rxwf/node-runner';

export function registerCoreExecutors(registry: ExecutorRegistry): void {
  registry.register(createCodeExecutor({ runInSandbox }));
  registry.register(executeCommandExecutor);
  registry.register(createHttpRequestExecutor());
  registry.register(readWriteFileExecutor);
}
