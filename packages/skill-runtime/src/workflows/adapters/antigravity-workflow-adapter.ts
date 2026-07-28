import type {
  WorkflowTemplateGate,
  WorkflowTemplateIR,
  WorkflowTemplateStep,
} from '../workflow-template-ir.js';

type YamlMap = Record<string, unknown>;

function parseScalar(raw: string): string | number | boolean {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v.replace(/^["']|["']$/g, '');
}

type Frame =
  | { kind: 'map'; indent: number; value: YamlMap }
  | { kind: 'list'; indent: number; value: unknown[] };

function parentMap(frames: Frame[]): YamlMap | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i]!;
    if (f.kind === 'map') return f.value;
  }
  return null;
}

function parentList(frames: Frame[]): unknown[] | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i]!;
    if (f.kind === 'list') return f.value;
  }
  return null;
}

/** Minimal YAML subset for `.workflow.yaml` templates (maps + lists, 2-space indent). */
export function parseWorkflowYaml(raw: string): YamlMap {
  const root: YamlMap = {};
  const frames: Frame[] = [{ kind: 'map', indent: -1, value: root }];

  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    while (frames.length > 1 && indent <= frames[frames.length - 1]!.indent) {
      frames.pop();
    }

    const trimmed = line.trim();
    const listItem = /^-\s+(.+)$/.exec(trimmed);
    if (listItem) {
      const list = parentList(frames);
      if (!list) continue;
      const rest = listItem[1]!;
      const inlineKv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(rest);
      if (inlineKv) {
        const item: YamlMap = { [inlineKv[1]!]: parseScalar(inlineKv[2]!) };
        list.push(item);
        frames.push({ kind: 'map', indent, value: item });
      } else {
        list.push(parseScalar(rest));
      }
      continue;
    }

    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmed);
    if (!kv) continue;
    const key = kv[1]!;
    const valuePart = kv[2]!;

    const map = parentMap(frames);
    if (!map) continue;

    if (!valuePart) {
      const next = lines[i + 1];
      const nextIndent = next?.match(/^\s*/)?.[0].length ?? 0;
      const nextIsList = next && nextIndent > indent && next.trim().startsWith('-');
      if (nextIsList) {
        const arr: unknown[] = [];
        map[key] = arr;
        frames.push({ kind: 'list', indent, value: arr });
      } else {
        const child: YamlMap = {};
        map[key] = child;
        frames.push({ kind: 'map', indent, value: child });
      }
      continue;
    }

    map[key] = parseScalar(valuePart);
  }

  return root;
}

function parseGate(raw: unknown): WorkflowTemplateGate | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const g = raw as YamlMap;
  if (g.type !== 'human_approval') return undefined;
  return {
    type: 'human_approval',
    onReject: g.onReject === 'loop' ? 'loop' : g.onReject === 'fail' ? 'fail' : undefined,
  };
}

function parseSteps(raw: unknown): WorkflowTemplateStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: WorkflowTemplateStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const s = item as YamlMap;
    const id = String(s.id ?? '').trim();
    const skillRef = String(s.skillRef ?? '').trim();
    if (!id || !skillRef) continue;
    steps.push({
      id,
      agentRole: s.agentRole ? String(s.agentRole) : undefined,
      skillRef,
      promptTemplate: s.promptTemplate ? String(s.promptTemplate) : undefined,
      gate: parseGate(s.gate),
    });
  }
  return steps;
}

export function parseAntigravityWorkflowYaml(raw: string): WorkflowTemplateIR {
  const doc = parseWorkflowYaml(raw);
  const steps = parseSteps(doc.steps);
  const id = String(doc.id ?? 'workflow').trim();
  const triggersRaw =
    doc.triggers && typeof doc.triggers === 'object' && !Array.isArray(doc.triggers)
      ? (doc.triggers as YamlMap)
      : undefined;
  return {
    manifestVersion: Number(doc.manifestVersion ?? 1),
    id,
    name: String(doc.name ?? id),
    description: doc.description ? String(doc.description) : undefined,
    provenance: doc.provenance ? String(doc.provenance) : 'antigravity',
    triggers: triggersRaw
      ? {
          slashCommand: triggersRaw.slashCommand
            ? String(triggersRaw.slashCommand)
            : undefined,
        }
      : undefined,
    steps,
  };
}
