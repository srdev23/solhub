export function bufferFromUInt64(value: number | string) {
  let buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

export function readBytes(buf: Buffer, offset: number, length: number): Buffer {
  const end = offset + length;
  if (buf.byteLength < end) throw new RangeError("range out of bounds");
  return buf.subarray(offset, end);
}

export function readBigUintLE(
  buf: Buffer,
  offset: number,
  length: number
): number {
  switch (length) {
    case 1:
      return buf.readUint8(offset);
    case 2:
      return buf.readUint16LE(offset);
    case 4:
      return buf.readUint32LE(offset);
    case 8:
      return Number(buf.readBigUInt64LE(offset));
  }
  throw new Error(`unsupported data size (${length} bytes)`);
}