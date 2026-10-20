/**
 * Image type detection from the file's first bytes ("magic numbers"), so a
 * renamed .exe or HTML file can't pass as an image. Pure: no Node APIs.
 */

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export type ImageMime = keyof typeof IMAGE_TYPES;
export type ImageExt = (typeof IMAGE_TYPES)[ImageMime];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isImageMime(value: string): value is ImageMime {
  return Object.prototype.hasOwnProperty.call(IMAGE_TYPES, value);
}

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/** Returns the detected MIME type, or null if it is not an allowed image. */
export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => bytes[i] === byte)) return "image/png";

  // WebP: "RIFF" ???? "WEBP"
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";

  // AVIF: ISO-BMFF box "ftyp" with an avif/avis brand (major or compatible).
  if (ascii(bytes, 4, 8) === "ftyp") {
    const boxSize = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const end = Math.min(Math.max(boxSize, 16), bytes.length, 64);
    for (let offset = 8; offset + 4 <= end; offset += 4) {
      if (offset === 12) continue; // minor_version, not a brand
      const brand = ascii(bytes, offset, offset + 4);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }

  return null;
}
