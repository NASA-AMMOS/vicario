// Regions, subsampling and bands: SOURCE_REGION, SUBSAMPLING, CROP, SCALE,
// READ_BANDS, BANDS, 2RGB and alpha (WRITE_TRANSPARENCY). Expected pixels are
// computed from the synthetic image formula (support/synthetic.ts), and the
// selected area is drawn on the source preview in the report.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { synthetic } from '../support/env';
import { feature, issue, knownFailure } from '../support/features';
import { attachOverlay } from '../support/overlay';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';
import { BYTE_3BAND, BYTE_GRAY, BYTE_RGBA, expectedHash, range } from '../support/synthetic';

const SRC = synthetic('gen_byte_bsq.vic');
const ALL_BANDS = [0, 1, 2];

/** PNG colour type from the IHDR chunk: 0 gray, 2 RGB, 4 gray+alpha, 6 RGBA. */
const pngColorType = (file: string) => readFileSync(file)[25];

test.describe('Regions, subsampling and bands', feature('regions-bands'), () => {
  test('SOURCE_REGION=(x,y,width,height) cuts out exactly that region', async ({}, testInfo) => {
    const r = await convert(testInfo, SRC, 'region.vic', { format: 'vicar', SOURCE_REGION: '(10,20,16,8)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height, p.bands]).toEqual([16, 8, 3]);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_3BAND, range(20, 28), range(10, 26), ALL_BANDS));
    await probe(testInfo, SRC);
    await attachOverlay(testInfo, 'SOURCE_REGION on source', testInfo.outputPath('gen_byte_bsq.vic.preview.png'),
      [{ x: 10, y: 20, width: 16, height: 8 }]);
  });

  test('SOURCE_REGION running past the image edge is clipped, not an error', async ({}, testInfo) => {
    issue('IDS-7560', 'EOF exception when the region is not fully inside the image');
    const r = await convert(testInfo, SRC, 'region_edge.png', { format: 'png', SOURCE_REGION: '(40,60,20,20)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height]).toEqual([8, 4]);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_3BAND, range(60, 64), range(40, 48), ALL_BANDS));
  });

  for (const [args, xs, ys] of [
    ['(2,2,0,0)', range(0, 48, 2), range(0, 64, 2)],
    ['(3,2,1,1)', range(1, 48, 3), range(1, 64, 2)],
  ] as const) {
    test(`SUBSAMPLING=${args} keeps every Nth sample and line`, async ({}, testInfo) => {
      issue('IDS-7098', 'subsampling factor did not work');
      const r = await convert(testInfo, SRC, 'sub.vic', { format: 'vicar', SUBSAMPLING: args });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect([p.width, p.height]).toEqual([xs.length, ys.length]);
      expect(p.pixelSha256).toBe(expectedHash(BYTE_3BAND, [...ys], [...xs], ALL_BANDS));
      await probe(testInfo, SRC);
      await attachOverlay(testInfo, `SUBSAMPLING ${args} grid`, testInfo.outputPath('gen_byte_bsq.vic.preview.png'), [],
        ys.flatMap((y) => xs.map((x) => [x, y] as [number, number])));
    });
  }

  test('CROP=(x,y,height,width) as documented', async ({}, testInfo) => {
    knownFailure('UNFILED-11', 'CROP uses cropX for the y offset (jConvertIIO.java:4816) and reads the last two values '
      + 'as width,height although the help text says height,width; CROP to VICAR also fails (raster bounds)');
    const r = await convert(testInfo, synthetic('gen_byte_gray.vic'), 'crop.png', { format: 'png', CROP: '(1,5,7,11)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height]).toEqual([11, 7]);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_GRAY, range(5, 12), range(1, 12), [0]));
  });

  test('SCALE=(2,2,0,0) doubles the image size', async ({}, testInfo) => {
    const r = await convert(testInfo, SRC, 'scale.vic', { format: 'vicar', SCALE: '(2,2,0,0)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height, p.bands]).toEqual([96, 128, 3]);
    const src = await probe(testInfo, SRC);
    expect([p.min, p.max]).toEqual([src.min, src.max]);
  });

  test('READ_BANDS selects bands on read', async ({}, testInfo) => {
    for (const [bands, expected] of [['2', [2]], ['0,2', [0, 2]]] as const) {
      const r = await convert(testInfo, SRC, `read_bands_${bands.replace(',', '_')}.vic`, { format: 'vicar', READ_BANDS: bands });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect(p.bands, `READ_BANDS=${bands}`).toBe(expected.length);
      expect(p.pixelSha256, `READ_BANDS=${bands}`).toBe(expectedHash(BYTE_3BAND, range(0, 64), range(0, 48), [...expected]));
    }
  });

  test('BANDS reorders bands (2,1,0 twice restores the original)', async ({}, testInfo) => {
    const once = await convert(testInfo, SRC, 'bgr.vic', { format: 'vicar', BANDS: '2,1,0' });
    expectConverted(once);
    const p = await probe(testInfo, once.out);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_3BAND, range(0, 64), range(0, 48), [2, 1, 0]));
    const twice = await convert(testInfo, once.out, 'rgb.vic', { format: 'vicar', BANDS: '2,1,0' });
    expectConverted(twice);
    expectSamePixels(await probe(testInfo, twice.out), await probe(testInfo, SRC));
  });

  test('2RGB=true turns a single band into gray RGB', async ({}, testInfo) => {
    const gray = synthetic('gen_byte_gray.vic');
    const r = await convert(testInfo, gray, 'rgb.png', { format: 'png', '2RGB': 'true' });
    expectConverted(r);
    expect(pngColorType(r.out), 'PNG colour type RGB').toBe(2);
    const p = await probe(testInfo, r.out);
    expect(p.bands).toBe(3);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_GRAY, range(0, 64), range(0, 48), [0, 0, 0]));
    const off = await convert(testInfo, gray, 'gray.png', { format: 'png', '2RGB': 'false' });
    expectConverted(off);
    expect(pngColorType(off.out), 'PNG colour type gray').toBe(0);
  });

  test('WRITE_TRANSPARENCY writes the fourth band as PNG alpha', async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_byte_rgba.vic'), 'rgba.png', { format: 'png', WRITE_TRANSPARENCY: 'true' });
    expectConverted(r);
    expect(pngColorType(r.out), 'PNG colour type RGBA').toBe(6);
    expect((await probe(testInfo, r.out)).pixelSha256).toBe(expectedHash(BYTE_RGBA, range(0, 64), range(0, 48), [0, 1, 2, 3]));
  });
});
