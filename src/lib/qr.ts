import QRCode from "qrcode";

const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#15120e", light: "#ffffff" } };

export function qrSvg(text: string) {
  return QRCode.toString(text, { ...opts, type: "svg" });
}

export function qrPng(text: string, width = 1200) {
  return QRCode.toBuffer(text, { ...opts, type: "png", width });
}
