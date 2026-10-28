// Batch, streaming and remote input: ARGFILE batches (serial and parallel),
// file names without extensions, OUT=- to stdout, and http(s) input from the
// public PDS archive.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { PRODUCT_JAVA, fatJar, synthetic } from '../support/env';
import { about, feature, issue } from '../support/features';
import { convert, expectConverted, expectSamePixels, probe, run } from '../support/run';

/** Three conversions of different inputs and formats for the batch tests. */
function writeArgFile(testInfo: import('@playwright/test').TestInfo) {
  const jobs = [
    { inp: synthetic('gen_byte_bsq.vic'), out: testInfo.outputPath('b1.png'), format: 'png' },
    { inp: synthetic('gen_half_bsq.vic'), out: testInfo.outputPath('b2.tif'), format: 'tif' },
    { inp: synthetic('gen_byte_gray.vic'), out: testInfo.outputPath('b3.vic'), format: 'vicar' },
  ];
  const file = testInfo.outputPath('args.txt');
  writeFileSync(file, jobs.map((j) => `inp=${j.inp} out=${j.out} format=${j.format}`).join('\n') + '\n');
  return { file, jobs };
}

async function jConvert(testInfo: import('@playwright/test').TestInfo, args: string[], name: string) {
  const r = await run([...PRODUCT_JAVA, '-Djava.awt.headless=true', '-Dcom.sun.media.jai.disableMediaLib=true', '-cp', fatJar(),
    'jpl.mipl.io.jConvertIIO', ...args], { cwd: testInfo.outputDir });
  await testInfo.attach(`${name}.log`, { body: `$ jConvertIIO ${args.join(' ')}\nexit ${r.exitCode}\n${r.stdout}\n${r.stderr}`,
    contentType: 'text/plain' });
  return r;
}

