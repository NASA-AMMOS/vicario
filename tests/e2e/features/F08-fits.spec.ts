// F08 FITS read: a public FITS image read and converted losslessly.
import { expect, test } from '@playwright/test';
import { asset } from '../support/data';
import { feature, issue } from '../support/features';
import { expectGolden } from '../support/goldens';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

test.describe('F08 FITS read', feature('F08'), () => {
  test('reads HorseHead.fits and converts it to VICAR and TIFF', async ({}, testInfo) => {
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
