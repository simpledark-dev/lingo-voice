// Generates placeholder PWA icons (gradient tile with a ring-and-dot mark) without any image library.
// Replace public/icons/* with real artwork whenever you have it; keep the same file names.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
};
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const smooth = (edge, d) => Math.max(0, Math.min(1, 0.5 - d / edge)); // coverage for signed distance d
function render(size, { rounded }) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const radius = rounded ? size * 0.22 : 0;
  const coral = [255, 106, 69], pink = [255, 61, 127], white = [255, 255, 255], mint = [92, 240, 194];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // rounded-square signed distance
      const qx = Math.abs(x + 0.5 - c) - (c - radius), qy = Math.abs(y + 0.5 - c) - (c - radius);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const tileA = rounded ? smooth(1.5, outside) : 1;
      const t = (x + y) / (2 * size);
      let r = coral[0] + (pink[0] - coral[0]) * t, g = coral[1] + (pink[1] - coral[1]) * t, b = coral[2] + (pink[2] - coral[2]) * t;
      // ring
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const ringOuter = size * 0.34, ringInner = size * 0.25, dot = size * 0.11;
      const ringA = smooth(1.5, d - ringOuter) * smooth(1.5, ringInner - d);
      const dotA = smooth(1.5, d - dot);
      [r, g, b] = [r + (white[0] - r) * ringA, g + (white[1] - g) * ringA, b + (white[2] - b) * ringA];
      [r, g, b] = [r + (mint[0] - r) * dotA, g + (mint[1] - g) * dotA, b + (mint[2] - b) * dotA];
      const i = (y * size + x) * 4;
      buf[i] = Math.round(r); buf[i + 1] = Math.round(g); buf[i + 2] = Math.round(b); buf[i + 3] = Math.round(255 * tileA);
    }
  }
  return png(size, buf);
}
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", render(192, { rounded: true }));
writeFileSync("public/icons/icon-512.png", render(512, { rounded: true }));
writeFileSync("public/icons/maskable-512.png", render(512, { rounded: false }));
writeFileSync("public/apple-touch-icon.png", render(180, { rounded: false }));
console.log("icons written");
