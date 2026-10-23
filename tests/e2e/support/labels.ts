// PDS3 label helpers shared by the PDS3 and XSL specs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';

/** The ODL label text up to END. */
export function pdsLabel(file: string): string {
  const text = readFileSync(file, 'latin1');
  const end = text.search(/\r?\nEND\s*\r?\n/);
  expect(end, `${path.basename(file)} has an END statement`).toBeGreaterThan(0);
  return text.slice(0, end);
}

/** Structural checks shared by every PDS3 label we write. */
export function expectValidPds3Label(file: string, dims: { lines: number; samples: number; bands: number }) {
  const label = pdsLabel(file);
  expect(label).toMatch(/^(PDS_VERSION_ID\s*=\s*PDS3|ODL_VERSION_ID\s*=\s*ODL3)/);
  expect(label).toMatch(/\^IMAGE\s*=/);
  expect(label).toMatch(/OBJECT\s*=\s*IMAGE[\s\S]*END_OBJECT\s*=\s*IMAGE/);
  expect(label).toMatch(new RegExp(`\\bLINES\\s*=\\s*${dims.lines}\\b`));
  expect(label).toMatch(new RegExp(`\\bLINE_SAMPLES\\s*=\\s*${dims.samples}\\b`));
  expect(label).toMatch(new RegExp(`\\bBANDS\\s*=\\s*${dims.bands}\\b`));
  expect(label, 'no empty quoted values (IDS-8815)').not.toMatch(/=\s*""/);
  return label;
}
