import {
  DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
  serializeKnowledgePlatformConfig,
  type KnowledgePlatformConfig,
} from '@rxwf/knowledge';
import {
  createLiteModelCatalogRepository,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import { SETTING_KEYS, type SystemSettingsService } from '@rxwf/system-settings';

const TEST_PROVIDER_ID = 'test-knowledge-provider';
const TEST_MODEL_ID = 'test-knowledge-chat-model';

/** Seeds model catalog + knowledge.config for API/integration tests. */
export async function seedKnowledgePlatformConfig(
  liteDb: LiteDatabase,
  settingsService: SystemSettingsService,
  overrides: Partial<KnowledgePlatformConfig> = {},
): Promise<{ modelId: string; config: KnowledgePlatformConfig }> {
  const catalog = createLiteModelCatalogRepository(liteDb);
  const existingProvider = await catalog.findProviderById(TEST_PROVIDER_ID);
  if (!existingProvider) {
    await catalog.createProvider({
      id: TEST_PROVIDER_ID,
      name: 'Test Knowledge Provider',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      credentialId: null,
      enabled: true,
    });
  }

  const existingModel = await catalog.findModelById(TEST_MODEL_ID);
  if (!existingModel) {
    await catalog.addModel({
      id: TEST_MODEL_ID,
      providerId: TEST_PROVIDER_ID,
      modelName: 'llama3',
      capabilities: ['chat'],
      isDefaultChat: true,
      isDefaultWorkflow: false,
      enabled: true,
      source: 'manual',
    });
  }

  const config: KnowledgePlatformConfig = {
    ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
    configured: true,
    embedding: {
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      defaultModel: 'nomic-embed-text',
      ...overrides.embedding,
    },
    rag: {
      defaultModelId: TEST_MODEL_ID,
      defaultTemplate: 'support',
      fallbackToChat: true,
      ...overrides.rag,
    },
    defaults: {
      ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.defaults,
      ...overrides.defaults,
    },
    ...overrides,
  };

  await settingsService.set(SETTING_KEYS.knowledgeConfig, serializeKnowledgePlatformConfig(config));
  return { modelId: TEST_MODEL_ID, config };
}
