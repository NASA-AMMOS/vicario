// Python label scripts: xml_swap.py modes and XXE hardening (IDS-10407), and
// build_mesh_extras.py (mesh label extras) with its path validation.
// Needs python3 with lxml; a missing interpreter or module fails the test.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '../support/test';
import { PYTHON, SCRIPTS_DIR } from '../support/env';
import { about, feature, issue } from '../support/features';
import { run } from '../support/run';

const SWAP = path.join(SCRIPTS_DIR, 'xml_swap.py');
const MESH = path.join(SCRIPTS_DIR, 'build_mesh_extras.py');
const NS = 'xmlns:pds="http://pds.nasa.gov/pds4/pds/v1"';

async function swap(testInfo: import('@playwright/test').TestInfo, args: string[]) {
  const r = await run([PYTHON, '-I', SWAP, ...args], { cwd: testInfo.outputDir });
  await testInfo.attach(`xml_swap ${args.slice(-1)[0]}.log`,
    { body: `$ xml_swap.py ${args.join(' ')}\nexit ${r.exitCode}\n${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
  return r;
}

test.describe('Python label scripts', feature('python-scripts'), () => {
  test.beforeAll(async () => {
    const r = await run([PYTHON, '-I', '-c', 'import lxml']);
    if (r.exitCode !== 0) throw new Error(`${PYTHON} with lxml is required (pip install lxml): ${r.stderr}`);
  });

  test('replace mode swaps one element and keeps the rest', about(
    `Runs \`xml_swap.py\` in replace mode: replaces \`//pds:A\` in a target document with the element from a source document. Passes when the output has the new element, keeps the untouched sibling and no longer has the old value.`,
    '@nominal',
  ), async ({}, testInfo) => {
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

  test('list mode prints structural XPaths', about(
    `Runs \`xml_swap.py --list-xpaths\` on a PDS4-namespaced document. Passes when it exits 0 and lists the \`pds:A\` element path.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const file = testInfo.outputPath('l.xml');
    writeFileSync(file, `<?xml version="1.0"?>\n<P ${NS}><pds:A>x</pds:A></P>\n`);
    const r = await swap(testInfo, [file, '--list-xpaths']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/pds:A/);
  });

  test('show mode does not expand external entities', about(
    `Runs \`xml_swap.py --show-xpath\` on a document with an external entity that would read a local "secret" file. Passes when the element is printed with the entity unexpanded (\`&xxe;\`) and the secret never appears.`,
    '@security', '@malformed-input', '@regression',
  ), async ({}, testInfo) => {
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

  test('build_mesh_extras.py writes the mesh extras JSON (LabelObj usage)', about(
    `Runs \`build_mesh_extras.py\` on a mesh \`.mtl\` file. Passes when the JSON it writes holds the solar longitude and the texture PNG list from the \`.mtl\`.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const dir = testInfo.outputPath('work');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'mesh.mtl'), '# SOLAR_LONGITUDE 123.4\nnewmtl a\nmap_Kd NLA_411614614RASLF0051986NCAM00346M1.png\n');
    writeFileSync(path.join(dir, 'mesh.VIC'), '');
    const r = await run([PYTHON, '-I', MESH, '--in', 'mesh.VIC', '--out', 'mesh.json', '--mtl', 'mesh.mtl'], { cwd: dir });
    await testInfo.attach('build_mesh_extras.log', { body: `exit ${r.exitCode}\n${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(path.join(dir, 'mesh.json'), 'utf8'))).toEqual({
      SOLAR_LONGITUDE: '123.4', PNGS: '(NLA_411614614RASLF0051986NCAM00346M1.png)' });
  });

  test('build_mesh_extras.py refuses paths outside its folders or of the wrong type', about(
    `Runs \`build_mesh_extras.py\` with four bad paths: an output outside its folders (\`../escaped.json\`), an output that is not \`.json\`, and \`/etc/hosts\` as the \`.mtl\` and as the base JSON. Passes when each run exits non-zero with a \`build_mesh_extras:\` error and writes nothing.`,
    '@security', '@off-nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('S8707', 'SonarCloud pythonsecurity:S8707 path traversal via command-line arguments');
    const dir = testInfo.outputPath('work');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'mesh.mtl'), 'map_Kd a.png\n');
    writeFileSync(path.join(dir, 'mesh.VIC'), '');
    const attempts: Array<[string, string[], string]> = [
      ['output outside the folders', ['--out', '../escaped.json'], testInfo.outputPath('escaped.json')],
      ['output that is not JSON', ['--out', 'run.sh'], path.join(dir, 'run.sh')],
      ['mtl that is not an .mtl file', ['--out', 'x.json', '--mtl', '/etc/hosts'], path.join(dir, 'x.json')],
      ['base that is not JSON', ['--out', 'y.json', '--base', '/etc/hosts'], path.join(dir, 'y.json')],
    ];
    for (const [what, args, mustNotExist] of attempts) {
      await test.step(what, async () => {
        const full = ['--in', 'mesh.VIC', ...(args.includes('--mtl') ? [] : ['--mtl', 'mesh.mtl']), ...args];
        const r = await run([PYTHON, '-I', MESH, ...full], { cwd: dir });
        expect(r.exitCode, `${what}: ${r.stderr}`).not.toBe(0);
        expect(r.stderr).toContain('build_mesh_extras:');
        expect(existsSync(mustNotExist), `${path.basename(mustNotExist)} not written`).toBe(false);
      });
    }
  });
});
