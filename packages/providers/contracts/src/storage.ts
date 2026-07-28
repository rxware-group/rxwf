/** Repository stubs for later StorageProvider implementations. */

export interface WorkflowRepository {
  findById(id: string): Promise<unknown | null>;
}

export interface ExecutionRepository {
  findById(id: string): Promise<unknown | null>;
}

export interface CredentialRepository {
  findById(id: string): Promise<unknown | null>;
}

export interface UserRepository {
  findById(id: string): Promise<unknown | null>;
}

export interface ChatRepository {
  findSessionById(id: string): Promise<unknown | null>;
}

export interface StorageProvider {
  workflows: WorkflowRepository;
  executions: ExecutionRepository;
  credentials: CredentialRepository;
  users: UserRepository;
  chat: ChatRepository;
}
