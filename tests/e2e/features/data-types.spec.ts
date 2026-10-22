// Data type conversion: OFORM with and without RESCALE, CLAMP, and
// float data to 8-bit display formats (IDS-7610).
import { expect, test } from '@playwright/test';
import { asset } from '../support/data';
import { synthetic } from '../support/env';
import { feature, issue, knownFailure } from '../support/features';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

test.describe('Data type conversion', feature('data-types'), () => {
  test('REAL to PNG with OFORM=BYTE is stretched, not blank', async ({}, testInfo) => {
    issue('IDS-7610', 'float VICAR to PNG came out blank');
    const r = await convert(testInfo, synthetic('gen_real_100x100.vic'), 'real.png', { format: 'png', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('BYTE');
    expect(p.max!, 'stretched to the byte range').toBeGreaterThanOrEqual(250);
    expect(p.std!, 'not blank').toBeGreaterThan(10);
  });

  test('REAL to BYTE with RESCALE=false keeps the values (0..74)', async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_real_100x100.vic'), 'real_norescale.vic',
      { format: 'vicar', OFORM: 'BYTE', RESCALE: 'false' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max]).toEqual(['BYTE', 0, 74]);
  });

  test('HALF to BYTE with the default RESCALE fills the byte range', async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'half_byte.vic', { format: 'vicar', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('BYTE');
    expect(p.max!).toBeGreaterThanOrEqual(250);
  });

  test('BYTE to HALF with RESCALE=false is exact', async ({}, testInfo) => {
    const src = synthetic('gen_byte_bsq.vic');
    const r = await convert(testInfo, src, 'byte_half.vic', { format: 'vicar', OFORM: 'HALF', RESCALE: 'false' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.dataType).toBe('SHORT');
    expectSamePixels(p, await probe(testInfo, src));
  });

  test('BYTE to REAL with RESCALE=false keeps the values', async ({}, testInfo) => {
    const src = await probe(testInfo, synthetic('gen_byte_bsq.vic'));
    const r = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'byte_real.vic',
      { format: 'vicar', OFORM: 'REAL', RESCALE: 'false' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.dataType, p.min, p.max, p.mean]).toEqual(['FLOAT', src.min, src.max, src.mean]);
  });

  test('BYTE to HALF with the default RESCALE keeps the image contrast', async ({}, testInfo) => {
    knownFailure('UNFILED-6', 'OFORM=HALF with default RESCALE saturates byte input (mean 254.5, std 9.8; source std 56)');
    const src = await probe(testInfo, synthetic('gen_byte_bsq.vic'));
    const r = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'byte_half_rescale.vic', { format: 'vicar', OFORM: 'HALF' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect(p.std! / (p.max! - p.min!), 'relative contrast').toBeGreaterThan(0.5 * src.std! / (src.max! - src.min!));
  });

  test('CLAMP=(10,100) limits the output range', async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_half_bsq.vic'), 'clamp.vic', { format: 'vicar', CLAMP: '(10,100)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.min, p.max]).toEqual([10, 100]);
  });
});

test.describe('Data type conversion (mission products)', feature('data-types', 'full'), () => {
  test('12-bit MER EDR to an 8-bit PNG browse image', async ({}, testInfo) => {
    const r = await convert(testInfo, asset('mer1-navcam-edr'), 'mer_browse.png', { format: 'png', OFORM: 'BYTE' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height, p.dataType]).toEqual([512, 512, 'BYTE']);
    expect(p.std!).toBeGreaterThan(10);
  });
});
