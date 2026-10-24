// Output formats: every FORMAT= name the legacy tstjConvertIIO.csh loop
// used (29 names/aliases), written from a synthetic 3-band BYTE image, plus
// 16-bit and float inputs to the formats that can hold them. FORMAT=isis is
// skipped: vicario reads ISIS cubes but has never had an ISIS writer, and the
// legacy loop never checked its output (ISIS output is an open feature question).
// jpeg-ls and jpeg-lossless came only from jai_imageio's native CLib writer, which
// this build cannot load; until true lossless output is decided they are skipped.
import { existsSync, statSync } from 'node:fs';
import { expect, test } from '../support/test';
import { synthetic } from '../support/env';
import { about, deferred, feature, issue, needsReview, type Scope } from '../support/features';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

type Mode = 'lossless' | 'lossy' | 'raw' | 'fail' | 'skip';
const NO_LOSSLESS_JPEG = 'jpeg-ls and jpeg-lossless were only served by jai_imageio\'s native CLib writer, which this build does not ship (and which wrote lossy JPEG under these names); whether to add true lossless JPEG / JPEG-LS output is undecided';
const FORMATS: [string, Mode, string?][] = [
  ['tif', 'lossless'], ['tiff', 'lossless'], ['TIF', 'lossless'], ['TIFF', 'lossless'],
  ['png', 'lossless'], ['PNG', 'lossless'],
  ['jpeg2000', 'lossless'], ['JPEG2000', 'lossless'], ['JPEG 2000', 'lossless'], ['jpeg 2000', 'lossless'],
  ['pds', 'lossless'], ['vicar', 'lossless'],
  ['jpg', 'lossy'], ['JPG', 'lossy'], ['jpeg', 'lossy'], ['JPEG', 'lossy'],
  ['raw', 'raw'], ['RAW', 'raw'],
  ['bmp', 'fail', 'REVIEW-4: BMP writer throws ArrayIndexOutOfBoundsException for 3-band input'],
  ['BMP', 'fail', 'REVIEW-4: BMP writer throws ArrayIndexOutOfBoundsException for 3-band input'],
  ['pnm', 'fail', 'REVIEW-4: PNM writer (jai-imageio) fails to initialise on JDK 17+'],
  ['PNM', 'fail', 'REVIEW-4: PNM writer (jai-imageio) fails to initialise on JDK 17+'],
  ['jfif', 'lossy'], ['JFIF', 'lossy'],
  ['jpeg-ls', 'skip', NO_LOSSLESS_JPEG], ['JPEG-LS', 'skip', NO_LOSSLESS_JPEG],
  ['jpeg-lossless', 'skip', NO_LOSSLESS_JPEG], ['JPEG-LOSSLESS', 'skip', NO_LOSSLESS_JPEG],
  ['isis', 'skip', 'vicario has no ISIS writer, only an ISIS2 reader, so ISIS output is not a supported feature; the legacy loop ran this name but never checked the result, and adding ISIS output (ISIS2 or ISIS3) is undecided'],
];

/** What a FORMAT test checks, and its scope, by mode (failing modes get the lossy check). */
const CHECKS: Record<Mode, string> = {
  lossless: 'Passes when the output decodes to exactly the input pixels.',
  lossy: "Passes when the output has the input's size and bands and its mean is within 2 DN of the input (JPEG is lossy).",
  raw: 'Passes when the file holds exactly width x height x bands bytes.',
  fail: "Passes when the output decodes with the input's size and bands and its mean within 2 DN of the input.",
  skip: 'Skipped: ', // followed by the format's own reason
};
const SCOPES_FOR: Record<Mode, Scope[]> = { lossless: ['@lossless'], lossy: ['@nominal'], raw: ['@nominal'], fail: ['@nominal'], skip: ['@off-nominal'] };

test.describe('Output formats', feature('output-formats'), () => {
  const input = synthetic('gen_byte_bsq.vic');

  FORMATS.forEach(([format, mode, issue], i) => {
    // number the titles: aliases differing only in case would otherwise share an
    // output directory on case-insensitive file systems (macOS)
    test(`FORMAT=${format} (#${String(i + 1).padStart(2, '0')})`, about(
      `Converts the synthetic 3-band BYTE image with \`FORMAT=${format}\`, one of the 29 format names and aliases in the legacy test. ${CHECKS[mode]}${mode === 'skip' ? `${issue}.` : ''}`,
      '@legacy', ...SCOPES_FOR[mode],
    ), async ({}, testInfo) => {
      if (mode === 'skip') deferred('REVIEW-19', issue!);
      if (mode === 'fail') needsReview(issue!.split(':')[0], issue!.split(': ').slice(1).join(': '));
      const src = await probe(testInfo, input);
      const r = await convert(testInfo, input, `out.${format.replace(/ /g, '_').toLowerCase()}`, { format });
      expectConverted(r);
      if (mode === 'raw') {
        needsReview('REVIEW-3', 'RAW output is padded to 256 x 256 tiles unless OFORM is given');
        expect(statSync(r.out).size, 'raw size = width x height x bands').toBe(src.width * src.height * src.bands);
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
