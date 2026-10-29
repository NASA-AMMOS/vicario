// ISIS cubes: ISIS2 qubes with an SFDU label (the format ISISImageReaderSpi
// recognizes), a Cassini VIMS spectral cube and the GDAL ISIS2 fixture.
// Expected dimensions come from each label's CORE_ITEMS.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { about, feature, issue } from '../support/features';
import { convert, expectConverted, probe } from '../support/run';

const CUBES = [
  // CORE_ITEMS = (1, 352, 64) with AXIS_NAME = (SAMPLE, BAND, LINE), SUN_INTEGER
  { id: 'cassini-vims-qube', label: 'Cassini VIMS cube', dims: [1, 64, 352], type: 'SHORT' },
  // CORE_ITEMS = (43,1 ,1) with AXIS_NAME = (SAMPLE,LINE,BAND), SUN_REAL
  { id: 'gdal-isis2-cube', label: 'GDAL ISIS2 cube', dims: [43, 1, 1], type: 'FLOAT' },
];

test.describe('ISIS cubes', feature('isis'), () => {
  for (const c of CUBES) {
    test(`reads the ${c.label} and converts it to VICAR`, about(
      `Converts the ${c.label} to VICAR. Passes when the output has the dimensions and data type given by the label's \`CORE_ITEMS\` (${c.dims.join(' x ')}, ${c.type}).`,
      '@nominal', '@regression', ...(c.id.startsWith('cassini') ? ['@mission-data' as const] : []), { added: '2026-10-23', modified: '2026-10-24' },
    ), async ({}, testInfo) => {
      issue('REVIEW-14', 'fixed: CORE_ITEMS / SUFFIX_ITEMS values with blanks (" 352", "1  ") were not trimmed '
        + '(NumberFormatException, then a NullPointerException and no output)');
      issue('NEW-isis-1', 'fixed: both the ISIS and the PDS reader accept an ISIS2 qube and ImageIO picked either; '
        + 'when the PDS reader won, the output was a 1x1x1 BYTE image');
      if (c.id === 'cassini-vims-qube') asset('cassini-vims-lbl');
      const r = await convert(testInfo, asset(c.id), `${c.id}.vic`, { format: 'vicar' });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect([p.width, p.height, p.bands, p.dataType]).toEqual([...c.dims, c.type]);
    });
  }

  test('a cube whose CORE_ITEMS is not a list of integers fails with a clear error', about(
    `Copies the GDAL ISIS2 cube with \`CORE_ITEMS = (43,1  ,1)\` changed to \`(43,x  ,1)\` and converts it to VICAR. Passes when jConvertIIO exits non-zero and reports that the ISIS reader cannot read the label, without a NullPointerException.`,
    '@off-nominal', '@malformed-input', '@regression', { added: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-14', 'fixed: a header the ISIS reader could not parse was only printed, and the read then '
      + 'failed later with a NullPointerException');
    const bytes = readFileSync(asset('gdal-isis2-cube'), 'latin1');
    const bad = bytes.replace(/(CORE_ITEMS\s*=\s*\(43,)1/, '$1x');
    expect(bad, 'CORE_ITEMS edited').not.toBe(bytes);
    const file = testInfo.outputPath('bad_core_items.cub');
    writeFileSync(file, bad, 'latin1');
    const r = await convert(testInfo, file, 'bad.vic', { format: 'vicar' });
    const log = `${r.stdout}\n${r.stderr}`;
    expect(r.exitCode, 'jConvertIIO exit code').not.toBe(0);
    expect(log).toContain('ISIS reader cannot read the label');
    expect(log).not.toContain('NullPointerException');
  });
});
