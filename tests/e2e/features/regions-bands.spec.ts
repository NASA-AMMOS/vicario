// Regions, subsampling and bands: SOURCE_REGION, SUBSAMPLING, CROP, SCALE,
// READ_BANDS, BANDS, 2RGB and alpha (WRITE_TRANSPARENCY). Expected pixels are
// computed from the synthetic image formula (support/synthetic.ts), and the
// selected area is drawn on the source preview in the report.
import { readFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { synthetic } from '../support/env';
import { about, feature, issue } from '../support/features';
import { attachOverlay } from '../support/overlay';
import { convert, expectConverted, expectSamePixels, probe } from '../support/run';
import { BYTE_3BAND, BYTE_GRAY, BYTE_RGBA, expectedHash, range } from '../support/synthetic';

const SRC = synthetic('gen_byte_bsq.vic');
const ALL_BANDS = [0, 1, 2];

/** PNG colour type from the IHDR chunk: 0 gray, 2 RGB, 4 gray+alpha, 6 RGBA. */
const pngColorType = (file: string) => readFileSync(file)[25];

test.describe('Regions, subsampling and bands', feature('regions-bands'), () => {
  test('SOURCE_REGION=(x,y,width,height) cuts out exactly that region', about(
    `Cuts out \`SOURCE_REGION=(10,20,16,8)\` from the synthetic image. Passes when the output is 16 x 8 x 3 and its pixel hash equals the hash computed from the generator formula for exactly that region. The region is outlined on the source preview.`,
    '@nominal', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, SRC, 'region.vic', { format: 'vicar', SOURCE_REGION: '(10,20,16,8)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height, p.bands]).toEqual([16, 8, 3]);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_3BAND, range(20, 28), range(10, 26), ALL_BANDS));
    await probe(testInfo, SRC);
    await attachOverlay(testInfo, 'SOURCE_REGION on source', testInfo.outputPath('gen_byte_bsq.vic.preview.png'),
      [{ x: 10, y: 20, width: 16, height: 8 }]);
  });

  test('SOURCE_REGION running past the image edge is clipped, not an error', about(
    `Asks for a 20 x 20 region at (40,60) of the 48 x 64 image, which runs past both edges. Passes when the output is clipped to 8 x 4 with exactly those pixels, rather than an error.`,
    '@off-nominal', '@regression', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
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
    test(`SUBSAMPLING=${args} keeps every Nth sample and line`, about(
      `Subsamples with \`SUBSAMPLING=${args}\` (x step, y step, x offset, y offset). Passes when the output size and pixel hash match the samples and lines the formula selects. The kept pixels are marked on the source preview.`,
      '@nominal', '@regression', { added: '2026-10-23' },
    ), async ({}, testInfo) => {
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

  for (const [format, ext] of [['png', 'png'], ['vicar', 'vic']] as const) {
    test(`CROP=(x,y,width,height) to ${format} cuts out exactly that area`, about(
      `Crops the 48 x 64 gray image with \`CROP=(1,5,11,7)\` (x, y, width, height) and writes ${format}. Passes when the output is 11 wide by 7 high and its pixel hash equals the hash computed from the generator formula for columns 1 to 11 and rows 5 to 11.`,
      '@nominal', '@regression', { added: '2026-10-24' },
    ), async ({}, testInfo) => {
      issue('REVIEW-11', 'fixed: CROP used x as the y offset, and CROP to VICAR failed with a raster bounds error');
      const r = await convert(testInfo, synthetic('gen_byte_gray.vic'), `crop.${ext}`, { format, CROP: '(1,5,11,7)' });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect([p.width, p.height]).toEqual([11, 7]);
      expect(p.pixelSha256).toBe(expectedHash(BYTE_GRAY, range(5, 12), range(1, 12), [0]));
    });
  }

  test('CROP=(x,y) crops from (x,y) to the image edge', about(
    `Crops the 48 x 64 gray image with the two-value form \`CROP=(40,60)\` and writes VICAR. Passes when the output is the 8 x 4 corner from (40,60) to the image edge, with exactly those pixels.`,
    '@nominal', '@regression', { added: '2026-10-23', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    issue('REVIEW-11', 'fixed: the two-value CROP form always failed with "rectangular crop area must not be empty"');
    const r = await convert(testInfo, synthetic('gen_byte_gray.vic'), 'crop_xy.vic', { format: 'vicar', CROP: '(40,60)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height]).toEqual([8, 4]);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_GRAY, range(60, 64), range(40, 48), [0]));
  });

  test('CROP outside the image is refused with a clear error', about(
    `Crops the 48 x 64 gray image with \`CROP=(100,100,5,5)\`, which lies outside the image. Passes when jConvertIIO exits non-zero with a message naming CROP and no Java stack trace.`,
    '@off-nominal', { added: '2026-10-23', modified: '2026-10-24' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_byte_gray.vic'), 'crop_out.vic', { format: 'vicar', CROP: '(100,100,5,5)' });
    expect(r.exitCode, 'jConvertIIO exit code').not.toBe(0);
    const log = `${r.stdout}\n${r.stderr}`;
    expect(log).toMatch(/CROP/);
    expect(log, 'no stack trace').not.toMatch(/\tat [\w.$]+\(/);
  });

  test('SCALE=(2,2,0,0) doubles the image size', about(
    `Scales the synthetic image with \`SCALE=(2,2,0,0)\`. Passes when the output is 96 x 128 x 3 with the source's value range.`,
    '@nominal', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, SRC, 'scale.vic', { format: 'vicar', SCALE: '(2,2,0,0)' });
    expectConverted(r);
    const p = await probe(testInfo, r.out);
    expect([p.width, p.height, p.bands]).toEqual([96, 128, 3]);
    const src = await probe(testInfo, SRC);
    expect([p.min, p.max]).toEqual([src.min, src.max]);
  });

  test('READ_BANDS selects bands on read', about(
    `Reads only some bands, with \`READ_BANDS=2\` and with \`READ_BANDS=0,2\`. Passes when each output has exactly those bands, with the pixel hash computed for them.`,
    '@nominal', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
    for (const [bands, expected] of [['2', [2]], ['0,2', [0, 2]]] as const) {
      const r = await convert(testInfo, SRC, `read_bands_${bands.replace(',', '_')}.vic`, { format: 'vicar', READ_BANDS: bands });
      expectConverted(r);
      const p = await probe(testInfo, r.out);
      expect(p.bands, `READ_BANDS=${bands}`).toBe(expected.length);
      expect(p.pixelSha256, `READ_BANDS=${bands}`).toBe(expectedHash(BYTE_3BAND, range(0, 64), range(0, 48), [...expected]));
    }
  });

  test('BANDS reorders bands (2,1,0 twice restores the original)', about(
    `Reverses the bands with \`BANDS=2,1,0\`, then reverses the result again. Passes when the first output has the bands reversed and the second equals the original.`,
    '@nominal', '@lossless', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
    const once = await convert(testInfo, SRC, 'bgr.vic', { format: 'vicar', BANDS: '2,1,0' });
    expectConverted(once);
    const p = await probe(testInfo, once.out);
    expect(p.pixelSha256).toBe(expectedHash(BYTE_3BAND, range(0, 64), range(0, 48), [2, 1, 0]));
    const twice = await convert(testInfo, once.out, 'rgb.vic', { format: 'vicar', BANDS: '2,1,0' });
    expectConverted(twice);
    expectSamePixels(await probe(testInfo, twice.out), await probe(testInfo, SRC));
  });

  test('2RGB=true turns a single band into gray RGB', about(
    `Writes a single-band image to PNG with \`2RGB=true\` and with \`2RGB=false\`. Passes when the first PNG is RGB with the gray value in all three bands and the second is a gray PNG.`,
    '@nominal', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
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

  test('WRITE_TRANSPARENCY writes the fourth band as PNG alpha', about(
    `Writes a 4-band image to PNG with \`WRITE_TRANSPARENCY=true\`. Passes when the PNG is RGBA and the fourth band is the alpha channel, pixel for pixel.`,
    '@nominal', '@lossless', { added: '2026-10-23' },
  ), async ({}, testInfo) => {
    const r = await convert(testInfo, synthetic('gen_byte_rgba.vic'), 'rgba.png', { format: 'png', WRITE_TRANSPARENCY: 'true' });
    expectConverted(r);
    expect(pngColorType(r.out), 'PNG colour type RGBA').toBe(6);
    expect((await probe(testInfo, r.out)).pixelSha256).toBe(expectedHash(BYTE_RGBA, range(0, 64), range(0, 48), [0, 1, 2, 3]));
  });
});
