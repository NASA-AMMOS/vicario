// VICAR image read/write: data types x organizations, byte orders, degenerate
// shapes, truncated input. Synthetic images come from SyntheticGen (global setup).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { asset } from '../support/data';
import { synthetic } from '../support/env';
import { feature, knownFailure } from '../support/features';
import { convert, expectConverted, expectSamePixels, probe, tryProbe } from '../support/run';

const TYPES = { byte: 'BYTE', half: 'SHORT', full: 'INT', real: 'FLOAT', doub: 'DOUBLE' } as const;
const VICAR_FORMAT = { byte: 'BYTE', half: 'HALF', full: 'FULL', real: 'REAL', doub: 'DOUB' } as const;
const ORGS = ['bsq', 'bil', 'bip'] as const;

test.describe('VICAR image read/write', feature('vicar-io'), () => {
  for (const [type, dataType] of Object.entries(TYPES) as [keyof typeof TYPES, string][]) {
    test(`${type}: BSQ, BIL and BIP decode to the same pixels`, async ({}, testInfo) => {
      const [bsq, bil, bip] = await Promise.all(ORGS.map((org) => probe(testInfo, synthetic(`gen_${type}_${org}.vic`))));
      expect(bsq.dataType).toBe(dataType);
      expect([bsq.width, bsq.height, bsq.bands]).toEqual([48, 64, 3]);
      expectSamePixels(bil, bsq);
      expectSamePixels(bip, bsq);
    });

    for (const org of ORGS) {
      test(`${type}/${org}: VICAR to VICAR round trip keeps type and pixels`, async ({}, testInfo) => {
        const src = synthetic(`gen_${type}_${org}.vic`);
        const r = await convert(testInfo, src, `${type}_${org}.vic`, { format: 'vicar' });
        expectConverted(r);
        expect(readFileSync(r.out, 'latin1').slice(0, 400)).toContain(`FORMAT='${VICAR_FORMAT[type]}'`);
        expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, src));
      });
    }
  }

  // legacy tstjConvertIIO.csh: 1sample1024lines / 1024samples1line / real 100x100
  for (const name of ['gen_byte_ns1_nl1024.vic', 'gen_byte_ns1024_nl1.vic', 'gen_real_100x100.vic']) {
    test(`degenerate shape ${name} survives VICAR and PDS round trips`, async ({}, testInfo) => {
      const src = await probe(testInfo, synthetic(name));
      for (const format of ['vicar', 'pds']) {
        const r = await convert(testInfo, synthetic(name), name.replace('.vic', `.${format}`), { format });
        expectConverted(r);
        expectSamePixels(await probe(testInfo, r.out), src);
      }
    });
  }

  // GDAL fixtures written on x86-64 Linux: INTFMT='LOW', REALFMT='RIEEE'.
  // Expected values come from the files themselves: 1..24 (HALF) and 1.0, 1.5, ... (REAL).
  for (const id of ['gdal-vicar-int16', 'gdal-vicar-float32-bsq']) {
    test(`jConvertIIO decodes little-endian ${id.replace('gdal-vicar-', '')} (INTFMT/REALFMT LOW)`, async ({}, testInfo) => {
      const r = await convert(testInfo, asset(id), `${id}.tif`, { format: 'tif' });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect(p.min).toBe(1);
      expect(p.max).toBe(id.includes('int16') ? 24 : 122.5);
    });
  }

  test('little-endian float32 BSQ, BIL and BIP agree after conversion', async ({}, testInfo) => {
    const outs = [];
    for (const id of ['gdal-vicar-float32-bsq', 'gdal-vicar-float32-bil', 'gdal-vicar-float32-bip']) {
      const r = await convert(testInfo, asset(id), `${id}.tif`, { format: 'tif' });
      expectConverted(r);
      outs.push(await probe(testInfo, r.out));
    }
    expectSamePixels(outs[1], outs[0]);
    expectSamePixels(outs[2], outs[0]);
  });

  test('ImageIO API decodes little-endian HALF the same as BYTE 1..24', async ({}, testInfo) => {
    knownFailure('UNFILED-1', 'VicarImageReader via the ImageIO API returns byte-swapped samples for INTFMT=LOW files '
      + '(256, 512, ... instead of 1, 2, ...); jConvertIIO output is correct');
    const half = await probe(testInfo, asset('gdal-vicar-int16'));
    const byte = await probe(testInfo, asset('gdal-vicar-byte'));
    expect(half.pixelSha256).toBe(byte.pixelSha256);
  });

  for (const id of ['gdal-vicar-bigendian-int16', 'gdal-vicar-bigendian-float32', 'gdal-vicar-vax-float32']) {
    test(`reads ${id.replace('gdal-vicar-', '')} (system label with DAT_TIM/BINC)`, async ({}, testInfo) => {
      knownFailure('UNFILED-2', 'VICAR reader rejects GDAL-written system labels: "DAT_TIM may only go in history label"');
      expect(await tryProbe(testInfo, asset(id))).not.toBeNull();
    });
  }

  test('jConvertIIO decodes little-endian DOUB (float64) and FULL (int32) fixtures', async ({}, testInfo) => {
    for (const id of ['gdal-vicar-float64', 'gdal-vicar-int32']) {
      const r = await convert(testInfo, asset(id), `${id}.vic`, { format: 'vicar' });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect([p.min, p.max], `${id} values 1..24`).toEqual([1, 24]);
    }
  });

  test('binary line prefix fixture decodes to its 1x1 image', async ({}, testInfo) => {
    const p = await probe(testInfo, asset('gdal-vicar-binary-prefix'));
    expect([p.width, p.height, p.bands, p.dataType]).toEqual([1, 1, 1, 'BYTE']);
  });

  test('truncated VICAR file fails with a non-zero exit', async ({}, testInfo) => {
    knownFailure('UNFILED-5', 'jConvertIIO exits 0 after a read failure (NullPointerException, no output written)');
    const r = await convert(testInfo, asset('gdal-vicar-truncated'), 'truncated.vic', { format: 'vicar' });
    expect(existsSync(r.out) && statSync(r.out).size > 0).toBe(false);
    expect(r.exitCode).not.toBe(0);
  });
});
