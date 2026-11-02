// FITS images: a public FITS image read and converted losslessly.
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { about, feature, issue } from '../support/features';
import { expectGolden } from '../support/goldens';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

test.describe('FITS images', feature('fits'), () => {
  test('reads HorseHead.fits and converts it to VICAR and TIFF', about(
    `Reads the public HorseHead.fits (astropy sample data) and converts it to VICAR and TIFF. jConvertIIO flips FITS rows into display order, so outputs are compared with the source by statistics and with each other by pixels. Passes when the source matches the recorded golden hash, both outputs have the source's size, type and statistics, and the two outputs are identical.`,
    '@mission-data', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    issue('NOTE', 'jConvertIIO flips FITS (bottom-up rows) to top-down display order; the ImageIO reader returns '
      + 'storage order, so outputs are compared with each other and by statistics');
    const fits = asset('astropy-horsehead-fits');
    const src = await probe(testInfo, fits);
    expectGolden('astropy-horsehead', src);
    const outs = [];
    for (const format of ['vicar', 'tif']) {
      const r = await convert(testInfo, fits, `horsehead.${format}`, { format });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect([p.width, p.height, p.dataType, p.min, p.max, p.mean, p.std])
        .toEqual([src.width, src.height, src.dataType, src.min, src.max, src.mean, src.std]);
      outs.push(p);
    }
    expectSamePixels(outs[1], outs[0]);
  });
});
