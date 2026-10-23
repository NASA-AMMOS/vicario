// Golden pixel hashes for public products. Regenerate with
// `npm run goldens:update` and explain any change in the PR (see criteria.md).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { E2E_ROOT } from './env';
import type { Probe } from './run';

const GOLDENS = path.join(E2E_ROOT, 'goldens', 'goldens.json');
const updating = process.env.UPDATE_GOLDENS === '1';

type Golden = Pick<Probe, 'width' | 'height' | 'bands' | 'dataType' | 'pixelSha256' | 'min' | 'max'> & {
  observed: { date: string; os: string; java: string };
};

function load(): Record<string, Golden> {
  return existsSync(GOLDENS) ? JSON.parse(readFileSync(GOLDENS, 'utf8')) : {};
}

export function expectGolden(key: string, p: Probe) {
  const goldens = load();
  if (updating) {
    goldens[key] = {
      width: p.width, height: p.height, bands: p.bands, dataType: p.dataType,
      pixelSha256: p.pixelSha256, min: p.min, max: p.max,
      observed: { date: new Date().toISOString().slice(0, 10), os: `${os.platform()}-${os.arch()}`,
        java: process.env.JAVA_VERSION_LABEL ?? 'unknown' },
    };
    const sorted = Object.fromEntries(Object.entries(goldens).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(GOLDENS, JSON.stringify(sorted, null, 2) + '\n');
    return;
  }
  const g = goldens[key];
  expect(g, `no golden '${key}'; run npm run goldens:update and commit goldens/goldens.json`).toBeTruthy();
  expect({ width: p.width, height: p.height, bands: p.bands, dataType: p.dataType })
    .toEqual({ width: g.width, height: g.height, bands: g.bands, dataType: g.dataType });
  expect(p.pixelSha256, `pixel hash for ${key}`).toBe(g.pixelSha256);
}
