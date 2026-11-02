// Script to generate high-resolution QR placeholder asset
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dir = path.join(__dirname, '../frontend/assets');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <style>
      .bg { fill: #f8fafc; }
      .border { fill: none; stroke: #cbd5e1; stroke-width: 4; stroke-dasharray: 8 6; }
      .corner { fill: none; stroke: #0f172a; stroke-width: 8; stroke-linecap: round; }
      .marker-outer { fill: #0f172a; }
      .marker-inner { fill: #f8fafc; }
      .marker-dot { fill: #0f172a; }
      .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 800; fill: #0f172a; text-anchor: middle; }
      .subtitle { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; fill: #2563eb; text-anchor: middle; }
      .badge-bg { fill: #fef3c7; stroke: #f59e0b; stroke-width: 1.5; }
      .badge-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; fill: #b45309; text-anchor: middle; }
      .instr { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; fill: #475569; text-anchor: middle; }
      .path-box { fill: #e2e8f0; rx: 6; }
      .path-text { font-family: monospace; font-size: 12px; font-weight: 700; fill: #0f172a; text-anchor: middle; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="500" height="500" rx="20" class="bg" />
  <rect x="20" y="20" width="460" height="460" rx="16" class="border" />

  <!-- QR Outer Corner Finders -->
  <!-- Top Left -->
  <rect x="50" y="50" width="70" height="70" rx="8" class="marker-outer" />
  <rect x="62" y="62" width="46" height="46" rx="4" class="marker-inner" />
  <rect x="74" y="74" width="22" height="22" rx="2" class="marker-dot" />

  <!-- Top Right -->
  <rect x="380" y="50" width="70" height="70" rx="8" class="marker-outer" />
  <rect x="392" y="62" width="46" height="46" rx="4" class="marker-inner" />
  <rect x="404" y="74" width="22" height="22" rx="2" class="marker-dot" />

  <!-- Bottom Left -->
  <rect x="50" y="380" width="70" height="70" rx="8" class="marker-outer" />
  <rect x="62" y="392" width="46" height="46" rx="4" class="marker-inner" />
  <rect x="74" y="404" width="22" height="22" rx="2" class="marker-dot" />

  <!-- Center Card Content -->
  <!-- Status Badge -->
  <rect x="130" y="150" width="240" height="34" rx="17" class="badge-bg" />
  <text x="250" y="172" class="badge-text">&#9888; CONFIGURATION REQUIRED</text>

  <!-- Title -->
  <text x="250" y="220" class="title">K3L RENTALS &#8226; UPI QR CODE</text>
  <text x="250" y="244" class="subtitle">Awaiting Genuine Merchant QR Code Image</text>

  <!-- Instructions -->
  <text x="250" y="285" class="instr">Please upload your receiving bank/UPI QR code image to:</text>

  <!-- File Path Box -->
  <rect x="80" y="300" width="340" height="34" rx="6" class="path-box" />
  <text x="250" y="322" class="path-text">frontend/assets/payment-qr.png</text>

  <text x="250" y="360" class="instr">Payment activation will unlock once the genuine QR is saved.</text>
</svg>`;

fs.writeFileSync(path.join(dir, 'payment-qr.svg'), svgContent);
console.log('Created frontend/assets/payment-qr.svg');

// Generate minimal uncompressed valid PNG with placeholder notice
function generatePlaceholderPng(width, height) {
    // PNG Signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // 8-bit depth
    ihdrData[9] = 2; // RGB
    ihdrData[10] = 0; // deflate
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // no interlace

    function makeChunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const typeAndData = Buffer.concat([Buffer.from(type), data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(calcCrc(typeAndData), 0);
        return Buffer.concat([len, typeAndData, crc]);
    }

    // CRC Table
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            if (c & 1) c = 0xedb88320 ^ (c >>> 1);
            else c = c >>> 1;
        }
        crcTable[n] = c;
    }

    function calcCrc(buf) {
        let crc = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    const ihdrChunk = makeChunk('IHDR', ihdrData);

    // Create a 400x400 RGB image (light gray background with dark borders)
    const rawRows = [];
    for (let y = 0; y < height; y++) {
        const row = Buffer.alloc(1 + width * 3);
        row[0] = 0; // filter type: None
        for (let x = 0; x < width; x++) {
            const isBorder = x < 8 || x >= width - 8 || y < 8 || y >= height - 8;
            // Draw 3 corner finder boxes
            const isTL = (x >= 24 && x <= 72 && y >= 24 && y <= 72);
            const isTR = (x >= width - 72 && x <= width - 24 && y >= 24 && y <= 72);
            const isBL = (x >= 24 && x <= 72 && y >= height - 72 && y <= height - 24);

            let r = 248, g = 250, b = 252; // #f8fafc
            if (isBorder || isTL || isTR || isBL) {
                // Outer ring
                const inTLInner = (x >= 36 && x <= 60 && y >= 36 && y <= 60);
                const inTLDot = (x >= 44 && x <= 52 && y >= 44 && y <= 52);

                const inTRInner = (x >= width - 60 && x <= width - 36 && y >= 36 && y <= 60);
                const inTRDot = (x >= width - 52 && x <= width - 44 && y >= 44 && y <= 52);

                const inBLInner = (x >= 36 && x <= 60 && y >= height - 60 && y <= height - 36);
                const inBLDot = (x >= 44 && x <= 52 && y >= height - 52 && y <= height - 44);

                if (inTLDot || inTRDot || inBLDot) {
                    r = 15; g = 23; b = 42; // #0f172a
                } else if (inTLInner || inTRInner || inBLInner) {
                    r = 248; g = 250; b = 252;
                } else {
                    r = 15; g = 23; b = 42;
                }
            } else if (y >= 140 && y <= 260 && x >= 40 && x <= width - 40) {
                // Amber center placeholder banner
                r = 254; g = 243; b = 199; // #fef3c7
            }
            const offset = 1 + x * 3;
            row[offset] = r;
            row[offset + 1] = g;
            row[offset + 2] = b;
        }
        rawRows.push(row);
    }

    const rawData = Buffer.concat(rawRows);
    const compressedData = zlib.deflateSync(rawData);
    const idatChunk = makeChunk('IDAT', compressedData);
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const pngBuf = generatePlaceholderPng(400, 400);
fs.writeFileSync(path.join(dir, 'payment-qr.png'), pngBuf);
console.log('Created frontend/assets/payment-qr.png (' + pngBuf.length + ' bytes)');

