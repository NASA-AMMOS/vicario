// Data type conversion: OFORM with and without RESCALE, CLAMP, and
// float data to 8-bit display formats (IDS-7610).
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { synthetic } from '../support/env';
import { about, feature, issue } from '../support/features';
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

  test('BYTE to HALF with the default RESCALE keeps the values', about(
    `Converts the synthetic BYTE image (values 0 to 217) to HALF with the default rescaling. A widening conversion is not stretched unless asked for. Passes when the output is 16-bit with pixels equal to the input.`,
    '@nominal', '@regression', '@lossless',
  ), async ({}, testInfo) => {
    issue('REVIEW-6', 'fixed: the default rescale ran in the source type, so BYTE to HALF saturated to 3 distinct values');
    const src = synthetic('gen_byte_bsq.vic');
    const r = await convert(testInfo, src, 'byte_half_rescale.vic', { format: 'vicar', OFORM: 'HALF' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('SHORT');
    expectSamePixels(p, await probe(testInfo, src));
  });

  test('BYTE to REAL with the default RESCALE keeps the values', about(
    `Converts the synthetic BYTE image to REAL with the default rescaling. Passes when the output is floating point with the input's minimum, maximum and mean (no stretch to the float range, no saturation).`,
    '@nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('REVIEW-6', 'fixed: BYTE to REAL with the default rescale saturated to 2 distinct values');
    const src = await probe(testInfo, synthetic('gen_byte_bsq.vic'));
    const r = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'byte_real_rescale.vic', { format: 'vicar', OFORM: 'REAL' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max, p.mean]).toEqual(['FLOAT', src.min, src.max, src.mean]);
  });

  test('HALF to HALF with the default RESCALE keeps the values', about(
    `Converts the synthetic HALF image (values 0 to 217) with \`OFORM=HALF\`, its own data type. RESCALE applies only when OFORM changes to a narrower type. Passes when the output pixels equal the input.`,
    '@nominal', '@regression', '@lossless',
  ), async ({}, testInfo) => {
    issue('REVIEW-6', 'fixed: the same data type was stretched to the full 16-bit range');
    const src = synthetic('gen_half_bsq.vic');
    const r = await convert(testInfo, src, 'half_half.vic', { format: 'vicar', OFORM: 'HALF' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('SHORT');
    expectSamePixels(p, await probe(testInfo, src));
  });

  test('BYTE to HALF with RESCALE_CONSTANT and RESCALE_OFFSET is not clipped to the byte range', about(
    `Converts the synthetic BYTE image (0 to 217) to HALF with \`RESCALE_CONSTANT=10 RESCALE_OFFSET=3\`. The rescale must run in the 16-bit output type. Passes when the output spans exactly 3 to 2173 (217 x 10 + 3, past the byte range) with mean equal to the input mean x 10 + 3.`,
    '@nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('REVIEW-6', 'fixed: an explicit rescale on a widening OFORM was clipped to the source (byte) range');
    const src = await probe(testInfo, synthetic('gen_byte_bsq.vic'));
    const r = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'byte_half_const.vic',
      { format: 'vicar', OFORM: 'HALF', RESCALE_CONSTANT: '10', RESCALE_OFFSET: '3' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max]).toEqual(['SHORT', 3, 2173]);
    expect(p.mean!).toBeCloseTo(src.mean! * 10 + 3, 1);
  });

  test('HALF to BYTE with VALID_MINIMUM and VALID_MAXIMUM stretches that range to 0..255', about(
    `Converts the synthetic HALF image (0 to 217) to BYTE with \`VALID_MINIMUM=0 VALID_MAXIMUM=108\`. Passes when the output is BYTE, spans exactly 0 to 255, and values above 108 are clipped to 255.`,
    '@off-nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'half_byte_valid.vic',
      { format: 'vicar', OFORM: 'BYTE', VALID_MINIMUM: '0', VALID_MAXIMUM: '108' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max]).toEqual(['BYTE', 0, 255]);
    expect(p.mean!, 'the upper half of the input range is clipped to 255').toBeGreaterThan(160);
  });

  test('HALF to BYTE with the default RESCALE reaches 255', about(
    `Converts the synthetic HALF image (0 to 217) to BYTE with the default rescaling. Passes when the output spans exactly 0 to 255 (the full unsigned byte range, not 0 to 254).`,
    '@nominal', '@regression',
  ), async ({}, testInfo) => {
    issue('NEW-cli-1', 'fixed: the BYTE rescale ceiling was Byte.MAX_VALUE * 2 = 254, not 255');
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'half_byte_255.vic', { format: 'vicar', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max]).toEqual(['BYTE', 0, 255]);
  });

  test('BYTE to BYTE with OFORM=BYTE keeps the values', about(
    `Converts the synthetic gray BYTE image (values 0 to 157) with \`OFORM=BYTE\`, its own data type. Passes when the output pixels equal the input (no stretch).`,
    '@nominal', '@regression', '@lossless',
  ), async ({}, testInfo) => {
    issue('NEW-cli-1', 'fixed: OFORM=BYTE on BYTE input stretched the data to 0..254');
    const src = synthetic('gen_byte_gray.vic');
    const r = await convert(testInfo, src, 'byte_byte.vic', { format: 'vicar', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('BYTE');
    expectSamePixels(p, await probe(testInfo, src));
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
