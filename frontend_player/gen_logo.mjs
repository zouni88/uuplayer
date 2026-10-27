// 临时脚本：程序化绘制 iPlayer 1024x1024 logo（深色圆角方 + 霓虹青播放三角 + 辉光）
import zlib from 'node:zlib';
import fs from 'node:fs';

const W = 1024, H = 1024, SS = 4;

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r), qy = Math.abs(py - cy) - (hh - r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
function side(px, py, ax, ay, bx, by) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}
function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  let t = ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}
function triDist(px, py, ax, ay, bx, by, cx, cy) {
  const s1 = side(px, py, ax, ay, bx, by), s2 = side(px, py, bx, by, cx, cy), s3 = side(px, py, cx, cy, ax, ay);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  const d = Math.min(segDist(px, py, ax, ay, bx, by), segDist(px, py, bx, by, cx, cy), segDist(px, py, cx, cy, ax, ay));
  return inside ? -d : d;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// 播放三角（圆角）顶点
const TA = [400, 296], TB = [400, 728], TC = [706, 512], TR = 34;

const rgba = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        // 背景圆角方
        const dR = sdRoundRect(px, py, 512, 512, 442, 442, 232);
        const bgA = clamp01(0.5 - dR);
        const t = py / H;
        const br = 13 + (4 - 13) * t, bgc = 24 + (8 - 24) * t, bb = 40 + (14 - 40) * t;
        // 边框霓虹辉光
        const glow = Math.exp(-(dR * dR) / (2 * 13 * 13)) * 0.85;
        // 播放三角
        const dt = triDist(px, py, TA[0], TA[1], TB[0], TB[1], TC[0], TC[1]) - TR;
        const triA = clamp01(0.5 - dt);
        const tt = clamp01((py - 296) / (728 - 296));
        const tr = 234 + (56 - 234) * tt, trg = 252 + (225 - 252) * tt, trb = 255 + (255 - 255) * tt;
        const tglow = Math.exp(-(dt * dt) / (2 * 30 * 30)) * 0.8;
        // 合成
        let cr = (br * bgA + tr * triA * (1 - bgA)) / Math.max(bgA + triA * (1 - bgA), 1e-6);
        let cg = (bgc * bgA + trg * triA * (1 - bgA)) / Math.max(bgA + triA * (1 - bgA), 1e-6);
        let cb = (bb * bgA + trb * triA * (1 - bgA)) / Math.max(bgA + triA * (1 - bgA), 1e-6);
        const ga = clamp01(glow + tglow);
        cr += 56 * (glow + tglow); cg += 225 * (glow + tglow); cb += 255 * (glow + tglow);
        const alpha = clamp01(bgA + triA * (1 - bgA) + ga * (1 - bgA - triA * (1 - bgA)));
        r += clamp01(cr / 255) * 255; g += clamp01(cg / 255) * 255; b += clamp01(cb / 255) * 255; a += alpha * 255;
      }
    }
    const n = SS * SS, i = (y * W + x) * 4;
    rgba[i] = Math.round(r / n); rgba[i + 1] = Math.round(g / n); rgba[i + 2] = Math.round(b / n); rgba[i + 3] = Math.round(a / n);
  }
}

// PNG 编码
function crc32(buf) {
  let c, table = crc32.t || (crc32.t = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync('logo_1024.png', png);
console.log('logo_1024.png written', png.length);
