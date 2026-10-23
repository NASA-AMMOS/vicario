// ISIS cubes: ISIS2 qubes with an SFDU label (the format ISISImageReaderSpi
// recognizes), a Cassini VIMS spectral cube and the GDAL ISIS2 fixture.
// Expected dimensions come from each label's CORE_ITEMS.
import { expect, test } from '@playwright/test';
import { asset } from '../support/data';
import { feature, knownFailure } from '../support/features';
import { convert, expectConverted, probe } from '../support/run';

const CUBES = [
  // CORE_ITEMS = (1, 352, 64) with AXIS_NAME = (SAMPLE, BAND, LINE), SUN_INTEGER
  { id: 'cassini-vims-qube', label: 'Cassini VIMS cube', dims: [1, 64, 352], type: 'SHORT' },
  // CORE_ITEMS = (43,1 ,1) with AXIS_NAME = (SAMPLE,LINE,BAND), SUN_REAL
  { id: 'gdal-isis2-cube', label: 'GDAL ISIS2 cube', dims: [43, 1, 1], type: 'FLOAT' },
];

test.describe('ISIS cubes', feature('isis'), () => {
  for (const c of CUBES) {
    test(`reads the ${c.label} and converts it to VICAR`, async ({}, testInfo) => {
      knownFailure('UNFILED-14', 'ISIS reader does not trim CORE_ITEMS values: NumberFormatException for " 352", '
        + 'then a NullPointerException (no image); jConvertIIO exits 0 with no output');
      if (c.id === 'cassini-vims-qube') asset('cassini-vims-lbl');
      const r = await convert(testInfo, asset(c.id), `${c.id}.vic`, { format: 'vicar' });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect([p.width, p.height, p.bands, p.dataType]).toEqual([...c.dims, c.type]);
    });
  }
});
