export interface WorkflowTemplateGate {
  type: 'human_approval';
  onReject?: 'loop' | 'fail';
}

export interface WorkflowTemplateStep {
  id: string;
  agentRole?: string;
  skillRef: string;
  promptTemplate?: string;
  gate?: WorkflowTemplateGate;
}

export interface WorkflowTemplateIR {
  manifestVersion: number;
  id: string;
  name: string;
  description?: string;
  provenance?: string;
  triggers?: { slashCommand?: string };
  steps: WorkflowTemplateStep[];
}
