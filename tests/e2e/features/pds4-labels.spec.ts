// PDS4 label generation with Labelocity (Velocity templates): jConvertIIO
// writes a detached PDS4 label for a mission image. The label must be valid,
// describe the image correctly, match the official archive label's array
// structure, and be readable by vicario to the same pixels as the original.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { about, feature } from '../support/features';
import { generatePds4Label } from '../support/labelocity';
import { expectSamePixels, probe } from '../support/run';

/** Array description of the first image array in a PDS4 label. */
function arrayOf(xml: string) {
  const arr = xml.match(/<Array_[23]D_Image>[\s\S]*?<\/Array_[23]D_Image>/)![0];
  return {
    offset: Number(arr.match(/<offset unit="byte">(\d+)</)![1]),
    axes: Number(arr.match(/<axes>(\d+)</)![1]),
    dataType: arr.match(/<data_type>([^<]+)</)![1],
    elements: [...arr.matchAll(/<axis_name>([^<]+)<\/axis_name>\s*<elements>(\d+)</g)].map((m) => `${m[1]}=${m[2]}`),
  };
}

function expectValidLabel(label: string, imageName: string) {
  expect(existsSync(label) && statSync(label).size, 'label written').toBeGreaterThan(0);
  const xml = readFileSync(label, 'utf8');
  expect(xml.trimStart()).toMatch(/^<\?xml/);
  expect(xml.trimEnd(), 'closes the product').toMatch(/<\/Product_Observational>$/);
  expect(xml, 'no unresolved Velocity references').not.toMatch(/\$!?\{?[A-Za-z_][\w.]*\}?(?![^<]*>)/);
  expect(xml).toContain(`<file_name>${imageName}</file_name>`);
  expect(xml).toMatch(/<logical_identifier>urn:nasa:pds:[^<]+<\/logical_identifier>/);
  return xml;
}

test.describe('PDS4 label generation (Labelocity)', feature('velocity-labels'), () => {
  test('Mars 2020 Navcam: generated label matches the archive label and reads back', about(
    `Generates a PDS4 label for a public Mars 2020 Navcam image with Labelocity (Velocity templates plus vicario). Passes when the label is complete XML with no unresolved template references, names the image file, has a \`urn:nasa:pds\` logical identifier, describes the image array exactly as the official archive label does, and reads back to the same pixels.`,
    '@mission-data', '@nominal',
  ), async ({}, testInfo) => {
    const image = asset('m2020-navcam-thumb-img');
    const g = await generatePds4Label(testInfo, image);
    expect(g.exitCode).toBe(0);
    const xml = expectValidLabel(g.label, 'NLF_0100_0675828717_276EDR_T0040218NCAM00503_01_600J03.IMG');
    await testInfo.attach('generated label', { path: g.label, contentType: 'application/xml' });
    const official = readFileSync(asset('m2020-navcam-thumb-xml'), 'utf8');
    expect(arrayOf(xml), 'array structure as in the archive label').toEqual(arrayOf(official));
    expectSamePixels(await probe(testInfo, g.label), await probe(testInfo, image));
  });

  test('MSL Navcam: generated label describes and reads back the image', about(
    `Generates a PDS4 label for a public MSL Navcam image (MSL has no official PDS4 label to compare with). Passes when the label is valid as above, describes a 64 x 64 array and reads back to the image's pixels.`,
    '@mission-data', '@nominal',
  ), async ({}, testInfo) => {
    const image = asset('msl-navcam-thumb-img');
    const g = await generatePds4Label(testInfo, image);
    expect(g.exitCode).toBe(0);
    const xml = expectValidLabel(g.label, 'NLA_406359343EDR_T0050104NCAM00505M1.IMG');
    await testInfo.attach('generated label', { path: g.label, contentType: 'application/xml' });
    expect(arrayOf(xml).elements).toEqual(['Line=64', 'Sample=64']);
    expectSamePixels(await probe(testInfo, g.label), await probe(testInfo, image));
  });
});
