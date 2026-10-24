// Output formats: every FORMAT= name the legacy tstjConvertIIO.csh loop
// used (29 names/aliases), written from a synthetic 3-band BYTE image, plus
// 16-bit and float inputs to the formats that can hold them. FORMAT=isis is
// skipped: vicario reads ISIS cubes but has never had an ISIS writer, and the
// legacy loop never checked its output (ISIS output is an open feature question).
// jpeg-ls and jpeg-lossless came only from jai_imageio's native CLib writer, which
// this build cannot load; until true lossless output is decided they are skipped.
// RAW and PNM files are decoded here (RAW has no header; this build has no working
// PNM reader) and compared with the SyntheticGen formula.
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { synthetic } from '../support/env';
import { about, deferred, feature, issue, type Scope } from '../support/features';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';
import type { SyntheticSpec } from '../support/synthetic';

type Mode = 'lossless' | 'lossy' | 'raw' | 'pnm' | 'skip';
const NO_LOSSLESS_JPEG = 'jpeg-ls and jpeg-lossless were only served by jai_imageio\'s native CLib writer, which this build does not ship (and which wrote lossy JPEG under these names); whether to add true lossless JPEG / JPEG-LS output is undecided';
const RAW_FIXED = 'REVIEW-3: fixed: RAW output was padded to whole 256 x 256 tiles (and tile-ordered) unless OFORM was given';
const BMP_FIXED = 'REVIEW-4: fixed: the BMP writers threw ArrayIndexOutOfBoundsException for 3-band band-sequential or band-interleaved input';
const PNM_FIXED = 'REVIEW-4: fixed: the jai_imageio PNM writer could not load on Java 17+; vicario now has its own PNM writer';
/** Attach a fixed-issue note written as "ID: what was wrong". */
const fixedIssue = (note: string) => issue(note.split(': ')[0], note.split(': ').slice(1).join(': '));
// [name, mode, reason]: for 'skip' why it is deferred, otherwise the fixed issue it guards
const FORMATS: [string, Mode, string?][] = [
  ['tif', 'lossless'], ['tiff', 'lossless'], ['TIF', 'lossless'], ['TIFF', 'lossless'],
  ['png', 'lossless'], ['PNG', 'lossless'],
  ['jpeg2000', 'lossless'], ['JPEG2000', 'lossless'], ['JPEG 2000', 'lossless'], ['jpeg 2000', 'lossless'],
  ['pds', 'lossless'], ['vicar', 'lossless'],
  ['jpg', 'lossy'], ['JPG', 'lossy'], ['jpeg', 'lossy'], ['JPEG', 'lossy'],
  ['raw', 'raw', RAW_FIXED], ['RAW', 'raw', RAW_FIXED],
  ['bmp', 'lossless', BMP_FIXED], ['BMP', 'lossless', BMP_FIXED],
  ['pnm', 'pnm', PNM_FIXED], ['PNM', 'pnm', PNM_FIXED],
  ['jfif', 'lossy'], ['JFIF', 'lossy'],
  ['jpeg-ls', 'skip', NO_LOSSLESS_JPEG], ['JPEG-LS', 'skip', NO_LOSSLESS_JPEG],
  ['jpeg-lossless', 'skip', NO_LOSSLESS_JPEG], ['JPEG-LOSSLESS', 'skip', NO_LOSSLESS_JPEG],
  ['isis', 'skip', 'vicario has no ISIS writer, only an ISIS2 reader, so ISIS output is not a supported feature; the legacy loop ran this name but never checked the result, and adding ISIS output (ISIS2 or ISIS3) is undecided'],
];

