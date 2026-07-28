import { eq } from 'drizzle-orm';
import type { StorageProvider } from '@rxwf/providers-contracts';
import type { StandardDatabase } from '../drizzle/client.js';
import { chatSessions } from '../drizzle/schema.js';
import { createStandardWorkflowRepository } from '../repositories/workflow-repository.js';
import { createStandardExecutionRepository } from '../repositories/execution-repository.js';
import { createStandardEnvRepository } from '../repositories/env-repository.js';

export function createStandardStorageProvider(db: StandardDatabase): StorageProvider {
  const workflows = createStandardWorkflowRepository(db);
  const executions = createStandardExecutionRepository(db);
  return {
    workflows: {
      findById: (id) => workflows.getWorkflow(id),
    },
    executions: {
      findById: (id) => executions.getExecution(id),
    },
    credentials: {
      findById: async () => null,
    },
    users: {
      findById: async () => null,
    },
    chat: {
      findSessionById: async (id) => {
        const rows = await db
          .select({ id: chatSessions.id, userId: chatSessions.userId, title: chatSessions.title })
          .from(chatSessions)
          .where(eq(chatSessions.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
    },
  };
}

export { createStandardEnvRepository };
