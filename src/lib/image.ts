// Shrinks photos in the browser before upload: keeps handwriting readable,
// cuts API cost, and stays well under Vercel's 4.5 MB request limit.
const MAX_SIDE = 1600;

export async function toJpegBase64(source: Blob | HTMLCanvasElement): Promise<string> {
  let canvas: HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  }
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}
