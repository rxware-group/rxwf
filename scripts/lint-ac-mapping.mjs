#!/usr/bin/env node
/**
 * Validates fixtures/ac-api-mapping.json against docs/openapi.yaml paths.
 * Paths with inOpenapi:true must match an OpenAPI path template.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const openapi = readFileSync(join(root, 'docs/openapi.yaml'), 'utf8');
const mapping = JSON.parse(readFileSync(join(root, 'fixtures/ac-api-mapping.json'), 'utf8'));

const openapiPaths = new Set();
for (const raw of openapi.split(/\r?\n/)) {
  const line = raw.trimEnd();
  const m = line.match(/^ {2}(\/[^\s:]+):$/);
  if (m) openapiPaths.add(m[1]);
}

/** Normalize {workflowId} vs {id} for template matching */
function pathPattern(p) {
  return p.replace(/\{[^}]+\}/g, '{}');
}

const openapiPatterns = new Set([...openapiPaths].map(pathPattern));

function matchesOpenapi(apiPath) {
  const pat = pathPattern(apiPath);
  if (openapiPatterns.has(pat)) return true;
  for (const op of openapiPaths) {
    if (pathPattern(op) === pat) return true;
  }
  return openapiPaths.has(apiPath);
}

const implementedOutsideApi = new Set([
  '/mcp/tools',
  '/mcp/tools/call',
]);

let failed = false;

for (const row of mapping.mappings) {
  const { ac, paths, inOpenapi, optional } = row;
  if (!paths?.length) {
    if (optional) continue;
    console.error(`[ac-mapping] ${ac}: no paths defined`);
    failed = true;
    continue;
  }
  for (const p of paths) {
    if (inOpenapi) {
      if (!matchesOpenapi(p)) {
        console.error(`[ac-mapping] ${ac}: path ${p} not found in openapi.yaml`);
        failed = true;
      }
    } else if (!implementedOutsideApi.has(p) && !p.startsWith('/mcp/')) {
      // implementation-only paths are allowed when inOpenapi is false
      continue;
    }
  }
}

const acIds = new Set(mapping.mappings.map((r) => r.ac));
const openapiBlock = openapi.match(/^x-rxwf-ac-mapping:\n([\s\S]*?)(?:\n\S|$)/m);
if (openapiBlock) {
  const keys = [...openapiBlock[1].matchAll(/^  ([A-Za-z0-9_-]+):/gm)].map((m) => m[1]);
  for (const key of keys) {
    const normalized = key.replace(/-(\d+)$/, '-$1').replace(/^AC-(\d+)-(\d+)$/, 'AC-$1');
    const found =
      acIds.has(key) ||
      [...acIds].some((id) => key.startsWith(id) || id.startsWith(key.split('-')[0]));
    if (!found && !key.match(/^AC-\d+-\d+$/)) {
      // AC-31-34 style keys map to multiple AC rows in fixture
      if (key.includes('-') && key.split('-').length > 2) continue;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `ac-mapping OK: ${mapping.mappings.length} criteria, ${openapiPaths.size} openapi paths`,
);
