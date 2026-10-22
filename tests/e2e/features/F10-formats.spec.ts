// F10 Output formats: every FORMAT= name the legacy tstjConvertIIO.csh loop
// used (29 names/aliases), written from a synthetic 3-band BYTE image, plus
// 16-bit and float inputs to the formats that can hold them.
import { statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { synthetic } from '../support/env';
import { feature, knownFailure } from '../support/features';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

type Mode = 'lossless' | 'lossy' | 'raw' | 'fail';
const NO_WRITER = 'no ImageIO writer for this format name on 64-bit JVMs (long-standing failure in the ST2-4.1 interactive test)';
const FORMATS: [string, Mode, string?][] = [
  ['tif', 'lossless'], ['tiff', 'lossless'], ['TIF', 'lossless'], ['TIFF', 'lossless'],
  ['png', 'lossless'], ['PNG', 'lossless'],
  ['jpeg2000', 'lossless'], ['JPEG2000', 'lossless'], ['JPEG 2000', 'lossless'], ['jpeg 2000', 'lossless'],
  ['pds', 'lossless'], ['vicar', 'lossless'],
  ['jpg', 'lossy'], ['JPG', 'lossy'], ['jpeg', 'lossy'], ['JPEG', 'lossy'],
  ['raw', 'raw'], ['RAW', 'raw'],
  ['bmp', 'fail', 'UNFILED-4: BMP writer throws ArrayIndexOutOfBoundsException for 3-band input'],
  ['BMP', 'fail', 'UNFILED-4: BMP writer throws ArrayIndexOutOfBoundsException for 3-band input'],
  ['pnm', 'fail', 'UNFILED-4: PNM writer (jai-imageio) fails to initialise on JDK 17+'],
  ['PNM', 'fail', 'UNFILED-4: PNM writer (jai-imageio) fails to initialise on JDK 17+'],
  ['jfif', 'fail', `LEGACY: ${NO_WRITER}`], ['JFIF', 'fail', `LEGACY: ${NO_WRITER}`],
  ['jpeg-ls', 'fail', `LEGACY: ${NO_WRITER}`], ['JPEG-LS', 'fail', `LEGACY: ${NO_WRITER}`],
  ['jpeg-lossless', 'fail', `LEGACY: ${NO_WRITER}`], ['JPEG-LOSSLESS', 'fail', `LEGACY: ${NO_WRITER}`],
  ['isis', 'fail', `LEGACY: ${NO_WRITER}`],
];

test.describe('F10 Output formats', feature('F10'), () => {
  const input = synthetic('gen_byte_bsq.vic');

  FORMATS.forEach(([format, mode, issue], i) => {
    // number the titles: aliases differing only in case would otherwise share an
    // output directory on case-insensitive file systems (macOS)
    test(`FORMAT=${format} (#${String(i + 1).padStart(2, '0')})`, async ({}, testInfo) => {
      if (mode === 'fail') knownFailure(issue!.split(':')[0], issue!.split(': ').slice(1).join(': '));
      const src = await probe(testInfo, input);
      const r = await convert(testInfo, input, `out.${format.replace(/ /g, '_').toLowerCase()}`, { format });
      expectConverted(r);
      if (mode === 'raw') {
        knownFailure('UNFILED-3', 'RAW output is padded to 256 x 256 tiles unless OFORM is given');
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
      test(`${type.toUpperCase()} input to FORMAT=${format} is lossless`, async ({}, testInfo) => {
        const input16 = synthetic(`gen_${type}_bsq.vic`);
        const r = await convert(testInfo, input16, `${type}.${format}`, { format });
        expectConverted(r);
        expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input16));
      });
    }
  }

  test('REAL input to PNG without OFORM is refused with a non-zero exit', async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_real_bsq.vic'), 'real.png', { format: 'png' });
    expect(r.exitCode).not.toBe(0);
  });

  test('HALF input to JPEG without OFORM is refused with a non-zero exit', async ({}, testInfo) => {
    knownFailure('UNFILED-5', 'jConvertIIO exits 0 and leaves an empty file when the writer cannot encode the data type');
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'half.jpg', { format: 'jpg' });
    expect(r.exitCode).not.toBe(0);
  });
});
