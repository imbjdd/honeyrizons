import { cn } from "@/lib/utils";
import { countryName } from "./data";

// Flags drawn for a circular crop, so emblems stay centered. Only URLs are bundled; each SVG loads on demand.
const FLAGS = import.meta.glob<string>("/node_modules/circle-flags/flags/*.svg", { query: "?url", import: "default", eager: true });

const flagUrl = (code: string) => FLAGS[`/node_modules/circle-flags/flags/${code.toLowerCase()}.svg`];

export function CountryFlag({ code, size = 16, className }: { code: string; size?: number; className?: string }) {
  const url = code ? flagUrl(code) : undefined;
  const label = countryName(code);
  if (!url) return <span className={cn("flag flag-empty", className)} style={{ width: size, height: size }} role="img" aria-label={label} />;
  return <img src={url} alt={label} title={label} width={size} height={size} className={cn("flag", className)} loading="lazy" decoding="async" />;
}

export { flagUrl };
