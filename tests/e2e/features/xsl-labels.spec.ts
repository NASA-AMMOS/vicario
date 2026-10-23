// PDS label transcoding (XSL): the bundled VicarToPDS stylesheets, XSL=- (the
// default stylesheet in the jar) and the legacy tstjConvertIIO.csh recipes.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { asset } from '../support/data';
import { XSL_DIR, synthetic } from '../support/env';
import { feature, issue } from '../support/features';
import { expectValidPds3Label } from '../support/labels';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

const VICAR_TO_PDS = readdirSync(XSL_DIR).filter((f) => /^VicarToPDS.*\.xsl$/.test(f)).sort();

test.describe('PDS label transcoding (XSL)', feature('xsl-labels'), () => {
  const input = synthetic('gen_byte_bsq.vic');
  const dims = { lines: 64, samples: 48, bands: 3 };

  test('XSL=- uses the default stylesheet from the jar', async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'default_xsl.pds', { format: 'pds', XSL: '-', EMBED_VICAR_LABEL: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('legacy recipe: XML=false, VicarToPDSmer1.xsl, EMBED_VICAR_LABEL=true', async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'normal.pds', {
      format: 'pds', xml: 'false', xsl: path.join(XSL_DIR, 'VicarToPDSmer1.xsl'), embed_vicar_label: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
  });

  test(`all ${VICAR_TO_PDS.length} bundled VicarToPDS stylesheets produce valid labels`, async ({}, testInfo) => {
    const src = await probe(testInfo, input, { preview: false });
    for (const xsl of VICAR_TO_PDS) {
      await test.step(xsl, async () => {
        const r = await convert(testInfo, input, xsl.replace('.xsl', '.pds'), { format: 'pds', XSL: path.join(XSL_DIR, xsl) });
        expectConverted(r);
        expectValidPds3Label(r.out, dims);
        expectSamePixels(await probe(testInfo, r.out, { preview: false }), src);
      });
    }
  });
});

test.describe('PDS label transcoding (XSL) (mission products)', feature('xsl-labels', 'full'), () => {
  test('legacy normal.pds recipe on a public MER EDR (via VICAR)', async ({}, testInfo) => {
    const mer = asset('mer1-navcam-edr');
    const vic = await convert(testInfo, mer, 'mer.vic', { format: 'vicar' });
    expectConverted(vic);
    const r = await convert(testInfo, vic.out, 'normal.pds', {
      format: 'pds', xml: 'false', xsl: path.join(XSL_DIR, 'VicarToPDSmer1.xsl'), embed_vicar_label: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, { lines: 512, samples: 512, bands: 1 });
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, mer));
  });

  test('VICAR-to-PDS stylesheet on a PDS-labelled MER EDR', async ({}, testInfo) => {
    issue('IDS-8497', 'fixed: a VICAR-to-PDS stylesheet on PDS-labelled input (the legacy mer_file.vic case) crashed; '
      + 'the input label is now copied with a warning');
    const r = await convert(testInfo, asset('mer1-navcam-edr'), 'mer_direct.pds', {
      format: 'pds', xsl: path.join(XSL_DIR, 'VicarToPDSmer1.xsl'), embed_vicar_label: 'true' });
    expectConverted(r);
  });
});
