// PDS3 products: writing PDS3 labels from VICAR, reading public PDS3
// products (attached PDS3+VICAR labels, detached .LBL), PDS-to-PDS conversion.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { XSL_DIR, synthetic } from '../support/env';
import { about, feature, issue, needsReview } from '../support/features';
import { expectGolden } from '../support/goldens';
import { expectValidPds3Label, pdsLabel } from '../support/labels';
import { convert, expectConverted, expectSamePixels, probe, tryProbe } from '../support/run';

test.describe('PDS3 products', feature('pds3'), () => {
  const input = synthetic('gen_byte_bsq.vic');
  const dims = { lines: 64, samples: 48, bands: 3 };

  test('VICAR to PDS3 writes a valid label and keeps pixels', about(
    `Converts the synthetic 3-band BYTE image to PDS3. Passes when the label is valid (PDS3 version, \`^IMAGE\` pointer, an IMAGE object with the right LINES, LINE_SAMPLES and BANDS, no empty \`""\` values) and the pixels are unchanged.`,
    '@nominal', '@lossless',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'out.pds', { format: 'pds' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('EMBED_VICAR_LABEL=true embeds the VICAR label', about(
    `Converts the synthetic image to PDS3 with \`EMBED_VICAR_LABEL=true\`. Passes when the PDS3 label is valid, the VICAR label (\`LBLSIZE=\`) is embedded in the file, and the pixels are unchanged.`,
    '@nominal', '@lossless',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'embedded.pds', { format: 'pds', EMBED_VICAR_LABEL: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expect(readFileSync(r.out, 'latin1'), 'embedded VICAR label').toContain('LBLSIZE=');
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('PDS_FILENAME_IN_LABEL=true puts the output file name in the label', about(
    `Converts the synthetic image to PDS3 with \`PDS_FILENAME_IN_LABEL=true\`. Passes when the output file name appears in the label.`,
    '@nominal',
  ), async ({}, testInfo) => {
    needsReview('REVIEW-9', 'the documented keyword PDS_FILENAME_IN_LABEL is parsed as PDS_FILENAME, so it is ignored');
    const r = await convert(testInfo, input, 'named.pds', { format: 'pds', PDS_FILENAME_IN_LABEL: 'true' });
    expectConverted(r);
    expect(readFileSync(r.out, 'latin1')).toContain('named.pds');
  });

  test('PDS_LABEL_TYPE=ODL3 writes an ODL3 label', about(
    `Converts the synthetic image to PDS3 with \`PDS_LABEL_TYPE=ODL3\`. Passes when the label starts with \`ODL_VERSION_ID = ODL3\` and is otherwise valid.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'odl3.pds', { format: 'pds', PDS_LABEL_TYPE: 'ODL3' });
    expectConverted(r);
    expect(expectValidPds3Label(r.out, dims)).toMatch(/^ODL_VERSION_ID\s*=\s*ODL3/);
  });

  test('reads an MSL Navcam EDR thumbnail (attached PDS3 + VICAR labels)', about(
    `Reads a public MSL Navcam EDR thumbnail, which carries both a PDS3 and a VICAR label, and converts it to VICAR. Passes when the pixels match the recorded golden hash and the VICAR output has the same pixels.`,
    '@mission-data', '@lossless',
  ), async ({}, testInfo) => {
    const img = asset('msl-navcam-thumb-img');
    const p = await probe(testInfo, img);
    expectGolden('msl-navcam-thumb', p);
    const r = await convert(testInfo, img, 'msl_thumb.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), p);
  });

  test('reads an MSL Navcam EDR through its detached .LBL', about(
    `Converts the same MSL thumbnail by giving jConvertIIO its detached \`.LBL\` label instead of the image file. Passes when the conversion succeeds.`,
    '@mission-data',
  ), async ({}, testInfo) => {
    needsReview('REVIEW-7', 'PDSImageReader fails on the detached MSL label: "Error reading header: Negative size"');
    asset('msl-navcam-thumb-img'); // the label points at this file
    const r = await convert(testInfo, asset('msl-navcam-thumb-lbl'), 'msl_lbl.vic', { format: 'vicar' });
    expectConverted(r);
  });

  test('PDS-labelled input to FORMAT=pds with the default stylesheet', about(
    `Converts a PDS-labelled MSL image to PDS3 (\`FORMAT=pds\`) without a stylesheet, so the default PDS-to-PDS stylesheet is used. Passes when the conversion succeeds with a non-empty output; before the IDS-8497 fix it crashed and left an empty file.`,
    '@mission-data', '@regression',
  ), async ({}, testInfo) => {
    issue('IDS-8497', 'fixed: the default PDS-to-PDS stylesheet name was empty (NullPointerException, empty .pds)');
    const r = await convert(testInfo, asset('msl-navcam-thumb-img'), 'msl_default.pds', { format: 'pds' });
    expectConverted(r);
  });

  test('PDS-labelled input to FORMAT=pds with an explicit copy stylesheet', about(
    `Same conversion with \`XSL=CopyEverything.xsl\` given explicitly. Passes when the output label has an \`^IMAGE\` pointer and the pixels are unchanged.`,
    '@mission-data', '@lossless',
  ), async ({}, testInfo) => {
    issue('IDS-8497', 'an explicit copy stylesheet gives the same result as the default');
    const img = asset('msl-navcam-thumb-img');
    const r = await convert(testInfo, img, 'msl_copy.pds',
      { format: 'pds', XSL: path.join(XSL_DIR, 'CopyEverything.xsl') });
    expectConverted(r);
    expect(pdsLabel(r.out)).toMatch(/\^IMAGE\s*=/);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });
});

test.describe('PDS3 products (full-size products)', feature('pds3', 'full'), () => {
  test('MSL Navcam full EDR reads and round-trips through VICAR', about(
    `Reads a full-size public MSL Navcam EDR and converts it to VICAR. Passes when the pixels match the recorded golden hash and the VICAR output has the same pixels.`,
    '@mission-data', '@lossless',
  ), async ({}, testInfo) => {
    const img = asset('msl-navcam-edr-img');
    asset('msl-navcam-edr-lbl');
    const p = await probe(testInfo, img);
    expectGolden('msl-navcam-edr', p);
    const r = await convert(testInfo, img, 'msl.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), p);
  });

  test('MER Opportunity Navcam EDR reads (stand-in for the legacy mer_file.vic)', about(
    `Reads a public MER Opportunity Navcam EDR, the public stand-in for the internal \`mer_file.vic\` of the legacy test. Passes when the pixels match the recorded golden hash.`,
    '@mission-data', '@legacy',
  ), async ({}, testInfo) => {
    expectGolden('mer1-navcam-edr', await probe(testInfo, asset('mer1-navcam-edr')));
  });

  test('Cassini ISS: VICAR image and its detached PDS3 label decode identically', about(
    `Reads a public Cassini ISS image directly and through its detached PDS3 label (\`.lbl\`, whose \`^IMAGE\` points at the image). Passes when both match the recorded golden hash.`,
    '@mission-data',
  ), async ({}, testInfo) => {
    const img = await probe(testInfo, asset('cassini-iss-img'));
    expectGolden('cassini-iss', img);
    const viaLabel = await tryProbe(testInfo, asset('cassini-iss-lbl'));
    expect(viaLabel, 'detached label readable').not.toBeNull();
    expectSamePixels(viaLabel!, img);
  });
});
