// F13 XML / DOM metadata: XML=true debug output, and the XXE hardening of the
// XML parsers (IDS-10406) exercised through the TreeInfo command line.
// Unit-level XXE coverage, against both the JDK parser and Xerces, is in
// src/test/java/jpl/mipl/io/util/DOMutilsXXETest.java (run by `mvn test`).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { JAVA, fatJar, synthetic } from '../support/env';
import { feature, issue } from '../support/features';
import { convert, expectConverted, run } from '../support/run';

const SECRET = 'XXE-SECRET-CONTENT';

async function treeInfo(testInfo: import('@playwright/test').TestInfo, file: string) {
  const r = await run([JAVA, '-cp', fatJar(), 'jpl.mipl.io.util.TreeInfo', file, '-'], { cwd: testInfo.outputDir });
  await testInfo.attach('TreeInfo.log', { body: `${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
  return `${r.stdout}\n${r.stderr}`;
}

test.describe('F13 XML / DOM metadata', feature('F13'), () => {
  test('XML=true writes the label DOM as XML debug documents', async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'xml_debug.pds', { format: 'pds', XML: 'true' });
    expectConverted(r);
    const xmls = readdirSync(testInfo.outputDir).filter((f) => f.endsWith('.xml'));
    expect(xmls.length, 'debug XML files written').toBeGreaterThan(0);
    for (const f of xmls) {
      const text = readFileSync(testInfo.outputPath(f), 'utf8');
      const root = text.trimStart().match(/^(?:<\?xml[^>]*>\s*)?<([A-Za-z_][\w.-]*)/);
      expect(root, `${f} starts with an element`).toBeTruthy();
      expect(text.trimEnd(), `${f} closes its root element`).toMatch(new RegExp(`</${root![1]}>$`));
      await testInfo.attach(f, { body: text, contentType: 'application/xml' });
    }
  });

  test('a DOCTYPE with a missing external DTD parses; the DTD is never loaded', async ({}, testInfo) => {
    issue('IDS-10406', 'before the fix this failed with FileNotFoundException for the DTD');
    const doc = testInfo.outputPath('label.xml');
    writeFileSync(doc, `<?xml version="1.0"?>\n<!DOCTYPE PDS_LABEL SYSTEM "${pathToFileURL(testInfo.outputPath('missing.dtd'))}">\n`
      + '<PDS_LABEL><item key="LINES">10</item></PDS_LABEL>\n');
    const log = await treeInfo(testInfo, doc);
    expect(log).not.toMatch(/Exception/);
  });

  test('external entities are not resolved (no file read, no error)', async ({}, testInfo) => {
    issue('IDS-10406', 'XXE: external general and parameter entities must be ignored');
    const secret = testInfo.outputPath('secret.txt');
    writeFileSync(secret, SECRET);
    const dtd = testInfo.outputPath('evil.dtd');
    writeFileSync(dtd, `<!ENTITY leak SYSTEM "${pathToFileURL(secret)}">`);
    const missing = pathToFileURL(testInfo.outputPath('does-not-exist.txt'));
    const doc = testInfo.outputPath('xxe.xml');
    writeFileSync(doc, '<?xml version="1.0"?>\n'
      + `<!DOCTYPE label [ <!ENTITY xxe SYSTEM "${pathToFileURL(secret)}"> <!ENTITY gone SYSTEM "${missing}">`
      + ` <!ENTITY % ext SYSTEM "${pathToFileURL(dtd)}"> %ext; ]>\n`
      + '<label><a>&xxe;</a><b>&gone;</b></label>\n');
    const log = await treeInfo(testInfo, doc);
    expect(log, 'secret not read').not.toContain(SECRET);
    expect(log, 'no attempt to open the missing entity file').not.toMatch(/FileNotFound|does-not-exist/);
  });
});
