import { questionWorkflowError as fail } from "./questionWorkflow";

/** Validate supported container headers; editorial review still inspects the image. */
export function imageDimensions(bytes: Uint8Array, mediaType: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (
    mediaType === "image/png" &&
    bytes.length >= 33 &&
    bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10" &&
    view.getUint32(8) === 13 &&
    tag(12, 4) === "IHDR"
  )
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (
    mediaType === "image/webp" &&
    bytes.length >= 30 &&
    tag(0, 4) === "RIFF" &&
    tag(8, 4) === "WEBP" &&
    view.getUint32(4, true) + 8 === bytes.length
  ) {
    if (tag(12, 4) === "VP8X")
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    if (
      tag(12, 4) === "VP8 " &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    )
      return {
        width: view.getUint16(26, true) & 16383,
        height: view.getUint16(28, true) & 16383,
      };
    if (tag(12, 4) === "VP8L" && bytes[20] === 47)
      return {
        width: 1 + bytes[21] + ((bytes[22] & 63) << 8),
        height:
          1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10),
      };
  }
  return fail("VALIDATION_FAILED");
}
