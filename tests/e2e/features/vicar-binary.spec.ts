// VICAR binary headers and prefixes: a Cassini ISS image carries a binary
// label header (NLB=1) and a 24-byte prefix on every line (NBB=24). The pixels
// must decode the same through every read path, and KEEP_LINE_PREFIX must carry
// the prefix bytes into VICAR and PDS output unchanged.
import { readFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { about, feature, needsReview } from '../support/features';
import { expectGolden } from '../support/goldens';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

/** VICAR system label items (first LBLSIZE bytes). */
function vicarLabel(file: string): Record<string, string> {
  const head = readFileSync(file).subarray(0, 4096).toString('latin1');
  const size = Number(head.match(/LBLSIZE=\s*(\d+)/)![1]);
  return Object.fromEntries([...head.slice(0, size).matchAll(/([A-Z0-9_]+)=\s*('[^']*'|\S+)/g)]
    .map((m) => [m[1], m[2].replace(/'/g, '')]));
}

/** The first `n` line prefixes of a VICAR file (after the label and binary header records). */
function vicarPrefixes(file: string, n: number): Buffer[] {
  const l = vicarLabel(file);
  const [lbl, rec, nlb, nbb] = ['LBLSIZE', 'RECSIZE', 'NLB', 'NBB'].map((k) => Number(l[k] ?? 0));
  const data = readFileSync(file);
  return Array.from({ length: n }, (_, i) => data.subarray(lbl + (nlb + i) * rec, lbl + (nlb + i) * rec + nbb));
}

/** The first `n` line prefixes of an attached-label PDS3 file with LINE_PREFIX_BYTES. */
function pdsPrefixes(file: string, n: number): Buffer[] {
  const data = readFileSync(file);
  const text = data.subarray(0, 64 * 1024).toString('latin1');
  const recBytes = Number(text.match(/RECORD_BYTES\s*=\s*(\d+)/)![1]);
  const imageRec = Number(text.match(/\^IMAGE\s*=\s*(\d+)/)![1]);
  const prefix = Number(text.match(/LINE_PREFIX_BYTES\s*=\s*(\d+)/)?.[1] ?? 0);
  const start = (imageRec - 1) * recBytes;
  return Array.from({ length: n }, (_, i) => data.subarray(start + i * recBytes, start + i * recBytes + prefix));
}

test.describe('VICAR binary headers and prefixes', feature('vicar-binary'), () => {
  test('Cassini ISS image (NLB=1, NBB=24) decodes identically with RI=true', about(
    `Reads a public Cassini ISS image with a binary label header (\`NLB=1\`) and a 24-byte prefix on every line (\`NBB=24\`), then converts it to VICAR with \`RI=true\` (read as a RenderedImage). Passes when the pixels match the recorded golden hash and the output has the same pixels.`,
    '@mission-data', '@lossless',
  ), async ({}, testInfo) => {
    const img = asset('cassini-iss-img');
    const l = vicarLabel(img);
    expect([l.NLB, l.NBB]).toEqual(['1', '24']);
    const src = await probe(testInfo, img);
    expectGolden('cassini-iss', src);
    const r = await convert(testInfo, img, 'cassini_ri.vic', { format: 'vicar', RI: 'true' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), src);
  });

  test('KEEP_LINE_PREFIX=true carries the prefixes into PDS output', about(
    `Converts the Cassini ISS image to PDS3 with \`KEEP_LINE_PREFIX=true\`. Passes when the label declares \`LINE_PREFIX_BYTES = 24\`, the first 8 line prefixes are byte for byte those of the input, and the pixels are unchanged.`,
    '@mission-data', '@lossless',
  ), async ({}, testInfo) => {
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini.pds', { format: 'pds', KEEP_LINE_PREFIX: 'true' });
    expectConverted(r);
    expect(readFileSync(r.out).subarray(0, 65536).toString('latin1')).toMatch(/LINE_PREFIX_BYTES\s*=\s*24/);
    expect(pdsPrefixes(r.out, 8)).toEqual(vicarPrefixes(img, 8));
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('KEEP_LINE_PREFIX=true carries the prefixes into VICAR output', about(
    `Converts the Cassini ISS image to VICAR with \`KEEP_LINE_PREFIX=true\`. Passes when the output label has \`NBB=24\` and the first 8 line prefixes match the input.`,
    '@mission-data',
  ), async ({}, testInfo) => {
    needsReview('REVIEW-13', 'VICAR output drops the line prefixes (NBB=0) even with KEEP_LINE_PREFIX=true');
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini_keep.vic', { format: 'vicar', KEEP_LINE_PREFIX: 'true' });
    expectConverted(r);
    expect(vicarLabel(r.out).NBB).toBe('24');
    expect(vicarPrefixes(r.out, 8)).toEqual(vicarPrefixes(img, 8));
  });

  test('ADD_BINARY_HEADER=true writes the binary header to VICAR output', about(
    `Converts the Cassini ISS image to VICAR with \`ADD_BINARY_HEADER=true\`. Passes when the output label has \`NLB=1\`, showing the binary header was written.`,
    '@mission-data',
  ), async ({}, testInfo) => {
    needsReview('REVIEW-13', 'VICAR output has no binary header (NLB=0) even with ADD_BINARY_HEADER=true');
    const r = await convert(testInfo, asset('cassini-iss-img'), 'cassini_hdr.vic', { format: 'vicar', ADD_BINARY_HEADER: 'true' });
    expectConverted(r);
    expect(vicarLabel(r.out).NLB).toBe('1');
  });
});
