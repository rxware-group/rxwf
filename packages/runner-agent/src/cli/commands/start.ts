import { loadRunnerConfig } from '../../config.js';
import { AgentRuntime } from '../../runtime/agent-runtime.js';

export async function runStart(configPath: string): Promise<void> {
  const config = loadRunnerConfig(configPath);
  const runtime = new AgentRuntime(config);

  let shuttingDown = false;

  const onSignal = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    void runtime.drain().then(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  await runtime.start();

  await new Promise<void>(() => {
    // Block until SIGTERM/SIGINT triggers drain and process.exit
  });
}
