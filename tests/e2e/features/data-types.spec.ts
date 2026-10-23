// Data type conversion: OFORM with and without RESCALE, CLAMP, and
// float data to 8-bit display formats (IDS-7610).
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { synthetic } from '../support/env';
import { about, feature, issue, needsReview } from '../support/features';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

test.describe('Data type conversion', feature('data-types'), () => {
  test('REAL to PNG with OFORM=BYTE is stretched, not blank', about(
    `Converts the legacy REAL 100 x 100 image to PNG with \`OFORM=BYTE\`. Passes when the PNG is BYTE, stretched to the byte range (maximum at least 250) and not blank (standard deviation over 10).`,
    '@nominal', '@legacy', '@regression',
  ), async ({}, testInfo) => {
    issue('IDS-7610', 'float VICAR to PNG came out blank');
    const r = await convert(testInfo, synthetic('gen_real_100x100.vic'), 'real.png', { format: 'png', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('BYTE');
    expect(p.max!, 'stretched to the byte range').toBeGreaterThanOrEqual(250);
    expect(p.std!, 'not blank').toBeGreaterThan(10);
  });

  test('REAL to BYTE with RESCALE=false keeps the values (0..74)', about(
    `Converts the REAL image (values 0 to 74) to BYTE with \`RESCALE=false\`. Passes when the output values are exactly 0 to 74.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_real_100x100.vic'), 'real_norescale.vic',
      { format: 'vicar', OFORM: 'BYTE', RESCALE: 'false' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max]).toEqual(['BYTE', 0, 74]);
  });

  test('HALF to BYTE with the default RESCALE fills the byte range', about(
    `Converts the synthetic HALF image to BYTE with the default rescaling. Passes when the output is BYTE and fills the byte range (maximum at least 250).`,
    '@nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'half_byte.vic', { format: 'vicar', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('BYTE');
    expect(p.max!).toBeGreaterThanOrEqual(250);
  });

  test('BYTE to HALF with RESCALE=false is exact', about(
    `Converts the synthetic BYTE image to HALF with \`RESCALE=false\`. Passes when the output is 16-bit with pixels equal to the input.`,
    '@nominal', '@lossless',
  ), async ({}, testInfo) => {
    const src = synthetic('gen_byte_bsq.vic');
    const r = await convert(testInfo, src, 'byte_half.vic', { format: 'vicar', OFORM: 'HALF', RESCALE: 'false' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('SHORT');
    expectSamePixels(p, await probe(testInfo, src));
  });

  test('BYTE to REAL with RESCALE=false keeps the values', about(
    `Converts the synthetic BYTE image to REAL with \`RESCALE=false\`. Passes when the output is floating point with the input's minimum, maximum and mean.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const src = await probe(testInfo, synthetic('gen_byte_bsq.vic'));
    const r = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'byte_real.vic',
      { format: 'vicar', OFORM: 'REAL', RESCALE: 'false' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max, p.mean]).toEqual(['FLOAT', src.min, src.max, src.mean]);
  });

  test('BYTE to HALF with the default RESCALE keeps the image contrast', about(
    `Converts the synthetic BYTE image to HALF with the default rescaling. Passes when the output keeps at least half the relative contrast (standard deviation over range) of the input.`,
    '@nominal',
  ), async ({}, testInfo) => {
    needsReview('REVIEW-6', 'OFORM=HALF with default RESCALE saturates byte input (mean 254.5, std 9.8; source std 56)');
    const src = await probe(testInfo, synthetic('gen_byte_bsq.vic'));
    const r = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'byte_half_rescale.vic', { format: 'vicar', OFORM: 'HALF' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.std! / (p.max! - p.min!), 'relative contrast').toBeGreaterThan(0.5 * src.std! / (src.max! - src.min!));
  });

  test('CLAMP=(10,100) limits the output range', about(
    `Converts the synthetic HALF image with \`CLAMP=(10,100)\`. Passes when the output values span exactly 10 to 100.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'clamp.vic', { format: 'vicar', CLAMP: '(10,100)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.min, p.max]).toEqual([10, 100]);
  });
});

test.describe('Data type conversion (mission products)', feature('data-types', 'full'), () => {
  test('12-bit MER EDR to an 8-bit PNG browse image', about(
    `Converts a public 12-bit MER Navcam EDR to an 8-bit PNG browse image with \`OFORM=BYTE\`. Passes when the PNG is a 512 x 512 BYTE image that is not blank.`,
    '@mission-data', '@nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, asset('mer1-navcam-edr'), 'mer_browse.png', { format: 'png', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height, p.dataType]).toEqual([512, 512, 'BYTE']);
    expect(p.std!).toBeGreaterThan(10);
  });
});
