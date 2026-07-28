import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type WorkflowDefinition } from '../../api/client.js';
import type { AutoSaveStatus } from './EditorCanvasHeader.js';

const AUTO_SAVE_DELAY_MS = 1500;

export function useWorkflowAutoSave(options: {
  workflowId: string | undefined;
  isNewWorkflow: boolean;
  dirty: boolean;
  definition: WorkflowDefinition;
  buildDefinitionForRun: (base?: WorkflowDefinition) => WorkflowDefinition;
  validateConnections: (def: WorkflowDefinition) => string[];
  onCreate: (def: WorkflowDefinition) => Promise<void>;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const {
    workflowId,
    isNewWorkflow,
    dirty,
    definition,
    buildDefinitionForRun,
    validateConnections,
    onCreate,
    onSaved,
    onError,
  } = options;

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const saveGenerationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingDirtyRef = useRef(false);

  const runSave = useCallback(async (definitionOverride?: WorkflowDefinition): Promise<boolean> => {
    if (savingRef.current) {
      pendingDirtyRef.current = true;
      return false;
    }
    savingRef.current = true;
    const generation = ++saveGenerationRef.current;
    setAutoSaveStatus('saving');

    const defToSave = definitionOverride ?? definition;
    const localErrors = validateConnections(defToSave);
    if (localErrors.length > 0) {
      savingRef.current = false;
      setAutoSaveStatus('error');
      onError(localErrors.join('; '));
      return false;
    }

    const defWithPolicy = buildDefinitionForRun(definitionOverride);
    try {
      const validation = await api.workflows.validate(
        workflowId && !isNewWorkflow ? workflowId : crypto.randomUUID(),
        defWithPolicy,
      );
      if (generation !== saveGenerationRef.current) return false;
      if (!validation.ok) {
        setAutoSaveStatus('error');
        onError(validation.errors?.map((e) => e.message).join('; ') ?? 'Validation failed');
        return false;
      }

      if (isNewWorkflow) {
        await onCreate(defWithPolicy);
      } else if (workflowId) {
        await api.workflows.update(workflowId, defWithPolicy);
      }

      if (generation !== saveGenerationRef.current) return false;
      setAutoSaveStatus('saved');
      onSaved();
      return true;
    } catch (e) {
      if (generation !== saveGenerationRef.current) return false;
      setAutoSaveStatus('error');
      onError(e instanceof Error ? e.message : 'Save failed');
      return false;
    } finally {
      savingRef.current = false;
      if (pendingDirtyRef.current) {
        pendingDirtyRef.current = false;
        void runSave();
      }
    }
  }, [
    buildDefinitionForRun,
    definition,
    isNewWorkflow,
    onCreate,
    onError,
    onSaved,
    validateConnections,
    workflowId,
  ]);

  const flushAutoSave = useCallback(
    async (options?: { force?: boolean; definition?: WorkflowDefinition }): Promise<boolean> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!options?.force && !dirty && !isNewWorkflow) return true;
      return runSave(options?.definition);
    },
    [dirty, isNewWorkflow, runSave],
  );

  const flushAutoSaveRef = useRef(flushAutoSave);
  flushAutoSaveRef.current = flushAutoSave;

  useEffect(() => {
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [dirty, definition, runSave]);

  useEffect(() => {
    return () => {
      void flushAutoSaveRef.current();
    };
  }, []);

  return { autoSaveStatus, flushAutoSave, setAutoSaveStatus };
}
