import fs from "fs";

function readUInt16BE(buf, offset) {
  return (buf[offset] << 8) | buf[offset + 1];
}

function parsePng(buf) {
  // PNG header 8 bytes, then IHDR chunk: length(4) 'IHDR'(4) width(4) height(4)
  const pngSig = Buffer.from([137,80,78,71,13,10,26,10]);
  if (buf.length < 24 || !buf.slice(0,8).equals(pngSig)) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function parseJpeg(buf) {
  // JPEG: find SOF0/2 markers 0xFFC0..0xFFC3 etc to get height/width
  let offset = 2; // skip SOI
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xFF) return null;
    const marker = buf[offset + 1];
    const length = readUInt16BE(buf, offset + 2);
    if (marker >= 0xC0 && marker <= 0xC3) {
      const height = readUInt16BE(buf, offset + 5);
      const width = readUInt16BE(buf, offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

function parseGif(buf) {
  // GIF: first 6 bytes header, then Logical Screen Descriptor width/height 2 bytes each (little-endian)
  if (buf.length < 10) return null;
  const header = buf.slice(0,6).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return { width, height };
}

function parseWebP(buf) {
  // RIFF WEBP
  if (buf.length < 16) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunkType = buf.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    if (buf.length < 30) return null;
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunkType === "VP8 ") {
    // Lossy bitstream. Width/height are in frame header, parse roughly.
    // Minimal check: not trivial to parse fully here; skip.
    return null;
  }
  if (chunkType === "VP8L") {
    if (buf.length < 25) return null;
    const b0 = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
    const width = (b0 & 0x3FFF) + 1;
    const height = ((b0 >> 14) & 0x3FFF) + 1;
    return { width, height };
  }
  return null;
}

export function getImageSizeSync(filePath, maxRead = 200000) {
  const fd = fs.openSync(filePath, "r");
  try {
    const stat = fs.fstatSync(fd);
    const len = Math.min(stat.size, maxRead);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return parsePng(buf) || parseJpeg(buf) || parseGif(buf) || parseWebP(buf);
  } finally {
    fs.closeSync(fd);
  }
}

export function ensureMinSizeOrThrow(filePath, minW = 600, minH = 600) {
  const size = getImageSizeSync(filePath);
  if (!size || !size.width || !size.height) {
    const err = new Error("invalid_image");
    err.code = "INVALID_IMAGE";
    throw err;
  }
  if (size.width < minW || size.height < minH) {
    const err = new Error("image_too_small");
    err.code = "IMAGE_TOO_SMALL";
    err.width = size.width;
    err.height = size.height;
    throw err;
  }
  return size;
}

