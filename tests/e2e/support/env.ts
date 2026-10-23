// Paths and executables shared by the harness. Everything is relative to the
// repository; nothing here may point at site-specific locations.
import { execFileSync } from 'node:child_process';
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

/** The plain (non-shaded) jar, as Labelocity and other applications put it on their classpath. */
export function thinJar(): string {
  const target = path.join(REPO_ROOT, 'target');
  const jars = existsSync(target)
    ? readdirSync(target).filter((f) => /^vicario-.*\.jar$/.test(f) && !/-(FAT|javadoc|sources)\.jar$/.test(f))
    : [];
  if (jars.length === 0) throw new Error('No target/vicario-*.jar; run: mvn -B -P shade package test-compile');
  return path.join(target, jars[0]);
}

export const synthetic = (name: string) => path.join(SYNTH_DIR, name);

let sourceSha: string | undefined;

/**
 * GitHub link to a line of a test file, at the commit under test
 * ($SOURCE_SHA in CI, else the local HEAD; falls back to main).
 */
export function sourceUrl(file: string, line?: number): string {
  if (sourceSha === undefined) {
    sourceSha = process.env.SOURCE_SHA || process.env.GITHUB_SHA || '';
    if (!sourceSha) {
      try {
        sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: E2E_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      } catch { /* not a checkout */ }
    }
  }
  const repo = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}` : 'https://github.com/NASA-AMMOS/vicario';
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
  return `${repo}/blob/${sourceSha || 'main'}/${rel}${line ? `#L${line}` : ''}`;
}
