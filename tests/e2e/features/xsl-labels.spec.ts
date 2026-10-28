// PDS label transcoding (XSL): the bundled VicarToPDS stylesheets, XSL=- (the
// default stylesheet in the jar) and the legacy tstjConvertIIO.csh recipes.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { XSL_DIR, synthetic } from '../support/env';
import { about, feature, issue } from '../support/features';
import { expectValidPds3Label } from '../support/labels';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';

const VICAR_TO_PDS = readdirSync(XSL_DIR).filter((f) => /^VicarToPDS.*\.xsl$/.test(f)).sort();

test.describe('PDS label transcoding (XSL)', feature('xsl-labels'), () => {
  const input = synthetic('gen_byte_bsq.vic');
  const dims = { lines: 64, samples: 48, bands: 3 };

  test('XSL=- uses the default stylesheet from the jar', about(
    `Converts the synthetic image to PDS3 with \`XSL=-\` (the default stylesheet in the jar) and \`EMBED_VICAR_LABEL=true\`. Passes when the label is valid and the pixels are unchanged.`,
    '@nominal', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'default_xsl.pds', { format: 'pds', XSL: '-', EMBED_VICAR_LABEL: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('legacy recipe: XML=false, VicarToPDSmer1.xsl, EMBED_VICAR_LABEL=true', about(
    `The legacy normal.pds recipe from tstjConvertIIO.csh (\`XML=false\`, \`XSL=VicarToPDSmer1.xsl\`, \`EMBED_VICAR_LABEL=true\`) on the synthetic image. Passes when the PDS3 label is valid.`,
    '@legacy', '@nominal', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'normal.pds', {
      format: 'pds', xml: 'false', xsl: path.join(XSL_DIR, 'VicarToPDSmer1.xsl'), embed_vicar_label: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
  });

  test(`all ${VICAR_TO_PDS.length} bundled VicarToPDS stylesheets produce valid labels`, about(
    `Converts the synthetic image to PDS3 with each of the ${VICAR_TO_PDS.length} VicarToPDS stylesheets in the jar, one step per stylesheet. Passes when every label is valid and every output has the input pixels.`,
    '@nominal', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
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
  test('legacy normal.pds recipe on a public MER EDR (via VICAR)', about(
    `The legacy normal.pds recipe on real data: converts a public MER EDR to VICAR, then to PDS3 with \`VicarToPDSmer1.xsl\`. Passes when the label is valid for a 512 x 512 image and the pixels match the original EDR.`,
    '@legacy', '@mission-data', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const mer = asset('mer1-navcam-edr');
    const vic = await convert(testInfo, mer, 'mer.vic', { format: 'vicar' });
    expectConverted(vic);
    const r = await convert(testInfo, vic.out, 'normal.pds', {
      format: 'pds', xml: 'false', xsl: path.join(XSL_DIR, 'VicarToPDSmer1.xsl'), embed_vicar_label: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, { lines: 512, samples: 512, bands: 1 });
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, mer));
  });

  test('VICAR-to-PDS stylesheet on a PDS-labelled MER EDR', about(
    `Applies a VICAR-to-PDS stylesheet directly to a PDS-labelled MER EDR (the legacy \`mer_file.vic\` case in runAll.csh). Passes when the conversion succeeds, copying the input label with a warning; before the IDS-8497 fix it crashed.`,
    '@legacy', '@mission-data', '@off-nominal', '@regression', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    issue('IDS-8497', 'fixed: a VICAR-to-PDS stylesheet on PDS-labelled input (the legacy mer_file.vic case) crashed; '
      + 'the input label is now copied with a warning');
    const r = await convert(testInfo, asset('mer1-navcam-edr'), 'mer_direct.pds', {
      format: 'pds', xsl: path.join(XSL_DIR, 'VicarToPDSmer1.xsl'), embed_vicar_label: 'true' });
    expectConverted(r);
  });
});