test.describe('Batch, streaming and remote input', feature('batch-remote'), () => {
  for (const parallel of [undefined, '2']) {
    const keywords = parallel ? `\`ARGFILE\` and \`PARALLEL_BATCH=${parallel}\`` : '`ARGFILE`';
    test(`ARGFILE batch${parallel ? ` with PARALLEL_BATCH=${parallel}` : ''} runs every line`, about(
      `Runs a batch file of 3 conversions (PNG, TIFF and VICAR from different inputs) with ${keywords}. Passes when the run exits 0 and every output exists with its input's pixels.`,
      '@nominal', '@lossless',
    ), async ({}, testInfo) => {
      const { file, jobs } = writeArgFile(testInfo);
      const args = [`ARGFILE=${file}`, ...(parallel ? [`PARALLEL_BATCH=${parallel}`] : [])];
      const r = await jConvert(testInfo, args, 'batch');
      expect(r.exitCode).toBe(0);
      for (const j of jobs) {
        expect(existsSync(j.out), `${j.out} written`).toBe(true);
        expectSamePixels(await probe(testInfo, j.out), await probe(testInfo, j.inp));
      }
    });
  }

  test('input and output file names without extensions', about(
    `Converts an input file that has no extension to an output name with no extension. Passes when the output has the input pixels.`,
    '@off-nominal', '@regression', '@lossless',
  ), async ({}, testInfo) => {
    issue('IDS-10067', 'launchers failed on file names with no extension');
    const noExt = testInfo.outputPath('noext');
    copyFileSync(synthetic('gen_byte_bsq.vic'), noExt);
    const r = await convert(testInfo, noExt, 'converted', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, synthetic('gen_byte_bsq.vic')));
  });

  /** Run jConvertIIO directly (not through convert(), which always passes out=<file>). */
  const jconvert = (testInfo: import('@playwright/test').TestInfo, args: string[]) =>
    run([...PRODUCT_JAVA, '-Djava.awt.headless=true', '-Dcom.sun.media.jai.disableMediaLib=true', '-cp', fatJar(),
      'jpl.mipl.io.jConvertIIO', ...args], { cwd: testInfo.outputPath(), binary: true }); // outputPath() creates the directory

  test('OUT=- with SILENT writes the image to stdout', about(
    `Converts the synthetic image to PNG with \`OUT=-\` and \`SILENT\`, capturing stdout as raw bytes. Passes when the exit code is 0, stdout starts with the PNG signature, decodes to the input pixels and is byte-identical to the same conversion written to a file, and no file named \`-\` is created.`,
    '@nominal', '@regression', '@lossless',
  ), async ({}, testInfo) => {
    issue('REVIEW-12', 'fixed: OUT=- failed with "image == null!", wrote an empty file named "-" and nothing to stdout');
    const src = synthetic('gen_byte_bsq.vic');
    const r = await jconvert(testInfo, [`inp=${src}`, 'out=-', 'format=png', 'SILENT']);
    await testInfo.attach('stdout.log', { body: `exit ${r.exitCode}, ${r.stdoutBytes!.length} bytes on stdout\n${r.stderr}`, contentType: 'text/plain' });
    expect(r.exitCode).toBe(0);
    const bytes = r.stdoutBytes!;
    expect(bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'stdout is a PNG').toBe(true);
    const piped = testInfo.outputPath('stdout.png');
    writeFileSync(piped, bytes);
    expectSamePixels(await probe(testInfo, piped), await probe(testInfo, src));
    const file = await convert(testInfo, src, 'file.png', { format: 'png', SILENT: true });
    expectConverted(file);
    expect(file.stdout, 'SILENT prints nothing on stdout').toBe('');
    expect(bytes.equals(readFileSync(file.out)), 'stdout bytes equal the file output').toBe(true);
    expect(existsSync(testInfo.outputPath('-')), 'no file named "-"').toBe(false);
  });

  test('OUT=- without SILENT keeps messages off stdout', about(
    `Converts the synthetic image to VICAR with \`OUT=-\` and no \`SILENT\`. Passes when the exit code is 0, the progress messages appear on stderr, and stdout holds only the VICAR file (it starts with \`LBLSIZE=\` and decodes to the input pixels).`,
    '@nominal', '@regression', '@lossless',
  ), async ({}, testInfo) => {
    issue('REVIEW-12', 'fixed: with OUT=- the messages would have been mixed into the image on stdout');
    const src = synthetic('gen_byte_bsq.vic');
    const r = await jconvert(testInfo, [`inp=${src}`, 'out=-', 'format=vicar']);
    await testInfo.attach('stderr.log', { body: `exit ${r.exitCode}\n${r.stderr}`, contentType: 'text/plain' });
    expect(r.exitCode).toBe(0);
    expect(r.stderr, 'messages go to stderr').toMatch(/Image write Done/);
    expect(r.stdout.startsWith('LBLSIZE='), 'stdout is a VICAR file').toBe(true);
    const piped = testInfo.outputPath('stdout.vic');
    writeFileSync(piped, r.stdoutBytes!);
    expectSamePixels(await probe(testInfo, piped), await probe(testInfo, src));
  });

  test('FORMAT without OUT, and OUT=- without FORMAT, are refused', about(
    `Runs jConvertIIO with \`FORMAT=png\` but no \`OUT\`, then with \`OUT=-\` but no \`FORMAT\`. Passes when both exit non-zero with a message naming the missing keyword, write nothing to stdout or to a file named \`-\`, and show no Java stack trace.`,
    '@off-nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('REVIEW-12', 'fixed: FORMAT without OUT failed with "image == null!" and left an empty file named "-"');
    const src = synthetic('gen_byte_bsq.vic');
    for (const [args, missing] of [[[`inp=${src}`, 'format=png'], /OUT=/], [[`inp=${src}`, 'out=-'], /FORMAT=/]] as const) {
      const r = await jconvert(testInfo, [...args]);
      const log = `${r.stdout}\n${r.stderr}`;
      expect(r.exitCode, args.join(' ')).not.toBe(0);
      expect(log, args.join(' ')).toMatch(missing);
      expect(log, 'no stack trace').not.toMatch(/\tat [\w.$]+\(/);
      if (args.includes('out=-')) expect(r.stdoutBytes!.length, 'nothing on stdout').toBe(0);
      expect(existsSync(testInfo.outputPath('-')), 'no file named "-"').toBe(false);
    }
  });

  for (const parallel of [undefined, '2']) {
    test(`OUT=- on an ARGFILE line is refused${parallel ? ` (PARALLEL_BATCH=${parallel})` : ''}`, about(
      `Runs an \`ARGFILE\` batch${parallel ? ` with \`PARALLEL_BATCH=${parallel}\`` : ''} whose second line converts to PNG with \`OUT=-\`. Passes when the run exits non-zero with an error naming \`OUT=-\` and \`ARGFILE\` on stderr, and no PNG data reaches stdout (it would be mixed with the batch progress text).`,
      '@off-nominal', '@regression',
    ), async ({}, testInfo) => {
      issue('REVIEW-12', 'fixed: in an ARGFILE batch, OUT=- wrote the image to stdout mixed with the batch progress text');
      const src = synthetic('gen_byte_bsq.vic');
      const file = testInfo.outputPath('args.txt');
      writeFileSync(file, `inp=${src} out=${testInfo.outputPath('first.png')} format=png\ninp=${src} out=- format=png\n`);
      const r = await jconvert(testInfo, [`ARGFILE=${file}`, ...(parallel ? [`PARALLEL_BATCH=${parallel}`] : [])]);
      await testInfo.attach('batch.log', { body: `exit ${r.exitCode}\n${r.stdout}\n${r.stderr}`, contentType: 'text/plain' });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/OUT=-.*ARGFILE/);
      expect(r.stdoutBytes!.includes(Buffer.from('\x89PNG', 'latin1')), 'no PNG on stdout').toBe(false);
    });
  }
});

test.describe('Batch, streaming and remote input (network)', feature('batch-remote', 'full'), () => {
  test('https input from the public PDS archive matches the local copy', about(
    `Converts an MSL Navcam thumbnail straight from its https URL on the public PDS Imaging Node. Passes when the result has the same pixels as the local copy.`,
    '@mission-data', '@lossless',
  ), async ({}, testInfo) => {
    const local = asset('msl-navcam-thumb-img');
    const url = 'https://planetarydata.jpl.nasa.gov/img/data/msl/MSLNAV_0XXX/DATA/SOL00100/NLA_406359343EDR_T0050104NCAM00505M1.IMG';
    const r = await convert(testInfo, url, 'remote.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, local));
  });
});