/** What a FORMAT test checks, and its scope, by mode. */
const CHECKS: Record<Mode, string> = {
  lossless: 'Passes when the output decodes to exactly the input pixels.',
  lossy: "Passes when the output has the input's size and bands and its mean is within 2 DN of the input (JPEG is lossy).",
  raw: 'Passes when the file holds exactly width x height x bands bytes and they are the input pixels in band-sequential (BSQ) order.',
  pnm: "Passes when the file is a binary PPM (`P6`, maxval 255) of the input's size whose samples are exactly the input pixels.",
  skip: 'Skipped: ', // followed by the format's own reason
};
const SCOPES_FOR: Record<Mode, Scope[]> = { lossless: ['@lossless'], lossy: ['@nominal'], raw: ['@nominal', '@lossless'], pnm: ['@nominal', '@lossless'], skip: ['@off-nominal'] };

/** A SyntheticGen image and its sample type. */
type Gen = SyntheticSpec & { file: string; type: 'byte' | 'half' | 'real' };
const gen = (file: string, type: Gen['type'], nl: number, ns: number, nb: number, linc = 1, sinc = 3, binc = 40): Gen =>
  ({ file, type, nl, ns, nb, linc, sinc, binc });
const BYTE_BSQ = gen('gen_byte_bsq.vic', 'byte', 64, 48, 3);
const BYTES = { byte: 1, half: 2, real: 4 } as const;

/** The value SyntheticGen stores at (line, sample, band): line*linc + sample*sinc + band*binc in the image's type. */
function genValue(g: Gen, line: number, sample: number, band: number) {
  const v = line * g.linc + sample * g.sinc + band * g.binc;
  return g.type === 'real' ? Math.fround(v) : g.type === 'half' ? Math.trunc(v) : Math.trunc(v) & 0xff;
}

/**
 * Number of samples in `buf` (from `offset`, big-endian) that differ from the
 * synthetic image, read in band-sequential (BSQ) or pixel-interleaved (BIP) order.
 */
function mismatches(buf: Buffer, offset: number, g: Gen, order: 'bsq' | 'bip') {
  const size = BYTES[g.type];
  let bad = 0;
  for (let b = 0; b < g.nb; b++) for (let l = 0; l < g.nl; l++) for (let s = 0; s < g.ns; s++) {
    const i = order === 'bsq' ? (b * g.nl + l) * g.ns + s : (l * g.ns + s) * g.nb + b;
    const at = offset + i * size;
    const v = size === 1 ? buf[at] : size === 2 ? buf.readUInt16BE(at) : buf.readFloatBE(at);
    if (v !== genValue(g, l, s, b)) bad++;
  }
  return bad;
}

/** Header of a binary PNM file: magic (P5/P6), size, maxval and where the samples start. */
function pnmHeader(buf: Buffer) {
  const m = /^(P[56])\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 64).toString('latin1'));
  if (!m) throw new Error('not a binary PNM header');
  return { magic: m[1], width: +m[2], height: +m[3], maxval: +m[4], offset: m[0].length };
}

