// F16 Python label scripts: xml_swap.py modes and XXE hardening (IDS-10407).
// Needs python3 with lxml; a missing interpreter or module fails the test.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { PYTHON, SCRIPTS_DIR } from '../support/env';
import { feature, issue } from '../support/features';
import { run } from '../support/run';

const SWAP = path.join(SCRIPTS_DIR, 'xml_swap.py');
const NS = 'xmlns:pds="http://pds.nasa.gov/pds4/pds/v1"';

async function swap(testInfo: import('@playwright/test').TestInfo, args: string[]) {
  const r = await run([PYTHON, '-I', SWAP, ...args], { cwd: testInfo.outputDir });
  await testInfo.attach(`xml_swap ${args.slice(-1)[0]}.log`,
    { body: `$ xml_swap.py ${args.join(' ')}\nexit ${r.exitCode}\n${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
  return r;
}

test.describe('F16 Python label scripts', feature('F16'), () => {
  test.beforeAll(async () => {
    const r = await run([PYTHON, '-I', '-c', 'import lxml']);
    if (r.exitCode !== 0) throw new Error(`${PYTHON} with lxml is required (pip install lxml): ${r.stderr}`);
  });

  test('replace mode swaps one element and keeps the rest', async ({}, testInfo) => {
    const target = testInfo.outputPath('t.xml');
    const source = testInfo.outputPath('s.xml');
    const out = testInfo.outputPath('out.xml');
    writeFileSync(target, `<?xml version="1.0"?>\n<P ${NS}><pds:A>old</pds:A><pds:B>keep</pds:B></P>\n`);
    writeFileSync(source, `<?xml version="1.0"?>\n<P ${NS}><pds:A>new</pds:A></P>\n`);
    const r = await swap(testInfo, [target, '//pds:A', source, out]);
    expect(r.exitCode).toBe(0);
    const text = readFileSync(out, 'utf8');
    expect(text).toContain('<pds:A>new</pds:A>');
    expect(text).toContain('<pds:B>keep</pds:B>');
    expect(text).not.toContain('old');
  });

  test('list mode prints structural XPaths', async ({}, testInfo) => {
    const file = testInfo.outputPath('l.xml');
    writeFileSync(file, `<?xml version="1.0"?>\n<P ${NS}><pds:A>x</pds:A></P>\n`);
    const r = await swap(testInfo, [file, '--list-xpaths']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/pds:A/);
  });

  test('show mode does not expand external entities', async ({}, testInfo) => {
    issue('IDS-10407', 'lxml parser must not resolve entities or use the network');
    const secret = testInfo.outputPath('secret.txt');
    writeFileSync(secret, 'XXE-SECRET-CONTENT');
    const evil = testInfo.outputPath('evil.xml');
    writeFileSync(evil, `<?xml version="1.0"?>\n<!DOCTYPE label [ <!ENTITY xxe SYSTEM "${pathToFileURL(secret)}"> ]>\n`
      + `<label ${NS}><pds:a>&xxe;</pds:a></label>\n`);
    const r = await swap(testInfo, [evil, '//pds:a', '--show-xpath']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain('XXE-SECRET-CONTENT');
    expect(r.stdout).toContain('&xxe;');
  });
});
