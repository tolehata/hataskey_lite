/* SPDX-License-Identifier: AGPL-3.0-only */

import { StatusError } from '@/misc/status-error.js';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const dibHeaderSizes = new Set([40, 52, 56, 108, 124]);
const colorDepths = new Set([1, 2, 4, 8, 24, 32]);

/** Validate the sizes actually consumed by decode-bmp/decode-ico before either allocates pixels. */
export function validateBitmap(source: Buffer, icon: boolean, maxPixels: number): void {
	const reject = () => { throw new StatusError('Invalid or oversized bitmap', 413); };
	const dib = (data: Buffer, expectedWidth?: number, expectedHeight?: number): number => {
		if (data.length < 40) return reject();
		const headerSize = data.readUInt32LE(0);
		const width = data.readInt32LE(4);
		const encodedHeight = data.readInt32LE(8);
		const height = icon ? encodedHeight / 2 : encodedHeight;
		const depth = data.readUInt16LE(14);
		const colorCount = data.readUInt32LE(32);
		if (!dibHeaderSizes.has(headerSize) || headerSize > data.length || data.readUInt16LE(12) !== 1 || !colorDepths.has(depth)) return reject();
		// decode-bmp ignores the compression field and reads 32bpp pixels as B,G,R,A right
		// after the header. That matches BI_BITFIELDS only when the masks live inside a V4/V5
		// header (as Windows writes them) and use the standard layout. Masks appended after a
		// 40-byte header would be read as pixels, and every other compression is unsupported.
		const compression = data.readUInt32LE(16);
		const standardBitfields = compression === 3 && depth === 32 && headerSize >= 108
			&& data.readUInt32LE(40) === 0x00FF0000 && data.readUInt32LE(44) === 0x0000FF00 && data.readUInt32LE(48) === 0x000000FF
			&& [0xFF000000, 0].includes(data.readUInt32LE(52));
		if (compression !== 0 && !standardBitfields) return reject();
		// decode-bmp reads the height as unsigned, so a top-down (negative) height would
		// allocate billions of rows. Keep rejecting it here.
		if (width <= 0 || height <= 0 || !Number.isInteger(height) || width * height > maxPixels) return reject();
		if (icon && (width !== expectedWidth || height !== expectedHeight)) return reject();
		if (colorCount > (depth <= 8 ? 2 ** depth : 0)) return reject();
		const paletteBytes = (depth <= 8 ? colorCount || 2 ** depth : 0) * 4;
		const pixelBytes = Math.ceil(width * depth / 32) * 4 * height;
		const maskBytes = icon && depth !== 32 ? Math.ceil(width / 32) * 4 * height : 0;
		if (headerSize + paletteBytes + pixelBytes + maskBytes > data.length) return reject();
		return width * height;
	};
	const png = (data: Buffer, width?: number, height?: number): number => {
		if (data.length < 33 || data.readUInt32BE(8) !== 13 || data.toString('ascii', 12, 16) !== 'IHDR') return reject();
		const actualWidth = data.readUInt32BE(16);
		const actualHeight = data.readUInt32BE(20);
		if (actualWidth === 0 || actualHeight === 0 || actualWidth * actualHeight > maxPixels) return reject();
		if (width != null && (width !== actualWidth || height !== actualHeight)) return reject();
		return actualWidth * actualHeight;
	};
	if (!icon) {
		if (source.length < 54 || source.toString('ascii', 0, 2) !== 'BM') return reject();
		dib(source.subarray(14));
		return;
	}
	// Existing sharpBmp also accepts a PNG supplied with an icon MIME type.
	if (source.subarray(0, 8).equals(pngSignature)) {
		png(source);
		return;
	}
	if (source.length < 6 || source.readUInt16LE(0) !== 0 || ![1, 2].includes(source.readUInt16LE(2))) return reject();
	const count = source.readUInt16LE(4);
	const directoryEnd = 6 + count * 16;
	// decode-ico eagerly decodes every entry, including duplicate/overlapping payloads.
	if (count === 0 || count > 64 || directoryEnd > source.length) return reject();
	let pixels = 0;
	for (let index = 0; index < count; index++) {
		const entry = 6 + index * 16;
		const width = source[entry] || 256;
		const height = source[entry + 1] || 256;
		const size = source.readUInt32LE(entry + 8);
		const offset = source.readUInt32LE(entry + 12);
		if (offset < directoryEnd || size < 8 || offset + size > source.length) return reject();
		const data = source.subarray(offset, offset + size);
		pixels += data.subarray(0, 8).equals(pngSignature) ? png(data, width, height) : dib(data, width, height);
		if (pixels > maxPixels) return reject();
	}
}
