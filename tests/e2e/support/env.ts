// Paths and executables shared by the harness. Everything is relative to the
// repository; nothing here may point at site-specific locations.
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(E2E_ROOT, '..', '..');
export const DATA_DIR = path.join(E2E_ROOT, '.cache', 'data');
export const SYNTH_DIR = path.join(E2E_ROOT, '.cache', 'synthetic');
export const TEST_CLASSES = path.join(REPO_ROOT, 'target', 'test-classes');
export const XSL_DIR = path.join(REPO_ROOT, 'src', 'main', 'resources', 'jpl', 'mipl', 'io', 'xsl');
export const SCRIPTS_DIR = path.join(REPO_ROOT, 'src', 'main', 'scripts');

export const JAVA = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', 'java')
  : 'java';

export const PYTHON = process.env.VICARIO_PYTHON || 'python3';

/** The shaded jar from `mvn -P shade package`, or $VICARIO_FAT_JAR. */
export function fatJar(): string {
  if (process.env.VICARIO_FAT_JAR) return path.resolve(process.env.VICARIO_FAT_JAR);
  const target = path.join(REPO_ROOT, 'target');
  const jars = existsSync(target)
    ? readdirSync(target).filter((f) => /^vicario-.*-FAT\.jar$/.test(f))
    : [];
  if (jars.length === 0) {
    throw new Error('No target/vicario-*-FAT.jar; run: mvn -B -P shade -DskipTests package test-compile');
  }
  jars.sort((a, b) => statSync(path.join(target, b)).mtimeMs - statSync(path.join(target, a)).mtimeMs);
  return path.join(target, jars[0]);
}

export const synthetic = (name: string) => path.join(SYNTH_DIR, name);
