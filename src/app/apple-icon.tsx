import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a78d6"/><path d="M17 30.5 32 18l15 12.5V46a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3Z" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round"/><circle cx="32" cy="37.5" r="5.5" fill="#fff"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={180} height={180} alt="" />,
    size,
  );
}
