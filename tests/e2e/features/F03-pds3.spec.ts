// F03 PDS3 read/write: writing PDS3 labels from VICAR, reading public PDS3
// products (attached PDS3+VICAR labels, detached .LBL), PDS-to-PDS conversion.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { asset } from '../support/data';
import { XSL_DIR, synthetic } from '../support/env';
import { feature, issue, knownFailure } from '../support/features';
import { expectGolden } from '../support/goldens';
import { expectValidPds3Label, pdsLabel } from '../support/labels';
import { convert, expectConverted, expectSamePixels, probe, tryProbe } from '../support/run';

test.describe('F03 PDS3 read/write', feature('F03'), () => {
  const input = synthetic('gen_byte_bsq.vic');
  const dims = { lines: 64, samples: 48, bands: 3 };

  test('VICAR to PDS3 writes a valid label and keeps pixels', async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'out.pds', { format: 'pds' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('EMBED_VICAR_LABEL=true embeds the VICAR label', async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'embedded.pds', { format: 'pds', EMBED_VICAR_LABEL: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expect(readFileSync(r.out, 'latin1'), 'embedded VICAR label').toContain('LBLSIZE=');
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('PDS_FILENAME_IN_LABEL=true puts the output file name in the label', async ({}, testInfo) => {
    knownFailure('UNFILED-9', 'the documented keyword PDS_FILENAME_IN_LABEL is parsed as PDS_FILENAME, so it is ignored');
    const r = await convert(testInfo, input, 'named.pds', { format: 'pds', PDS_FILENAME_IN_LABEL: 'true' });
    expectConverted(r);
    expect(readFileSync(r.out, 'latin1')).toContain('named.pds');
  });

  test('PDS_LABEL_TYPE=ODL3 writes an ODL3 label', async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'odl3.pds', { format: 'pds', PDS_LABEL_TYPE: 'ODL3' });
    expectConverted(r);
    expect(expectValidPds3Label(r.out, dims)).toMatch(/^ODL_VERSION_ID\s*=\s*ODL3/);
  });

  test('reads an MSL Navcam EDR thumbnail (attached PDS3 + VICAR labels)', async ({}, testInfo) => {
    const img = asset('msl-navcam-thumb-img');
    const p = await probe(testInfo, img);
    expectGolden('msl-navcam-thumb', p);
    const r = await convert(testInfo, img, 'msl_thumb.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), p);
  });

  test('reads an MSL Navcam EDR through its detached .LBL', async ({}, testInfo) => {
    knownFailure('UNFILED-7', 'PDSImageReader fails on the detached MSL label: "Error reading header: Negative size"');
    asset('msl-navcam-thumb-img'); // the label points at this file
    const r = await convert(testInfo, asset('msl-navcam-thumb-lbl'), 'msl_lbl.vic', { format: 'vicar' });
    expectConverted(r);
  });

  test('PDS-labelled input to FORMAT=pds with the default stylesheet', async ({}, testInfo) => {
    knownFailure('IDS-8497', 'PDSToPDSImageTranscoder default stylesheet name is empty: NullPointerException, empty .pds '
      + '(likely root cause of the empty normal.pds / mer_file.pds outputs)');
    const r = await convert(testInfo, asset('msl-navcam-thumb-img'), 'msl_default.pds', { format: 'pds' });
    expectConverted(r);
  });

  test('PDS-labelled input to FORMAT=pds with an explicit copy stylesheet', async ({}, testInfo) => {
    issue('IDS-8497', 'workaround: pass XSL=CopyEverything.xsl');
    const img = asset('msl-navcam-thumb-img');
    const r = await convert(testInfo, img, 'msl_copy.pds',
      { format: 'pds', XSL: path.join(XSL_DIR, 'CopyEverything.xsl') });
    expectConverted(r);
    expect(pdsLabel(r.out)).toMatch(/\^IMAGE\s*=/);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });
});

test.describe('F03 PDS3 read/write: full-size products', feature('F03', 'full'), () => {
  test('MSL Navcam full EDR reads and round-trips through VICAR', async ({}, testInfo) => {
    const img = asset('msl-navcam-edr-img');
    asset('msl-navcam-edr-lbl');
    const p = await probe(testInfo, img);
    expectGolden('msl-navcam-edr', p);
    const r = await convert(testInfo, img, 'msl.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), p);
  });

  test('MER Opportunity Navcam EDR reads (stand-in for the legacy mer_file.vic)', async ({}, testInfo) => {
    expectGolden('mer1-navcam-edr', await probe(testInfo, asset('mer1-navcam-edr')));
  });

  test('Cassini ISS: VICAR image and its detached PDS3 label decode identically', async ({}, testInfo) => {
    const img = await probe(testInfo, asset('cassini-iss-img'));
    expectGolden('cassini-iss', img);
    const viaLabel = await tryProbe(testInfo, asset('cassini-iss-lbl'));
    expect(viaLabel, 'detached label readable').not.toBeNull();
    expectSamePixels(viaLabel!, img);
  });
});
