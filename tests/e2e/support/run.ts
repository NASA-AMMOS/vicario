// Process helpers: run jConvertIIO and the ImageProbe oracle, attaching
// everything a reviewer needs (command, logs, preview) to the Playwright report.
import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, type TestInfo } from '@playwright/test';
import { manifestAssets } from './data';
import { DATA_DIR, JAVA, TEST_CLASSES, fatJar } from './env';

export interface ProcResult {
  cmd: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export function run(cmd: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<ProcResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    execFile(cmd[0], cmd.slice(1), { cwd: opts.cwd, timeout: opts.timeoutMs ?? 180_000, maxBuffer: 64 << 20 },
      (err, stdout, stderr) => {
        const code = err ? (typeof (err as any).code === 'number' ? (err as any).code : 1) : 0;
        resolve({ cmd, exitCode: code, stdout: String(stdout), stderr: String(stderr), durationMs: Date.now() - start });
      });
  });
}

async function attachLogs(testInfo: TestInfo, name: string, r: ProcResult) {
  const body = [`$ ${r.cmd.map((a) => (/\s/.test(a) ? `'${a}'` : a)).join(' ')}`,
    `exit ${r.exitCode} in ${r.durationMs} ms`, '', '--- stdout ---', r.stdout, '--- stderr ---', r.stderr].join('\n');
  await testInfo.attach(`${name}.log`, { body, contentType: 'text/plain' });
}

export interface ConvertResult extends ProcResult {
  out: string;
}

/**
 * Run jConvertIIO. `kv` maps keywords to values; `true` passes a bare flag
 * (e.g. RI). The output is written into the test's own output directory.
 */
export async function convert(testInfo: TestInfo, inp: string, outName: string,
  kv: Record<string, string | true> = {}, opts: { cwd?: string } = {}): Promise<ConvertResult> {
  const out = testInfo.outputPath(outName);
  const args = Object.entries(kv).map(([k, v]) => (v === true ? k : `${k}=${v}`));
  const cmd = [JAVA, '-Djava.awt.headless=true', '-Dcom.sun.media.jai.disableMediaLib=true', '-cp', fatJar(), 'jpl.mipl.io.jConvertIIO',
    `inp=${inp}`, `out=${out}`, ...args];
  const r = await run(cmd, { cwd: opts.cwd ?? testInfo.outputDir });
  await attachLogs(testInfo, `jConvertIIO-${outName}`, r);
  return { ...r, out };
}

/**
 * jConvertIIO can exit 0 after an I/O error, so success means: exit 0, a
 * non-empty output file, and no exception or ERROR in the logs.
 */
export function expectConverted(r: ConvertResult) {
  const log = `${r.stdout}\n${r.stderr}`;
  expect(r.exitCode, 'jConvertIIO exit code').toBe(0);
  expect(log, 'jConvertIIO log should be free of exceptions').not.toMatch(/Exception|\bERROR\b/);
  expect(existsSync(r.out), `output ${path.basename(r.out)} exists`).toBe(true);
  expect(statSync(r.out).size, `output ${path.basename(r.out)} is non-empty`).toBeGreaterThan(0);
}

export interface Probe {
  file: string;
  format: string;
  width: number;
  height: number;
  bands: number;
  dataType: string;
  pixelSha256: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  std: number | null;
}

/** Decode any readable image with ImageProbe; returns null (with logs attached) if it cannot. */
export async function tryProbe(testInfo: TestInfo, file: string, opts: { preview?: boolean } = {}): Promise<Probe | null> {
  const abs = path.resolve(file);
  const base = path.basename(abs);
  const args = [JAVA, '-Djava.awt.headless=true', '-cp', `${fatJar()}${path.delimiter}${TEST_CLASSES}`,
    'jpl.mipl.io.testsupport.ImageProbe', abs];
  const preview = testInfo.outputPath(`${base}.preview.png`);
  if (opts.preview !== false) args.push('--png', preview);
  // run from the file's directory: PDS4 labels locate their data file relative to it
  const r = await run(args, { cwd: path.dirname(abs) });
  const line = r.stdout.split('\n').find((l) => l.startsWith('{'));
  if (r.exitCode !== 0 || !line) {
    await attachLogs(testInfo, `probe-${base}`, r);
    return null;
  }
  const p = JSON.parse(line) as Probe;
  await testInfo.attach(`probe-${base}.json`, { body: JSON.stringify(p, null, 2), contentType: 'application/json' });
  if (opts.preview !== false && existsSync(preview)) {
    // "[mission data]" marks previews of real mission products (not GDAL fixtures) for the overview galleries
    const asset = manifestAssets().find((a) => path.join(DATA_DIR, a.file) === abs);
    const origin = asset && !/GDAL/.test(asset.source) ? ' [mission data]' : '';
    await testInfo.attach(`${base} preview${origin}`, { path: preview, contentType: 'image/png' });
  }
  return p;
}

export async function probe(testInfo: TestInfo, file: string, opts: { preview?: boolean } = {}): Promise<Probe> {
  const p = await tryProbe(testInfo, file, opts);
  if (!p) throw new Error(`ImageProbe could not decode ${path.basename(file)} (see attached log)`);
  return p;
}

/** Same pixels: dimensions, bands and the pixel hash all match. */
export function expectSamePixels(actual: Probe, expected: Probe) {
  expect({ w: actual.width, h: actual.height, b: actual.bands }).toEqual(
    { w: expected.width, h: expected.height, b: expected.bands });
  expect(actual.pixelSha256, `pixels of ${actual.file} match ${expected.file}`).toBe(expected.pixelSha256);
}
