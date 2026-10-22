// PDS4 images: a Mars 2020 Navcam product read through its PDS4 XML
// label must decode to the same pixels as the attached VICAR/ODL label.
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { asset } from '../support/data';
import { feature } from '../support/features';
import { expectGolden } from '../support/goldens';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

test.describe('PDS4 images', feature('pds4-images'), () => {
  test('PDS4 label and attached label decode the same pixels', async ({}, testInfo) => {
    const img = await probe(testInfo, asset('m2020-navcam-thumb-img'));
    const xml = await probe(testInfo, asset('m2020-navcam-thumb-xml'));
    expect(xml.format).toBe('pds4');
    expectSamePixels(xml, img);
    expectGolden('m2020-navcam-thumb', xml);
  });

  test('jConvertIIO converts a PDS4 label to TIFF and VICAR', async ({}, testInfo) => {
    const label = asset('m2020-navcam-thumb-xml');
    asset('m2020-navcam-thumb-img');
    const src = await probe(testInfo, label);
    for (const format of ['tif', 'vicar']) {
      const r = await convert(testInfo, label, `m2020.${format}`, { format });
      expectConverted(r);
      expectSamePixels(await probe(testInfo, r.out), src);
    }
  });

  test('a relative PDS4 label path resolves its data file next to the label', async ({}, testInfo) => {
    const label = asset('m2020-navcam-thumb-xml');
    asset('m2020-navcam-thumb-img');
    const cwd = path.dirname(path.dirname(label));
    const rel = path.relative(cwd, label);
    const r = await convert(testInfo, rel, 'm2020_rel.tif', { format: 'tif' }, { cwd });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, label));
  });
});

test.describe('PDS4 images (full-size products)', feature('pds4-images', 'full'), () => {
  test('Mars 2020 Navcam full EDR via PDS4 label', async ({}, testInfo) => {
    const label = asset('m2020-navcam-edr-xml');
    const img = await probe(testInfo, asset('m2020-navcam-edr-img'));
    const xml = await probe(testInfo, label);
    expectSamePixels(xml, img);
    expectGolden('m2020-navcam-edr', xml);
    const r = await convert(testInfo, label, 'm2020_full.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), xml);
  });
});
