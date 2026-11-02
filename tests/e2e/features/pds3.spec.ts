// PDS3 products: writing PDS3 labels from VICAR, reading public PDS3
// products (attached PDS3+VICAR labels, detached .LBL), PDS-to-PDS conversion.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { XSL_DIR, synthetic } from '../support/env';
import { about, feature, issue } from '../support/features';
import { expectGolden } from '../support/goldens';
import { expectValidPds3Label, pdsLabel } from '../support/labels';
import { convert, expectConverted, expectSamePixels, probe, tryProbe } from '../support/run';

/** The VICAR label text (the first LBLSIZE bytes) of a VICAR file. */
function vicarLabelText(file: string): string {
  const text = readFileSync(file, 'latin1');
  const size = Number(text.match(/^LBLSIZE=\s*(\d+)/)?.[1]);
  expect(size, `${path.basename(file)} starts with LBLSIZE`).toBeGreaterThan(0);
  return text.slice(0, size);
}

test.describe('PDS3 products', feature('pds3'), () => {
  const input = synthetic('gen_byte_bsq.vic');
  const dims = { lines: 64, samples: 48, bands: 3 };

  test('VICAR to PDS3 writes a valid label and keeps pixels', about(
    `Converts the synthetic 3-band BYTE image to PDS3. Passes when the label is valid (PDS3 version, \`^IMAGE\` pointer, an IMAGE object with the right LINES, LINE_SAMPLES and BANDS, no empty \`""\` values) and the pixels are unchanged.`,
    '@nominal', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'out.pds', { format: 'pds' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('EMBED_VICAR_LABEL=true embeds the VICAR label', about(
    `Converts the synthetic image to PDS3 with \`EMBED_VICAR_LABEL=true\`. Passes when the PDS3 label is valid, the VICAR label (\`LBLSIZE=\`) is embedded in the file, and the pixels are unchanged.`,
    '@nominal', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'embedded.pds', { format: 'pds', EMBED_VICAR_LABEL: 'true' });
    expectConverted(r);
    expectValidPds3Label(r.out, dims);
    expect(readFileSync(r.out, 'latin1'), 'embedded VICAR label').toContain('LBLSIZE=');
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('PDS_FILENAME_IN_LABEL=true puts the output file name in the label', about(
    `Converts the synthetic image to PDS3 with \`PDS_FILENAME_IN_LABEL=true\`. Passes when the label is valid, its \`^IMAGE\` pointer names the output file by its base name (\`^IMAGE = ("named.pds",n)\`) and the pixels are unchanged.`,
    '@nominal', '@regression', '@lossless', { added: '2026-10-22', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-9', 'fixed: the documented keyword PDS_FILENAME_IN_LABEL was parsed as PDS_FILENAME and ignored, '
      + 'and the writer never put the file name in the label');
    const r = await convert(testInfo, input, 'named.pds', { format: 'pds', PDS_FILENAME_IN_LABEL: 'true' });
    expectConverted(r);
    const label = expectValidPds3Label(r.out, dims);
    expect(label).toMatch(/^\^IMAGE\s*=\s*\("named\.pds",\s*\d+\)\s*$/m);
    expect(label, 'no directory in the file name').not.toContain(path.dirname(r.out));
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, input));
  });

  test('PDS_FILENAME (older spelling) still puts the file name in the label', about(
    `Converts the synthetic image to PDS3 with \`PDS_FILENAME=true\`, the only spelling the parser accepted before. Passes when the \`^IMAGE\` pointer names the output file.`,
    '@nominal', '@regression', { added: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-9', 'PDS_FILENAME is kept as an alias of PDS_FILENAME_IN_LABEL');
    const r = await convert(testInfo, input, 'alias.pds', { format: 'pds', PDS_FILENAME: 'true' });
    expectConverted(r);
    expect(expectValidPds3Label(r.out, dims)).toMatch(/^\^IMAGE\s*=\s*\("alias\.pds",\s*\d+\)\s*$/m);
  });

  test('without PDS_FILENAME_IN_LABEL, or with =false, the label names no file', about(
    `Converts the synthetic image to PDS3 without the keyword, and again with \`PDS_FILENAME_IN_LABEL=false\`. Passes when both labels use the record-number pointer \`^IMAGE = n\` and do not contain the output file name.`,
    '@off-nominal', '@regression', { added: '2026-10-22', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-9', 'the file name is opt-in; the default attached label is unchanged');
    const cases: [string, Record<string, string>][] = [['plain.pds', {}], ['nofile.pds', { PDS_FILENAME_IN_LABEL: 'false' }]];
    for (const [name, kv] of cases) {
      const r = await convert(testInfo, input, name, { format: 'pds', ...kv });
      expectConverted(r);
      const label = expectValidPds3Label(r.out, dims);
      expect(label).toMatch(/^\^IMAGE\s*=\s*\d+\s*$/m);
      expect(label).not.toContain(name);
    }
  });

  test('PDS_LABEL_TYPE=ODL3 writes an ODL3 label', about(
    `Converts the synthetic image to PDS3 with \`PDS_LABEL_TYPE=ODL3\`. Passes when the label starts with \`ODL_VERSION_ID = ODL3\` and is otherwise valid.`,
    '@nominal', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, input, 'odl3.pds', { format: 'pds', PDS_LABEL_TYPE: 'ODL3' });
    expectConverted(r);
    expect(expectValidPds3Label(r.out, dims)).toMatch(/^ODL_VERSION_ID\s*=\s*ODL3/);
  });

  test('reads an MSL Navcam EDR thumbnail (attached PDS3 + VICAR labels)', about(
    `Reads a public MSL Navcam EDR thumbnail, which carries both a PDS3 and a VICAR label, and converts it to VICAR. Passes when the pixels match the recorded golden hash and the VICAR output has the same pixels.`,
    '@mission-data', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const img = asset('msl-navcam-thumb-img');
    const p = await probe(testInfo, img);
    expectGolden('msl-navcam-thumb', p);
    const r = await convert(testInfo, img, 'msl_thumb.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), p);
  });

  test('reads an MSL Navcam EDR through its detached .LBL', about(
    `Converts the same MSL thumbnail by giving jConvertIIO its detached \`.LBL\` label instead of the image file. Passes when the conversion succeeds and the VICAR output has the same pixels as the \`.IMG\`.`,
    '@mission-data', '@regression', '@lossless', { added: '2026-10-22', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-7', 'fixed: the embedded VICAR label (^IMAGE_HEADER in the .IMG) was read from the .LBL before the '
      + 'data file was opened, and seeking past the end of the .LBL failed with "Negative size"');
    const img = asset('msl-navcam-thumb-img'); // the label points at this file
    const r = await convert(testInfo, asset('msl-navcam-thumb-lbl'), 'msl_lbl.vic', { format: 'vicar' });
    expectConverted(r);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('namespaced PDS3 keywords (MSL:...) become legal VICAR keywords', about(
    `Converts the MSL thumbnail's detached \`.LBL\`, which uses namespaced keywords such as \`MSL:MODEL_TRANSFORM_VECTOR\`, to VICAR. Passes when no VICAR keyword contains \`:\`, the namespace is dropped (\`MODEL_TRANSFORM_VECTOR=\` is present, as in the mission's own VICAR label) and the output reads back with the \`.IMG\` pixels.`,
    '@mission-data', '@regression', { added: '2026-10-22', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('NEW-pds3-2', 'fixed: MSL:... keywords were copied verbatim into the VICAR label, which vicario then could '
      + 'not read back ("\'=\' expected after label keyword \'MSL\'")');
    const img = asset('msl-navcam-thumb-img');
    const r = await convert(testInfo, asset('msl-navcam-thumb-lbl'), 'msl_ns.vic', { format: 'vicar' });
    expectConverted(r);
    const label = vicarLabelText(r.out);
    expect(label.match(/(?:^|\s)[A-Z0-9_]*:[A-Z0-9_]+=/g), 'keywords with a namespace').toBeNull();
    expect(label).toMatch(/(?:^|\s)MODEL_TRANSFORM_VECTOR=\(/);
    expectSamePixels(await probe(testInfo, r.out), await probe(testInfo, img));
  });

  test('PDS-labelled input to FORMAT=pds with the default stylesheet', about(
    `Converts a PDS-labelled MSL image to PDS3 (\`FORMAT=pds\`) without a stylesheet, so the default PDS-to-PDS stylesheet is used. Passes when the conversion succeeds with a non-empty output; before the IDS-8497 fix it crashed and left an empty file.`,
    '@mission-data', '@regression', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    issue('IDS-8497', 'fixed: the default PDS-to-PDS stylesheet name was empty (NullPointerException, empty .pds)');
    const r = await convert(testInfo, asset('msl-navcam-thumb-img'), 'msl_default.pds', { format: 'pds' });
    expectConverted(r);
  });

  test('PDS-labelled input to FORMAT=pds with an explicit copy stylesheet', about(
    `Same conversion with \`XSL=CopyEverything.xsl\` given explicitly. Passes when the output label has an \`^IMAGE\` pointer and the pixels are unchanged.`,
    '@mission-data', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
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
    '@mission-data', '@lossless', { added: '2026-10-22', modified: '2026-10-23' },
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
    '@mission-data', '@legacy', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    expectGolden('mer1-navcam-edr', await probe(testInfo, asset('mer1-navcam-edr')));
  });

  test('Cassini ISS: VICAR image and its detached PDS3 label decode identically', about(
    `Reads a public Cassini ISS image directly and through its detached PDS3 label (\`.lbl\`, whose \`^IMAGE\` points at the image). Passes when both match the recorded golden hash.`,
    '@mission-data', { added: '2026-10-22', modified: '2026-10-23' },
  ), async ({}, testInfo) => {
    const img = await probe(testInfo, asset('cassini-iss-img'));
    expectGolden('cassini-iss', img);
    const viaLabel = await tryProbe(testInfo, asset('cassini-iss-lbl'));
    expect(viaLabel, 'detached label readable').not.toBeNull();
    expectSamePixels(viaLabel!, img);
  });
});
