const FILL_RE = /\sfill\s*=\s*"([^"]*)"/gi;
const STROKE_RE = /\sstroke\s*=\s*"([^"]*)"/gi;

function replaceAttr(
  svg: string,
  re: RegExp,
  transform: (value: string) => string,
): string {
  return svg.replace(re, (match, value: string) =>
    match.replace(`"${value}"`, `"${transform(value)}"`),
  );
}

function fillAll(svg: string, color: string, mode: "override" | "current"): string {
  let out = replaceAttr(svg, FILL_RE, (value) => {
    if (value === "none") return value;
    if (mode === "current") return value.startsWith("url(") ? value : "currentColor";
    return color;
  });
  out = replaceAttr(out, STROKE_RE, (value) => {
    if (value === "none") return value;
    if (mode === "current") return value.startsWith("url(") ? value : "currentColor";
    return color;
  });
  return out;
}

export function blackVariant(svg: string): string {
  let out = fillAll(svg, "#000000", "override");
  if (!FILL_RE.test(out) && !STROKE_RE.test(out)) {
    out = out.replace("<svg", `<svg fill="#000000" stroke="#000000"`);
  }
  return out;
}

export function whiteVariant(svg: string): string {
  let out = fillAll(svg, "#ffffff", "override");
  if (!FILL_RE.test(out) && !STROKE_RE.test(out)) {
    out = out.replace("<svg", `<svg fill="#ffffff" stroke="#ffffff"`);
  }
  return out;
}

export function currentColorVariant(svg: string): string {
  return fillAll(svg, "", "current");
}

export function stripMetadata(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/g, "")
    .replace(/\s+xmlns:[\w-]+="[^"]*"/g, "")
    .replace(/<!--\s*Generator[^>]*-->/g, "")
    .trim();
}

export function ensureViewBox(svg: string): string {
  if (/viewBox=/.test(svg)) return svg;
  const wMatch = svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/);
  const hMatch = svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/);
  if (!wMatch || !hMatch) return svg;
  const w = wMatch[1];
  const h = hMatch[1];
  return svg.replace(/<svg/, `<svg viewBox="0 0 ${w} ${h}"`);
}
