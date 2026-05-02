// Script to generate a minimal .ico file for YCode
const fs = require('fs');
const path = require('path');

// Create a minimal 16x16 .ico file with a simple "Y" shape
// ICO format: header + directory entry + BMP data

const width = 16;
const height = 16;

// Generate pixel data (BGRA format, bottom-up)
const pixels = [];
const bg = [0x1a, 0x1a, 0x2e, 0xff]; // Dark blue background (#1a1a2e)
const fg = [0xe9, 0x45, 0x60, 0xff]; // Red accent (#e94560)

// Y shape pattern (16x16 grid)
const yPattern = [
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
];

// BMP data is stored bottom-up, so reverse rows
for (let y = height - 1; y >= 0; y--) {
  for (let x = 0; x < width; x++) {
    const isFg = yPattern[y][x] === 1;
    const color = isFg ? fg : bg;
    pixels.push(color[0], color[1], color[2], color[3]); // BGRA
  }
  // Row padding (each row must be 4-byte aligned)
  // 16 pixels * 4 bytes = 64 bytes, already 4-byte aligned
}

// AND mask (1bpp, bottom-up) - all opaque since alpha is set
const andMaskSize = Math.ceil(width / 8) * height;
const andMask = Buffer.alloc(andMaskSize, 0); // all 0s = opaque

const pixelData = Buffer.from(pixels);
const imageDataSize = pixelData.length + andMask.length;

// BMP info header (BITMAPINFOHEADER) for the image data
const bmpHeader = Buffer.alloc(40);
bmpHeader.writeUInt32LE(40, 0);           // biSize
bmpHeader.writeInt32LE(width, 4);          // biWidth
bmpHeader.writeInt32LE(height * 2, 8);     // biHeight (2x for AND mask)
bmpHeader.writeUInt16LE(1, 12);            // biPlanes
bmpHeader.writeUInt16LE(32, 14);           // biBitCount (32-bit ARGB)
bmpHeader.writeUInt32LE(0, 16);            // biCompression (BI_RGB)
bmpHeader.writeUInt32LE(imageDataSize, 20); // biSizeImage
bmpHeader.writeInt32LE(0, 24);             // biXPelsPerMeter
bmpHeader.writeInt32LE(0, 28);             // biYPelsPerMeter
bmpHeader.writeUInt32LE(0, 32);            // biClrUsed
bmpHeader.writeUInt32LE(0, 36);            // biClrImportant

const totalDataSize = 40 + imageDataSize;

// ICO header (6 bytes)
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);    // Reserved
icoHeader.writeUInt16LE(1, 2);    // Type (1 = ICO)
icoHeader.writeUInt16LE(1, 4);    // Number of images

// ICO directory entry (16 bytes)
const icoEntry = Buffer.alloc(16);
icoEntry.writeUInt8(width, 0);          // Width (0 = 256)
icoEntry.writeUInt8(height, 1);         // Height
icoEntry.writeUInt8(0, 2);              // Color palette
icoEntry.writeUInt8(0, 3);              // Reserved
icoEntry.writeUInt16LE(1, 4);           // Color planes
icoEntry.writeUInt16LE(32, 6);          // Bits per pixel
icoEntry.writeUInt32LE(totalDataSize, 8); // Size of image data
icoEntry.writeUInt32LE(22, 12);          // Offset to image data (6 + 16 = 22)

const ico = Buffer.concat([icoHeader, icoEntry, bmpHeader, pixelData, andMask]);

const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
console.log('Generated build/icon.ico (' + ico.length + ' bytes)');

// Also generate a 256x256 version for better quality
// We'll scale up the pattern
const width256 = 256;
const height256 = 256;
const scale = width256 / width;

const pixels256 = [];
for (let y = height256 - 1; y >= 0; y--) {
  for (let x = 0; x < width256; x++) {
    const srcY = Math.floor(y / scale);
    const srcX = Math.floor(x / scale);
    const isFg = yPattern[srcY] && yPattern[srcY][srcX] === 1;
    const color = isFg ? fg : bg;
    pixels256.push(color[0], color[1], color[2], color[3]);
  }
}

const pixelData256 = Buffer.from(pixels256);
const andMaskSize256 = Math.ceil(width256 / 8) * height256;
const andMask256 = Buffer.alloc(andMaskSize256, 0);
const imageDataSize256 = pixelData256.length + andMask256.length;

const bmpHeader256 = Buffer.alloc(40);
bmpHeader256.writeUInt32LE(40, 0);
bmpHeader256.writeInt32LE(width256, 4);
bmpHeader256.writeInt32LE(height256 * 2, 8);
bmpHeader256.writeUInt16LE(1, 12);
bmpHeader256.writeUInt16LE(32, 14);
bmpHeader256.writeUInt32LE(0, 16);
bmpHeader256.writeUInt32LE(imageDataSize256, 20);
bmpHeader256.writeInt32LE(0, 24);
bmpHeader256.writeInt32LE(0, 28);
bmpHeader256.writeUInt32LE(0, 32);
bmpHeader256.writeUInt32LE(0, 36);

const totalDataSize256 = 40 + imageDataSize256;

// ICO with two images: 256x256 and 16x16
const icoHeader2 = Buffer.alloc(6);
icoHeader2.writeUInt16LE(0, 0);
icoHeader2.writeUInt16LE(1, 2);
icoHeader2.writeUInt16LE(2, 4); // 2 images

const icoEntry1 = Buffer.alloc(16);
icoEntry1.writeUInt8(0, 0);            // 0 = 256
icoEntry1.writeUInt8(0, 1);            // 0 = 256
icoEntry1.writeUInt8(0, 2);
icoEntry1.writeUInt8(0, 3);
icoEntry1.writeUInt16LE(1, 4);
icoEntry1.writeUInt16LE(32, 6);
icoEntry1.writeUInt32LE(totalDataSize256, 8);
icoEntry1.writeUInt32LE(6 + 16 * 2, 12); // offset after headers

const icoEntry2 = Buffer.alloc(16);
icoEntry2.writeUInt8(width, 0);
icoEntry2.writeUInt8(height, 1);
icoEntry2.writeUInt8(0, 2);
icoEntry2.writeUInt8(0, 3);
icoEntry2.writeUInt16LE(1, 4);
icoEntry2.writeUInt16LE(32, 6);
icoEntry2.writeUInt32LE(totalDataSize, 8);
icoEntry2.writeUInt32LE(6 + 16 * 2 + totalDataSize256, 12);

const ico2 = Buffer.concat([
  icoHeader2, icoEntry1, icoEntry2,
  bmpHeader256, pixelData256, andMask256,
  bmpHeader, pixelData, andMask
]);

fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico2);
console.log('Generated build/icon.ico with 256x256 and 16x16 (' + ico2.length + ' bytes)');
