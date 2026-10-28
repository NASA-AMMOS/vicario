// Magellan products: a public F-BIDR (orbit 378, FILE_13 oblique sinusoidal
// image) from the PDS Geosciences Node. The resampled format read by
// MgnResampImageReader has no public sample and is not tested.
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { about, feature, issue } from '../support/features';
import { expectGolden } from '../support/goldens';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

test.describe('Magellan products', feature('magellan', 'full'), () => {
  test('F-BIDR reader decodes the orbit 378 image strip', about(
    `Reads a public Magellan F-BIDR (orbit 378, file 13) with the F-BIDR ImageIO reader, once through a plain \`FileImageInputStream\` and once through the stream ImageIO picks by default. Passes when both decode to a 1092 x 14672 BYTE image that is not blank and matches the recorded golden hash.`,
    '@mission-data', '@regression',
  ), async ({}, testInfo) => {
    issue('REVIEW-18', 'fixed: only a javax FileImageInputStream counted as random access, so the default stream was refused');
    asset('magellan-fbidr-lbl');
    const p = await probe(testInfo, asset('magellan-fbidr'), { fileStream: true });
    expect([p.width, p.height, p.bands, p.dataType]).toEqual([1092, 14672, 1, 'BYTE']);
    expect(p.std!, 'not blank').toBeGreaterThan(1);
    expectGolden('magellan-fbidr-0378', p);
    expectSamePixels(await probe(testInfo, asset('magellan-fbidr'), { preview: false }), p);
  });

  test('jConvertIIO converts the F-BIDR to VICAR', about(
    `Converts the same F-BIDR to VICAR with jConvertIIO. Passes when the output decodes to the golden pixels (1092 x 14672 BYTE, all 14672 lines).`,
    '@mission-data', '@regression', '@lossless',
  ), async ({}, testInfo) => {
    issue('REVIEW-18', 'fixed: the F-BIDR reader refused jConvertIIO\'s seekable FileChannelImageInputStream '
      + '("must be read from a stream allowing random access") because VicarInputFile only treated a javax '
      + 'FileImageInputStream as random access');
    const r = await convert(testInfo, asset('magellan-fbidr'), 'fbidr.vic', { format: 'vicar' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.height).toBe(14672);
    expectGolden('magellan-fbidr-0378', p);
  });
});
