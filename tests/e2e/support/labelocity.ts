// Runs PDS4 label generation the way Labelocity's LabelImage script does
// (jConvertIIO FORMAT=pds4 with a Velocity template), using the pinned public
// Labelocity release for the PDS4 writer, Velocity and the mission templates,
// and the vicario jar under test in place of the copy bundled with Labelocity.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';
import { asset } from './data';
import { E2E_ROOT, PRODUCT_JAVA, thinJar } from './env';
import { run } from './run';

const UNPACKED = path.join(E2E_ROOT, '.cache', 'labelocity-1.0');

/**
 * Unpack the release once per checkout (the archive itself is verified by
 * sha256). Workers race here, so each extracts privately and renames into place.
 */
function labelocity(): string {
  const root = path.join(UNPACKED, 'pkg');
  if (!existsSync(root)) {
    const tmp = path.join(UNPACKED, `tmp-${process.pid}`);
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    execFileSync('tar', ['-xzf', asset('labelocity-1.0'), '-C', tmp]);
    try {
      renameSync(tmp, root);
    } catch {
      rmSync(tmp, { recursive: true, force: true }); // another worker won
    }
  }
  return root;
}

export async function generatePds4Label(testInfo: TestInfo, image: string, template = 'mipl_cameras.vm') {
  const root = labelocity();
  const jars = path.join(root, 'jars');
  const classpath = [thinJar(),
    ...readdirSync(jars).filter((f) => f.endsWith('.jar') && !f.startsWith('vicario-')).map((f) => path.join(jars, f)),
    jars].join(path.delimiter);
  // Velocity resolves #parse'd macro files relative to the working directory
  const templates = testInfo.outputPath('templates');
  cpSync(path.join(root, 'templates'), templates, { recursive: true });
  const work = testInfo.outputPath('label');
  mkdirSync(work, { recursive: true });
  const img = path.join(work, path.basename(image));
  cpSync(image, img);
  const out = img.replace(/\.[^.]+$/, '.xml');
  const args = [...PRODUCT_JAVA, '-Djava.awt.headless=true', '-cp', classpath, 'jpl.mipl.io.jConvertIIO', `inp=${img}`, `out=${out}`,
    'ri=true', 'format=pds4', 'pds_detached_only=true', 'pds_label_type=PDS4', `velo_template=${path.join(templates, template)}`];
  const r = await run(args, { cwd: templates });
  await testInfo.attach('label-generation.log', {
    body: `$ jConvertIIO inp=${path.basename(img)} format=pds4 pds_detached_only=true pds_label_type=PDS4 velo_template=${template}\n`
      + `exit ${r.exitCode}\n${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
  return { ...r, image: img, label: out };
}
