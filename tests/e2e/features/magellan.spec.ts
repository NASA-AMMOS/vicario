// Magellan products: a public F-BIDR (orbit 378, FILE_13 oblique sinusoidal
// image) from the PDS Geosciences Node. The resampled format read by
// MgnResampImageReader has no public sample and is not tested.
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { about, feature, needsReview } from '../support/features';
import { expectGolden } from '../support/goldens';
import { convert, expectConverted, probe } from '../support/run';

test.describe('Magellan products', feature('magellan', 'full'), () => {
  test('F-BIDR reader decodes the orbit 378 image strip', about(
    `Reads a public Magellan F-BIDR (orbit 378, file 13) with the F-BIDR ImageIO reader. Passes when it decodes to a 1092 x 14672 BYTE image that is not blank and matches the recorded golden hash.`,
    '@mission-data',
  ), async ({}, testInfo) => {
    asset('magellan-fbidr-lbl');
    // plain FileImageInputStream: see the known issue in the next test
    const p = await probe(testInfo, asset('magellan-fbidr'), { fileStream: true });
    expect([p.width, p.height, p.bands, p.dataType]).toEqual([1092, 14672, 1, 'BYTE']);
    expect(p.std!, 'not blank').toBeGreaterThan(1);
    expectGolden('magellan-fbidr-0378', p);
  });

  test('jConvertIIO converts the F-BIDR to VICAR', about(
    `Converts the same F-BIDR to VICAR with jConvertIIO. Passes when the output decodes with all 14672 lines.`,
    '@mission-data',
  ), async ({}, testInfo) => {
    needsReview('REVIEW-18', 'F-BIDR read fails in jConvertIIO ("must be read from a stream allowing random access"): '
      + 'VicarInputFile only treats javax FileImageInputStream as random access, but the FAT jar\'s ImageIO returns '
      + 'imageio-ext FileImageInputStreamExtImpl; exits 0 with no output');
    const r = await convert(testInfo, asset('magellan-fbidr'), 'fbidr.vic', { format: 'vicar' });
    expectConverted(r);
    expect((await probe(testInfo, r.out)).height).toBe(14672);
  });
});
