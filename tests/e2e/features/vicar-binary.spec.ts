// VICAR binary headers and prefixes: a Cassini ISS image carries a binary
// label header (NLB=1) and a 24-byte prefix on every line (NBB=24). The pixels
// must decode the same through every read path, and KEEP_LINE_PREFIX must carry
// the prefix bytes into VICAR and PDS output unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { about, feature, issue } from '../support/features';
import { synthetic } from '../support/env';
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

/** The binary header of a VICAR file: NLB records after the label. */
function vicarHeader(file: string): Buffer {
  const l = vicarLabel(file);
  const [lbl, rec, nlb] = ['LBLSIZE', 'RECSIZE', 'NLB'].map((k) => Number(l[k] ?? 0));
  return readFileSync(file).subarray(lbl, lbl + nlb * rec);
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

/**
 * A 3-band BSQ BYTE VICAR image (8 x 4) with a 4-byte prefix on every record:
 * 'B', band, 'L', line. Pixel (band b, line l, sample s) is 50b + 10l + s.
 */
function prefixedBands(file: string) {
  const [ns, nl, nb, nbb] = [8, 4, 3, 4];
  const rec = nbb + ns;
  const items = `FORMAT='BYTE' TYPE='IMAGE' BUFSIZ=${rec} DIM=3 EOL=0 RECSIZE=${rec} ORG='BSQ' NL=${nl} NS=${ns} NB=${nb} `
    + `N1=${ns} N2=${nl} N3=${nb} N4=0 NBB=${nbb} NLB=0 HOST='JAVA' INTFMT='HIGH' REALFMT='IEEE' `
    + `BHOST='JAVA' BINTFMT='HIGH' BREALFMT='IEEE' BLTYPE='TEST'`;
  const size = Math.ceil((items.length + 20) / rec) * rec;
  const label = Buffer.alloc(size, ' ');
  label.write(`LBLSIZE=${size}  ${items}`, 'latin1');
  const data = Buffer.alloc(nb * nl * rec);
  for (let b = 0; b < nb; b++) for (let l = 0; l < nl; l++) {
    const at = (b * nl + l) * rec;
    data.set([0x42, b, 0x4c, l], at);
    for (let s = 0; s < ns; s++) data[at + nbb + s] = 50 * b + 10 * l + s;
  }
  writeFileSync(file, Buffer.concat([label, data]));
  return { nl, nb };
}

test.describe('VICAR binary headers and prefixes', feature('vicar-binary'), () => {
  test('Cassini ISS image (NLB=1, NBB=24) decodes identically with RI=true', about(
    `Reads a public Cassini ISS image with a binary label header (\`NLB=1\`) and a 24-byte prefix on every line (\`NBB=24\`), then converts it to VICAR with \`RI=true\` (read as a RenderedImage). Passes when the pixels match the recorded golden hash and the output has the same pixels.`,
    '@mission-data', '@lossless', { added: '2026-10-23' },
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
    '@mission-data', '@lossless', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini.pds', { format: 'pds', KEEP_LINE_PREFIX: 'true' });
    expectConverted(r);
    expect(readFileSync(r.out).subarray(0, 65536).toString('latin1')).toMatch(/LINE_PREFIX_BYTES\s*=\s*24/);
    expect(pdsPrefixes(r.out, 8)).toEqual(vicarPrefixes(img, 8));
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('KEEP_LINE_PREFIX=true carries the prefixes into VICAR output', about(
    `Converts the Cassini ISS image to VICAR with \`KEEP_LINE_PREFIX=true\`. Passes when the output label has \`NBB=24\`, \`RECSIZE=2072\` and the input's \`BLTYPE\`/\`BHOST\`/\`BINTFMT\`/\`BREALFMT\`, the first 8 and the last line prefixes are byte for byte those of the input, no binary header is written (\`NLB=0\`, the \`ADD_BINARY_HEADER\` default), and the pixels are unchanged.`,
    '@mission-data', '@lossless', '@regression', { added: '2026-10-23', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-13', 'fixed: VICAR output dropped the line prefixes (NBB=0) even with KEEP_LINE_PREFIX=true');
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini_keep.vic', { format: 'vicar', KEEP_LINE_PREFIX: 'true' });
    expectConverted(r);
    const l = vicarLabel(r.out);
    const inl = vicarLabel(img);
    expect([l.NBB, l.RECSIZE, l.NLB]).toEqual(['24', '2072', '0']);
    for (const k of ['BLTYPE', 'BHOST', 'BINTFMT', 'BREALFMT']) expect(l[k], k).toBe(inl[k]);
    expect(vicarPrefixes(r.out, 8)).toEqual(vicarPrefixes(img, 8));
    expect(vicarPrefixes(r.out, 1024)[1023]).toEqual(vicarPrefixes(img, 1024)[1023]);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('VICAR output keeps the line prefixes by default', about(
    `Converts the Cassini ISS image to VICAR without \`KEEP_LINE_PREFIX\`, which the help documents as defaulting to true. Passes when the output has \`NBB=24\` and the input's first 8 line prefixes, and the pixels are unchanged.`,
    '@mission-data', '@lossless', '@regression', { added: '2026-10-23', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-13', 'fixed: the documented KEEP_LINE_PREFIX default (true) was ignored for VICAR output');
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini_default.vic', { format: 'vicar' });
    expectConverted(r);
    expect(vicarLabel(r.out).NBB).toBe('24');
    expect(vicarPrefixes(r.out, 8)).toEqual(vicarPrefixes(img, 8));
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('KEEP_LINE_PREFIX=false strips the prefixes from VICAR output', about(
    `Converts the Cassini ISS image to VICAR with \`KEEP_LINE_PREFIX=false\`. Passes when the output has \`NBB=0\` and \`RECSIZE=2048\` (1024 HALF samples, no prefix) and the pixels are unchanged.`,
    '@mission-data', '@lossless', { added: '2026-10-23', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini_strip.vic', { format: 'vicar', KEEP_LINE_PREFIX: 'false' });
    expectConverted(r);
    const l = vicarLabel(r.out);
    expect([l.NBB, l.RECSIZE, l.NLB]).toEqual(['0', '2048', '0']);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('ADD_BINARY_HEADER=true writes the binary header to VICAR output', about(
    `Converts the Cassini ISS image to VICAR with \`ADD_BINARY_HEADER=true\`. Passes when the output label has \`NLB=1\`, the binary header record is byte for byte the input's, the line prefixes are kept, and the pixels are unchanged.`,
    '@mission-data', '@lossless', '@regression', { added: '2026-10-23', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-13', 'fixed: VICAR output had no binary header (NLB=0) even with ADD_BINARY_HEADER=true');
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini_hdr.vic', { format: 'vicar', ADD_BINARY_HEADER: 'true' });
    expectConverted(r);
    const l = vicarLabel(r.out);
    expect([l.NLB, l.NBB, l.RECSIZE]).toEqual(['1', '24', '2072']);
    expect(vicarHeader(r.out)).toEqual(vicarHeader(img));
    expect(vicarPrefixes(r.out, 8)).toEqual(vicarPrefixes(img, 8));
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('ADD_BINARY_HEADER=true with KEEP_LINE_PREFIX=false fits the header to the shorter records', about(
    `Converts the Cassini ISS image to VICAR with \`ADD_BINARY_HEADER=true KEEP_LINE_PREFIX=false\`, so the records shrink from 2072 to 2048 bytes. Passes when the output has \`NLB=1\`, \`NBB=0\`, \`RECSIZE=2048\`, its header record equals the first 2048 bytes of the input's (the 24 bytes cut are all zero), and the pixels are unchanged.`,
    '@mission-data', '@lossless', '@regression', { added: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-13', 'fixed: the binary header was not written to VICAR output');
    const img = asset('cassini-iss-img');
    const r = await convert(testInfo, img, 'cassini_hdr_noprefix.vic',
      { format: 'vicar', ADD_BINARY_HEADER: 'true', KEEP_LINE_PREFIX: 'false' });
    expectConverted(r);
    const l = vicarLabel(r.out);
    expect([l.NLB, l.NBB, l.RECSIZE]).toEqual(['1', '0', '2048']);
    const inHeader = vicarHeader(img);
    expect(inHeader.subarray(2048).every((b) => b === 0)).toBe(true);
    expect(vicarHeader(r.out)).toEqual(inHeader.subarray(0, 2048));
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('prefixes are not written when SOURCE_REGION drops lines', about(
    `Converts the first 100 lines of the Cassini ISS image to VICAR with \`SOURCE_REGION=(0,0,1024,100) KEEP_LINE_PREFIX=true\`. The line prefixes describe 1024 lines, so they can no longer be matched to output lines. Passes when the conversion succeeds with \`NBB=0\`, a warning saying the prefixes were not written, and the output is 1024 x 100.`,
    '@mission-data', '@off-nominal', { added: '2026-10-24' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, asset('cassini-iss-img'), 'cassini_region.vic',
      { format: 'vicar', SOURCE_REGION: '(0,0,1024,100)', KEEP_LINE_PREFIX: 'true' });
    expectConverted(r);
    expect(vicarLabel(r.out).NBB).toBe('0');
    expect(`${r.stdout}\n${r.stderr}`).toMatch(/not writing the 24-byte line prefixes/);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height]).toEqual([1024, 100]);
  });

  test('KEEP_LINE_PREFIX and ADD_BINARY_HEADER are harmless without binary data', about(
    `Converts a synthetic VICAR image with no prefixes and no binary header to VICAR with \`KEEP_LINE_PREFIX=true ADD_BINARY_HEADER=true\`. Passes when the output has \`NBB=0\` and \`NLB=0\` and the pixels are unchanged.`,
    '@off-nominal', '@lossless', { added: '2026-10-23', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    const src = synthetic('gen_half_bsq.vic');
    const r = await convert(testInfo, src, 'plain.vic', { format: 'vicar', KEEP_LINE_PREFIX: 'true', ADD_BINARY_HEADER: 'true' });
    expectConverted(r);
    const l = vicarLabel(r.out);
    expect([l.NBB, l.NLB]).toEqual(['0', '0']);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, src));
  });

  test('prefixes do not follow the wrong band when BANDS reorders the bands', about(
    `Converts a synthetic 3-band VICAR image whose line prefixes name their band and line to VICAR with \`BANDS=(2,1,0)\` and \`KEEP_LINE_PREFIX=true\`. The band count is unchanged but the bands are reversed. Passes when no output record carries a prefix from a different band: either the prefixes are dropped with a warning (\`NBB=0\`) or each record's prefix names the input band now in that position.`,
    '@off-nominal', '@regression', { added: '2026-10-28' },
  ), async ({}, testInfo) => {
    issue('REVIEW-13', 'fixed: with BANDS reordering the bands, the line prefixes were written in the input band order');
    const src = testInfo.outputPath('prefixed_bands.vic');
    const { nl, nb } = prefixedBands(src);
    const r = await convert(testInfo, src, 'reordered.vic', { format: 'vicar', BANDS: '(2,1,0)', KEEP_LINE_PREFIX: 'true' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height, p.bands]).toEqual([8, 4, 3]);
    if (vicarLabel(r.out).NBB === '0') {
      expect(`${r.stdout}\n${r.stderr}`).toMatch(/not writing the line prefixes/);
    } else {
      const prefixes = vicarPrefixes(r.out, nb * nl);
      for (let b = 0; b < nb; b++) for (let l = 0; l < nl; l++) {
        expect([...prefixes[b * nl + l]], `output band ${b} line ${l}`).toEqual([0x42, nb - 1 - b, 0x4c, l]);
      }
    }
  });

  test('BANDS that keeps every band in place keeps the prefixes', about(
    `Converts the same synthetic 3-band prefixed image to VICAR with \`BANDS=(0,1,2)\` and \`KEEP_LINE_PREFIX=true\`. Passes when the output keeps \`NBB=4\` and every record's prefix is the input's for the same band and line.`,
    '@nominal', '@lossless', { added: '2026-10-28' },
  ), async ({}, testInfo) => {
    const src = testInfo.outputPath('prefixed_bands.vic');
    const { nl, nb } = prefixedBands(src);
    const r = await convert(testInfo, src, 'same_order.vic', { format: 'vicar', BANDS: '(0,1,2)', KEEP_LINE_PREFIX: 'true' });
    expectConverted(r);
    expect(vicarLabel(r.out).NBB).toBe('4');
    expect(vicarPrefixes(r.out, nb * nl)).toEqual(vicarPrefixes(src, nb * nl));
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, src));
  });
});

