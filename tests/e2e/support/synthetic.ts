// Expected pixels of the SyntheticGen images, computed independently of vicario.
// SyntheticGen (via TestGen) writes value = line*LINC + sample*SINC + band*BINC,
// so the exact result of any crop, subsample or band selection is known. The
// hash matches ImageProbe's pixelSha256 for integer images: samples in line,
// sample, band order, each as a big-endian 32-bit integer.
import { createHash } from 'node:crypto';

export interface SyntheticSpec { nl: number; ns: number; nb: number; linc: number; sinc: number; binc: number }

/** gen_byte_<org>.vic, gen_byte_gray.vic and gen_byte_rgba.vic as written by SyntheticGen. */
export const BYTE_3BAND: SyntheticSpec = { nl: 64, ns: 48, nb: 3, linc: 1, sinc: 2, binc: 30 };
export const BYTE_GRAY: SyntheticSpec = { nl: 64, ns: 48, nb: 1, linc: 1, sinc: 2, binc: 0 };
export const BYTE_RGBA: SyntheticSpec = { nl: 64, ns: 48, nb: 4, linc: 1, sinc: 2, binc: 30 };

export const range = (start: number, end: number, step = 1) =>
  Array.from({ length: Math.max(0, Math.ceil((end - start) / step)) }, (_, i) => start + i * step);

/** BYTE value as TestGen stores it: (byte)(line*linc + sample*sinc + band*binc), read back unsigned. */
export const byteValue = (s: SyntheticSpec, line: number, sample: number, band: number) =>
  Math.trunc(line * s.linc + sample * s.sinc + band * s.binc) & 0xff;

/** pixelSha256 of the given lines x samples x bands of a BYTE synthetic image. */
export function expectedHash(s: SyntheticSpec, lines: number[], samples: number[], bands: number[]) {
  const buf = Buffer.alloc(4 * samples.length * bands.length);
  const sha = createHash('sha256');
  for (const l of lines) {
    let o = 0;
    for (const x of samples) for (const b of bands) o = buf.writeInt32BE(byteValue(s, l, x, b), o);
    sha.update(buf);
  }
  return sha.digest('hex');
}
