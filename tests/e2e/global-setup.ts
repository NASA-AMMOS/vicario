// Runs once before the specs: checks the build outputs exist and generates the
// synthetic VICAR images (the replacement for VICAR `gen` in the legacy suite).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { manifestAssets } from './support/data';
import { DATA_DIR, JACOCO_AGENT, JACOCO_E2E_EXEC, JAVA, SYNTH_DIR, TEST_CLASSES, fatJar } from './support/env';

export default function globalSetup() {
  const jar = fatJar();
  const probe = path.join(TEST_CLASSES, 'jpl', 'mipl', 'io', 'testsupport', 'ImageProbe.class');
  if (!existsSync(probe)) {
    throw new Error('target/test-classes is missing ImageProbe; run: mvn -B -P shade -DskipTests package test-compile');
  }
  // Verify the data up front: inside a knownFailure test a missing or corrupt
  // asset would otherwise be absorbed as the "expected" failure.
  const full = process.argv.some((a) => /full/.test(a)) || process.env.VICARIO_TIER === 'full';
  const problems: string[] = [];
  for (const a of manifestAssets()) {
    const file = path.join(DATA_DIR, a.file);
    if (!existsSync(file)) {
      if (a.tier === 'fast' || full) problems.push(`${a.file} missing`);
    } else if (createHash('sha256').update(readFileSync(file)).digest('hex') !== a.sha256) {
      problems.push(`${a.file} does not match its pinned sha256`);
    }
  }
  // Labels name their data files exactly; macOS forgives a case mismatch, Linux CI does not.
  const names = manifestAssets().map((a) => a.file);
  for (const a of manifestAssets().filter((x) => /\.(lbl|lab|xml)$/i.test(x.file))) {
    const file = path.join(DATA_DIR, a.file);
    if (!existsSync(file)) continue;
    const refs = readFileSync(file, 'latin1').matchAll(/\^\w+\s*=\s*\(?\s*"([^"]+)"|<file_name>\s*([^<\s]+)/g);
    for (const [, p, x] of refs) {
      const ref = p ?? x;
      const near = names.find((n) => n !== ref && n.toLowerCase() === ref.toLowerCase());
      if (near) problems.push(`${a.file} refers to ${ref} but the manifest saves it as ${near}`);
    }
  }
  if (problems.length) {
    problems.splice(0, problems.length, ...new Set(problems));
    throw new Error(`test data not ready (run npm run data:${full ? 'full' : 'fast'}):\n  ${problems.join('\n  ')}`);
  }

  // Coverage runs start from an empty file; the agent appends to it.
  if (JACOCO_AGENT) {
    if (!existsSync(JACOCO_AGENT)) throw new Error(`VICARIO_JACOCO_AGENT=${JACOCO_AGENT} does not exist; run: mvn -B -P coverage,shade package test-compile`);
    rmSync(JACOCO_E2E_EXEC, { force: true });
  }

  rmSync(SYNTH_DIR, { recursive: true, force: true });
  execFileSync(JAVA, ['-cp', `${jar}${path.delimiter}${TEST_CLASSES}`, 'jpl.mipl.io.testsupport.SyntheticGen', SYNTH_DIR],
    { stdio: 'pipe' });
  console.log(`vicario feature tests: ${path.basename(jar)}, synthetic data in ${path.relative(process.cwd(), SYNTH_DIR)}`);
}