test.describe('Output formats', feature('output-formats'), () => {
  const input = synthetic('gen_byte_bsq.vic');

  FORMATS.forEach(([format, mode, reason], i) => {
    const fixed = mode === 'skip' ? undefined : reason;
    // number the titles: aliases differing only in case would otherwise share an
    // output directory on case-insensitive file systems (macOS)
    test(`FORMAT=${format} (#${String(i + 1).padStart(2, '0')})`, about(
      `Converts the synthetic 3-band BYTE image with \`FORMAT=${format}\`, one of the 29 format names and aliases in the legacy test. ${CHECKS[mode]}${mode === 'skip' ? `${reason}.` : ''}`,
      '@legacy', ...SCOPES_FOR[mode], ...(fixed ? ['@regression' as Scope] : []),
    ), async ({}, testInfo) => {
      if (mode === 'skip') deferred('REVIEW-19', reason!);
      if (fixed) fixedIssue(fixed);
      const src = await probe(testInfo, input);
      const r = await convert(testInfo, input, `out.${format.replace(/ /g, '_').toLowerCase()}`, { format });
      expectConverted(r);
      if (mode === 'raw') {
        const raw = readFileSync(r.out);
        expect(raw.length, 'raw size = width x height x bands').toBe(src.width * src.height * src.bands);
        expect(mismatches(raw, 0, BYTE_BSQ, 'bsq'), 'samples differing from the input (BSQ order)').toBe(0);
        return;
      }
      if (mode === 'pnm') {
        const pnm = readFileSync(r.out);
        const h = pnmHeader(pnm);
        expect([h.magic, h.width, h.height, h.maxval]).toEqual(['P6', src.width, src.height, 255]);
        expect(pnm.length - h.offset, 'sample bytes').toBe(src.width * src.height * src.bands);
        expect(mismatches(pnm, h.offset, BYTE_BSQ, 'bip'), 'samples differing from the input').toBe(0);
        return;
      }
      const out = await probe(testInfo, r.out);
      if (mode === 'lossless') {
        expectSamePixels(out, src);
      } else {
        expect([out.width, out.height, out.bands]).toEqual([src.width, src.height, src.bands]);
        expect(Math.abs(out.mean! - src.mean!), 'JPEG mean within 2 DN').toBeLessThan(2);
      }
    });
  });

  // RAW: exactly lines x samples x bands samples, band sequential, big-endian, whatever the
  // input organisation, type or size (it used to be padded to whole 256 x 256 tiles)
  for (const [g, what, scope] of [
    [gen('gen_byte_bil.vic', 'byte', 64, 48, 3), '3-band BYTE band-interleaved-by-line (BIL) image', '@nominal'],
    [gen('gen_byte_bip.vic', 'byte', 64, 48, 3), '3-band BYTE band-interleaved-by-pixel (BIP) image', '@nominal'],
    [gen('gen_byte_gray.vic', 'byte', 64, 48, 1, 1, 3, 0), '1-band BYTE image', '@nominal'],
    [gen('gen_half_bsq.vic', 'half', 64, 48, 3), '3-band HALF (16-bit) image', '@nominal'],
    [gen('gen_real_100x100.vic', 'real', 100, 100, 1, 0.5, 0.25, 0), '100 x 100 REAL (float) image, which is not a multiple of the 256-pixel tile size,', '@off-nominal'],
    [gen('gen_byte_ns1_nl1024.vic', 'byte', 1024, 1, 1, 1, 1, 0), '1024-line by 1-sample BYTE image, four 256-line tiles tall,', '@off-nominal'],
  ] as const) {
    test(`RAW output of ${g.file} is exactly its samples, band sequential`, about(
      `Converts the synthetic ${what} with \`FORMAT=raw\`. Passes when the file holds exactly lines x samples x bands samples of ${BYTES[g.type]} byte(s) each and they equal the input pixels in band-sequential (BSQ) order, big-endian.`,
      scope, '@lossless', '@regression',
    ), async ({}, testInfo) => {
      fixedIssue(RAW_FIXED);
      const r = await convert(testInfo, synthetic(g.file), 'out.raw', { format: 'raw' });
      expectConverted(r);
      const raw = readFileSync(r.out);
      expect(raw.length, 'raw size').toBe(g.nl * g.ns * g.nb * BYTES[g.type]);
      expect(mismatches(raw, 0, g, 'bsq'), 'samples differing from the input (BSQ order)').toBe(0);
    });
  }

  test('BMP output of a band-interleaved-by-line (BIL) image keeps its pixels', about(
    'Converts the synthetic 3-band BYTE BIL image (a line-interleaved raster the BMP writers could not handle) with `FORMAT=bmp`. Passes when the BMP decodes to exactly the input pixels.',
    '@nominal', '@lossless', '@regression',
  ), async ({}, testInfo) => {
    fixedIssue(BMP_FIXED);
    const bil = synthetic('gen_byte_bil.vic');
    const r = await convert(testInfo, bil, 'bil.bmp', { format: 'bmp' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, bil));
  });

  test('HALF input to BMP without OFORM is refused with a non-zero exit', about(
    'Converts the synthetic 3-band HALF (16-bit) image with `FORMAT=bmp`; BMP cannot hold 16-bit samples. Passes when jConvertIIO exits non-zero and reports "Image write failed".',
    '@off-nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'half.bmp', { format: 'bmp' });
    expect(r.exitCode, 'jConvertIIO exit code').not.toBe(0);
    expect(`${r.stdout}\n${r.stderr}`).toContain('Image write failed');
  });

  test('a writer that crashes fails the conversion cleanly', about(
    'Converts the synthetic 3-band BYTE image with `FORMAT=wbmp`; the WBMP writer only takes 1-bit images and throws an IllegalArgumentException. Passes when jConvertIIO exits non-zero, names the failed writer and reports "Image write failed", with no stack trace.',
    '@off-nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('REVIEW-4', 'fixed: a writer throwing a runtime exception or error escaped jConvertIIO as an uncaught stack trace');
    const r = await convert(testInfo, input, 'out.wbmp', { format: 'wbmp' });
    expect(r.exitCode, 'jConvertIIO exit code').not.toBe(0);
    expect(r.stdout).toContain('the wbmp writer failed');
    expect(`${r.stdout}\n${r.stderr}`).toContain('Image write failed');
    expect(`${r.stdout}\n${r.stderr}`, 'no stack trace').not.toMatch(/^\s+at /m);
  });

  // PNM: P5 for one band, P6 for three; 8-bit or 16-bit
  for (const [g, magic, maxval, what] of [
    [gen('gen_byte_gray.vic', 'byte', 64, 48, 1, 1, 3, 0), 'P5', 255, '1-band BYTE image as an 8-bit PGM (`P5`, maxval 255)'],
    [gen('gen_half_bsq.vic', 'half', 64, 48, 3), 'P6', 65535, '3-band HALF (16-bit) image as a 16-bit PPM (`P6`, maxval 65535, big-endian)'],
  ] as const) {
    test(`PNM output of ${g.file} keeps its pixels`, about(
      `Converts the synthetic ${what} with \`FORMAT=pnm\`. Passes when the header gives that type, size and maxval and every sample equals the input pixel.`,
      '@nominal', '@lossless', '@regression',
    ), async ({}, testInfo) => {
      fixedIssue(PNM_FIXED);
      const r = await convert(testInfo, synthetic(g.file), 'out.pnm', { format: 'pnm' });
      expectConverted(r);
      const pnm = readFileSync(r.out);
      const h = pnmHeader(pnm);
      expect([h.magic, h.width, h.height, h.maxval]).toEqual([magic, g.ns, g.nl, maxval]);
      expect(pnm.length - h.offset, 'sample bytes').toBe(g.nl * g.ns * g.nb * BYTES[g.type]);
      expect(mismatches(pnm, h.offset, g, 'bip'), 'samples differing from the input').toBe(0);
    });
  }

  for (const [file, what, message] of [
    ['gen_real_bsq.vic', 'REAL (float) image; PNM holds only 8- or 16-bit integers', 'PNM holds 8- or 16-bit integer samples'],
    ['gen_byte_rgba.vic', '4-band BYTE image; PNM holds 1 or 3 bands', 'PNM holds 1 (PGM) or 3 (PPM) bands'],
  ] as const) {
    test(`PNM output of ${file} is refused with a message`, about(
      `Converts the synthetic ${what}, with \`FORMAT=pnm\`. Passes when jConvertIIO exits non-zero, says why ("${message}") and reports "Image write failed".`,
      '@off-nominal',
    ), async ({}, testInfo) => {
      const r = await convert(testInfo, synthetic(file), 'out.pnm', { format: 'pnm' });
      expect(r.exitCode, 'jConvertIIO exit code').not.toBe(0);
      expect(r.stdout).toContain(message);
      expect(`${r.stdout}\n${r.stderr}`).toContain('Image write failed');
    });
  }

  test('a PNM file written by jConvertIIO can be read back as input', about(
    'Writes the synthetic 3-band BYTE image as PNM, then converts that PNM to PNG. Passes when the second conversion succeeds and the PNG has exactly the original pixels.',
    '@off-nominal',
  ), async ({}, testInfo) => {
    deferred('NEW-output-3', 'jConvertIIO cannot read PNM input: jai_imageio 1.1\'s PNM reader cannot load on Java 17+ (it uses a JDK-internal class). PNM input is not documented, and a replacement reader is a new feature beyond the PNM output fix');
    const pnm = await convert(testInfo, input, 'out.pnm', { format: 'pnm' });
    expectConverted(pnm);
    const r = await convert(testInfo, pnm.out, 'back.png', { format: 'png' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('a TIFF file written by jConvertIIO can be read back as input', about(
    'Writes the synthetic 3-band BYTE image as TIFF, then converts that TIFF to PNG. Passes when the second conversion succeeds with no exception and the PNG has exactly the original pixels.',
    '@nominal', '@lossless', '@regression',
  ), async ({}, testInfo) => {
    issue('NEW-output-1', 'fixed: reading TIFF input failed with IllegalStateException "seekForwardOnly and allowSearch can\'t both be true"');
    const tif = await convert(testInfo, input, 'out.tif', { format: 'tif' });
    expectConverted(tif);
    const r = await convert(testInfo, tif.out, 'back.png', { format: 'png' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  for (const [type, formats] of [['half', ['tif', 'png', 'jpeg2000', 'pds', 'vicar']], ['real', ['tif', 'pds', 'vicar']]] as const) {
    for (const format of formats) {
      test(`${type.toUpperCase()} input to FORMAT=${format} is lossless`, about(
        `Converts the synthetic ${type.toUpperCase()} image with \`FORMAT=${format}\`, which can hold ${type === 'half' ? '16-bit' : 'floating-point'} data. Passes when the output decodes to exactly the input pixels.`,
        '@nominal', '@lossless',
      ), async ({}, testInfo) => {
        const input16 = synthetic(`gen_${type}_bsq.vic`);
        const r = await convert(testInfo, input16, `${type}.${format}`, { format });
        expectConverted(r);
        expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input16));
      });
    }
  }

  test('a FORMAT with no registered writer is refused with a message', about(
    `Converts the synthetic image with \`FORMAT=no-such-format\`, a name no ImageIO writer registers. Passes when jConvertIIO exits non-zero with a "no ImageWriter for FORMAT=" message, no stack trace and no output file.`,
    '@off-nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'out.nsf', { format: 'no-such-format' });
    expect(r.exitCode, 'jConvertIIO exit code').not.toBe(0);
    expect(r.stdout, 'names the unsupported format').toContain('no ImageWriter for FORMAT=no-such-format');
    expect(`${r.stdout}\n${r.stderr}`, 'no stack trace').not.toMatch(/Exception/);
    expect(existsSync(r.out), 'no output file').toBe(false);
  });

  test('REAL input to PNG without OFORM is refused with a non-zero exit', about(
    `Converts a REAL (float) image to PNG without \`OFORM\`; PNG cannot hold floating-point data. Passes when jConvertIIO refuses with a non-zero exit code.`,
    '@off-nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_real_bsq.vic'), 'real.png', { format: 'png' });
    expect(r.exitCode).not.toBe(0);
  });

  test('HALF input to JPEG without OFORM is refused with a non-zero exit', about(
    `Converts a HALF (16-bit) image to JPEG without \`OFORM\`; the JPEG writer cannot encode 16-bit data. Passes when jConvertIIO exits non-zero instead of leaving an empty file.`,
    '@off-nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('IDS-8497', 'fixed: jConvertIIO used to exit 0 and leave an empty file when the writer could not encode the data type');
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'half.jpg', { format: 'jpg' });
    expect(r.exitCode).not.toBe(0);
  });
});
