// Original pixel art, drawn on a 32 × 48 grid. Shared by portraits and world sprites.
const outfits = [
  "#e5ad3c",
  "#cc6a85",
  "#9a89bc",
  "#4e91a8",
  "#73a06b",
  "#ba7754",
  "#67ad9b",
  "#dc7c53",
  "#8097c4",
  "#426f85",
  "#d69bad",
  "#84abb1",
];
const skins = [
  "#edc29a",
  "#b47d59",
  "#efd1b7",
  "#cc9b76",
  "#9b674d",
  "#ddb08b",
];
export function characterCanvas(look: number, frame = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 48;
  const c = canvas.getContext("2d")!;
  const color = outfits[look % outfits.length];
  const skin = skins[look % skins.length];
  const hair = ["#4a3837", "#263e4d", "#e0cfb4", "#5d4840"][look % 4];
  const p = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const step = frame % 2;
  // Ink edge, oversized head, cropped jacket and stepped shoes.
  p(9, 33, 6, 11 - step * 2, "#283d50");
  p(18, 33, 6, 9 + step * 2, "#283d50");
  p(7, 42 - step * 2, 8, 4, "#26323f");
  p(18, 42 + step * 2, 9, 4, "#26323f");
  p(7, 22, 19, 14, "#293944");
  p(8, 23, 17, 11, color);
  p(8, 31, 17, 3, "#45646d");
  p(10, 24, 2, 6, "#f6d798");
  p(4, 24, 4, 10, "#293944");
  p(5, 25, 3, 6, color);
  p(4, 31, 4, 4, skin);
  p(25, 24, 4, 10, "#293944");
  p(25, 25, 3, 6, color);
  p(25, 31, 4, 4, skin);
  p(10, 18, 13, 7, "#293944");
  p(11, 19, 11, 5, skin);
  p(7, 7, 19, 14, "#293944");
  p(8, 8, 17, 12, skin);
  p(6, 5, 20, 7, hair);
  p(8, 3, 15, 4, hair);
  p(6, 10, 4, 9, hair);
  p(13, 12, 2, 3, "#253240");
  p(21, 12, 2, 3, "#253240");
  p(17, 18, 4, 1, "#b57a6f");
  p(11, 15, 2, 2, "#e39b87");
  p(23, 15, 2, 2, "#e39b87");
  if (look % 3 === 0) {
    p(6, 5, 21, 5, color);
    p(9, 2, 15, 5, color);
    p(20, 8, 10, 2, "#f5d06c");
  }
  if (look % 4 === 1) {
    p(11, 11, 7, 5, "#293944");
    p(19, 11, 7, 5, "#293944");
    p(18, 12, 2, 1, "#293944");
    p(12, 12, 4, 2, "#719aaf");
    p(20, 12, 4, 2, "#719aaf");
  }
  if (look % 4 === 2) {
    p(12, 24, 10, 9, "#f5e5bd");
    p(13, 26, 8, 3, color);
    p(12, 32, 10, 3, "#f5e5bd");
  }
  if (look === 4) {
    p(25, 32, 6, 8, "#bd8358");
    p(26, 29, 4, 4, "#619b68");
  }
  if (look === 1 || look === 8) {
    p(23, 30, 7, 10, "#e4bd72");
    p(24, 32, 5, 1, "#8c5c47");
    p(24, 35, 5, 1, "#8c5c47");
  }
  return canvas;
}
const portraits = new Map<number, string>();
export function portrait(look: number) {
  let src = portraits.get(look);
  if (!src) {
    src = characterCanvas(look).toDataURL();
    portraits.set(look, src);
  }
  return src;
}
