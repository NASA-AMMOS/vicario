// Batch, streaming and remote input: ARGFILE batches (serial and parallel),
// file names without extensions, OUT=- to stdout, and http(s) input from the
// public PDS archive.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { PRODUCT_JAVA, fatJar, synthetic } from '../support/env';
import { about, feature, issue, needsReview } from '../support/features';
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

  test('OUT=- with SILENT writes the image to stdout', about(
    `Converts to PNG with \`OUT=-\` and \`SILENT\`, which should stream the image to stdout. Passes when the exit code is 0 and stdout starts with the PNG signature.`,
    '@nominal',
  ), async ({}, testInfo) => {
    needsReview('REVIEW-12', 'OUT=- fails with IllegalArgumentException "image == null!" and writes nothing');
    const r = await run([...PRODUCT_JAVA, '-Djava.awt.headless=true', '-cp', fatJar(), 'jpl.mipl.io.jConvertIIO',
      `inp=${synthetic('gen_byte_bsq.vic')}`, 'out=-', 'format=png', 'SILENT'], { cwd: testInfo.outputDir });
    await testInfo.attach('stdout.log', { body: `exit ${r.exitCode}\n${r.stderr}`, contentType: 'text/plain' });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.startsWith('\u0089PNG'), 'stdout is a PNG').toBe(true);
  });
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
