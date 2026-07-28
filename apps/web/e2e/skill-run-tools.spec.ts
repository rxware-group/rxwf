import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { parseMatrixTable } from '../../../scripts/validate-e2e-matrix.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const matrixPath = path.join(repoRoot, 'docs/test/e2e-coverage-matrix.md');
const SPEC_FILE = 'skill-run-tools.spec.ts';

function readSkillRunMatrixRow() {
  const content = readFileSync(matrixPath, 'utf8');
  const { rows } = parseMatrixTable(content);
  const row = rows.find((entry) => entry.row_id === 'E2E-N-skillRun');
  if (!row) {
    throw new Error('E2E-N-skillRun row missing from e2e-coverage-matrix.md');
  }
  return row;
}

async function openNewWorkflowEditor(page: Page) {
  await page.goto('/workflows/new');
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.editor-palette-pane input[type="search"]')).toBeVisible();
}

async function addPaletteNode(palette: Locator, label: string) {
  const search = palette.locator('input[type="search"]');
  await search.fill(label);
  const button = palette.getByRole('button', { name: label });
  await expect(button).toBeVisible();
  await button.click();
  await search.fill('');
}

test.describe('skillRun e2e matrix', () => {
  test('E2E-N-skillRun matrix row is covered by this spec', () => {
    const row = readSkillRunMatrixRow();
    expect(row.status).toBe('covered');
    expect(row.e2e_spec).toBe(SPEC_FILE);
    expect(row.node_type).toBe('skillRun');
    expect(row.track).toBe('plus');
  });
});

test.describe('skillRun satellite tools @any', () => {
  test('editor adds skillRun with write/grep/web_search tool satellites', async ({ page }) => {
    await openNewWorkflowEditor(page);

    const canvas = page.locator('.react-flow');
    const palette = page.locator('.editor-palette-pane');

    await addPaletteNode(palette, 'Skill Run');
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Skill Run$/ }),
    ).toHaveCount(1);
    await addPaletteNode(palette, 'Tool (Write)');
    await addPaletteNode(palette, 'Tool (Grep)');
    await addPaletteNode(palette, 'Tool (Web Search)');

    await expect(canvas.locator('.react-flow__node')).toHaveCount(6);
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Chat Model$/ }),
    ).toHaveCount(1);
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Tool \(Write\)$/ }),
    ).toHaveCount(1);
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Tool \(Grep\)$/ }),
    ).toHaveCount(1);
    await expect(
      canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Tool \(Web Search\)$/ }),
    ).toHaveCount(1);
  });

  test('skillRun node editor shows skill source parameters', async ({ page }) => {
    await openNewWorkflowEditor(page);

    const palette = page.locator('.editor-palette-pane');
    await addPaletteNode(palette, 'Skill Run');

    const skillNode = page
      .locator('.react-flow__node')
      .filter({ has: page.locator('.workflow-node-caption-title', { hasText: /^Skill Run$/ }) });
    await skillNode.dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('来源', { exact: true })).toBeVisible();
    await expect(modal.getByText('Skill', { exact: true })).toBeVisible();
    await expect(modal.getByText('工作区', { exact: true })).toBeVisible();
  });

  test('toolWrite node editor shows builtin tool description', async ({ page }) => {
    await openNewWorkflowEditor(page);

    const palette = page.locator('.editor-palette-pane');
    await addPaletteNode(palette, 'Tool (Write)');

    const toolNode = page
      .locator('.react-flow__node')
      .filter({ has: page.locator('.workflow-node-caption-title', { hasText: /^Tool \(Write\)$/ }) });
    await toolNode.dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Tool 描述', { exact: true })).toBeVisible();
    await expect(modal.locator('.node-builtin-tool-description')).toContainText('写入');
  });

  test('/help/nodes/skillRun documents write/grep/web_search satellites', async ({ page }) => {
    await page.goto('/help/nodes/skillRun');

    await expect(page.locator('.help-doc-page--missing')).toHaveCount(0);
    await expect(page.locator('.help-doc-page')).toContainText('Skill Run 节点');
    await expect(page.locator('.help-doc-page')).toContainText('toolWrite');
    await expect(page.locator('.help-doc-page')).toContainText('toolGrep');
    await expect(page.locator('.help-doc-page')).toContainText('toolWebSearch');
  });
});
