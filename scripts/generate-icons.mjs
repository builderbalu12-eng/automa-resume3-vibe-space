import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper function to create valid PNG files
function createPNG(width, height) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (image header)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type (RGB)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk("IHDR", ihdr);

  // IDAT chunk (image data) - create simple gradient image
  const pixelData = Buffer.alloc(height * (width * 3 + 1));
  let idx = 0;

  for (let y = 0; y < height; y++) {
    pixelData[idx++] = 0; // filter type

    for (let x = 0; x < width; x++) {
      // Purple to blue gradient
      const r = Math.floor(102 + (66 - 102) * (x / width));
      const g = Math.floor(51 + (99 - 51) * (x / width));
      const b = Math.floor(153 + (194 - 153) * (x / width));

      pixelData[idx++] = r;
      pixelData[idx++] = g;
      pixelData[idx++] = b;
    }
  }

  const compressedData = zlib.deflateSync(pixelData);
  const idatChunk = createChunk("IDAT", compressedData);

  // IEND chunk (image end)
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const chunkData = Buffer.concat([typeBuffer, data]);

  // Calculate CRC
  const crc = calculateCRC(chunkData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, chunkData, crcBuffer]);
}

function calculateCRC(data) {
  const polynomial = 0xedb88320;
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ polynomial;
      } else {
        crc = crc >>> 1;
      }
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const sizes = [
  { size: 16, file: "icon-16.png" },
  { size: 48, file: "icon-48.png" },
  { size: 128, file: "icon-128.png" },
];

const iconsDir = path.join(__dirname, "../public/icons");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

sizes.forEach(({ size, file }) => {
  const png = createPNG(size, size);
  const filePath = path.join(iconsDir, file);
  fs.writeFileSync(filePath, png);
  console.log(`✓ Created ${file} (${size}x${size})`);
});

console.log("\n✓ All icons generated successfully!");
