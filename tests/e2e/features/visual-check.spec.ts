// Visual check: the automated replacement for opening outputs in the JADE
// viewer (legacy ST2-4.1 procedure, tstjConvertIIO.csh step 18). An output
// "displays" if it decodes to an image of the expected size that is neither
// blank nor saturated; its preview is attached so a person can look at it.
import path from 'node:path';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { synthetic } from '../support/env';
import { about, feature } from '../support/features';
import { convert, expectConverted, probe, type Probe } from '../support/run';

/** Decodes, has the source's size, and has visible content (8-bit display range). */
function expectDisplayable(p: Probe, like: Probe) {
  expect([p.width, p.height], 'same size as the source').toEqual([like.width, like.height]);
  expect(p.dataType).toBe('BYTE');
  expect(p.std!, 'not blank').toBeGreaterThan(3);
  expect(p.mean!, 'not black').toBeGreaterThan(2);
  expect(p.mean!, 'not saturated').toBeLessThan(253);
}

test.describe('Visual check (replaces JADE review)', feature('visual-check'), () => {
  test('legacy step 18: PNG converted to JPEG displays', about(
    `Legacy step 18, once checked by eye in JADE: converts the synthetic image to PNG, then the PNG to JPEG. Passes when the JPEG displays: BYTE, the same size as the PNG, not blank (standard deviation over 3), not black (mean over 2) and not saturated (mean under 253). The preview is attached for a person to look at.`,
    '@legacy', '@nominal', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
    const png = await convert(testInfo, synthetic('gen_byte_bsq.vic'), 'image.png', { format: 'png' });
    expectConverted(png);
    const jpg = await convert(testInfo, png.out, 'image.jpg', { FORMAT: 'jpg' });
    expectConverted(jpg);
    expectDisplayable(await probe(testInfo, jpg.out), await probe(testInfo, png.out));
  });

  for (const id of ['msl-navcam-thumb-img', 'm2020-navcam-thumb-img', 'cassini-iss-img', 'astropy-horsehead-fits']) {
    test(`browse image of ${id} displays`, about(
      `Makes an 8-bit PNG browse image (\`OFORM=BYTE\`) of ${id}, as a reviewer once viewed it in JADE. Passes when it displays: the source's size, BYTE, and not blank, black or saturated. The preview is attached.`,
      '@mission-data', '@legacy', { added: '2026-10-23' },
    ), async ({}, testInfo) => {
      const src = asset(id);
      const source = await probe(testInfo, src, { preview: false });
      const r = await convert(testInfo, src, `${path.basename(src)}.browse.png`, { format: 'png', OFORM: 'BYTE' });
      expectConverted(r);
      expectDisplayable(await probe(testInfo, r.out), source);
    });
  }
});

test.describe('Visual check (full-size products)', feature('visual-check', 'full'), () => {
  for (const id of ['mer1-navcam-edr', 'msl-navcam-edr-img', 'm2020-navcam-edr-img']) {
    test(`browse image of ${id} displays`, about(
      `Makes an 8-bit PNG browse image (\`OFORM=BYTE\`) of ${id}, as a reviewer once viewed it in JADE. Passes when it displays: the source's size, BYTE, and not blank, black or saturated. The preview is attached.`,
      '@mission-data', '@legacy', { added: '2026-10-23' },
    ), async ({}, testInfo) => {
      const src = asset(id);
      const source = await probe(testInfo, src, { preview: false });
      const r = await convert(testInfo, src, `${path.basename(src)}.browse.png`, { format: 'png', OFORM: 'BYTE' });
      expectConverted(r);
      expectDisplayable(await probe(testInfo, r.out), source);
    });
  }
});
