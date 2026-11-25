/** WCAG contrast between two #RRGGBB colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Bars are graphics: a fill must stand 3:1 against its track, or it gets an outline (DESIGN.md, Bars). */
export const BAR_MIN_CONTRAST = 3;

export function barNeedsOutline(fill: string, track: string): boolean {
  return contrastRatio(fill, track) < BAR_MIN_CONTRAST;
}
