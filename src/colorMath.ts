export type HsbColor = [h: number, s: number, b: number];
export type RgbColor = [r: number, g: number, b: number];
export type LabColor = [l: number, a: number, b: number];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round2 = (value: number) => Math.round(value * 100) / 100;

export function hsbToRgb(h: number, s: number, b: number): RgbColor {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(b, 0, 100) / 100;
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - chroma;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hue < 60) [rp, gp, bp] = [chroma, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, chroma, 0];
  else if (hue < 180) [rp, gp, bp] = [0, chroma, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, chroma];
  else if (hue < 300) [rp, gp, bp] = [x, 0, chroma];
  else [rp, gp, bp] = [chroma, 0, x];

  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

export function rgbCss([r, g, b]: RgbColor): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function hsbCss(color: HsbColor): string {
  return rgbCss(hsbToRgb(...color));
}

export function luminance([r, g, b]: RgbColor): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function readableTextColor(rgb: RgbColor): string {
  return luminance(rgb) > 0.45 ? "#000" : "#fff";
}

export function readableSoftTextColor(rgb: RgbColor): string {
  return luminance(rgb) > 0.45 ? "rgba(0,0,0,0.58)" : "rgba(255,255,255,0.66)";
}

export function rgbToLab(r: number, g: number, b: number): LabColor {
  const linear = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value > 0.04045
      ? Math.pow((value + 0.055) / 1.055, 2.4)
      : value / 12.92;
  });

  const x = linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505;

  const normalized = [x / 0.95047, y / 1, z / 1.08883].map((value) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116,
  );

  return [
    116 * normalized[1] - 16,
    500 * (normalized[0] - normalized[1]),
    200 * (normalized[1] - normalized[2]),
  ];
}

export function deltaE2000(lab1: LabColor, lab2: LabColor): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;
  const avgLp = (l1 + l2) / 2;
  const c1 = Math.sqrt(a1 * a1 + b1 * b1);
  const c2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (c1 + c2) / 2;
  const g =
    0.5 *
    (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.sqrt(a1p * a1p + b1 * b1);
  const c2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (c1p + c2p) / 2;
  const h1p = hueAngle(b1, a1p);
  const h2p = hueAngle(b2, a2p);
  const dhp = deltaHue(h1p, h2p, c1p, c2p);
  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(degToRad(dhp / 2));
  const avgHp = averageHue(h1p, h2p, c1p, c2p);
  const t =
    1 -
    0.17 * Math.cos(degToRad(avgHp - 30)) +
    0.24 * Math.cos(degToRad(2 * avgHp)) +
    0.32 * Math.cos(degToRad(3 * avgHp + 6)) -
    0.2 * Math.cos(degToRad(4 * avgHp - 63));
  const deltaTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const rc =
    2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const sl =
    1 +
    (0.015 * Math.pow(avgLp - 50, 2)) /
      Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;
  const rt = -Math.sin(degToRad(2 * deltaTheta)) * rc;

  return Math.sqrt(
    Math.pow(dLp / sl, 2) +
      Math.pow(dCp / sc, 2) +
      Math.pow(dHp / sh, 2) +
      rt * (dCp / sc) * (dHp / sh),
  );
}

export function scoreHsb(
  picked: HsbColor,
  target: HsbColor,
  jitter = true,
): number {
  const pickedRgb = hsbToRgb(...picked);
  const targetRgb = hsbToRgb(...target);
  const dE = deltaE2000(
    rgbToLab(...pickedRgb),
    rgbToLab(...targetRgb),
  );
  const base = 10 / (1 + Math.pow(dE / 25.25, 1.55));
  const hueDiff = Math.min(
    Math.abs(picked[0] - target[0]),
    360 - Math.abs(picked[0] - target[0]),
  );
  const avgSat = (picked[1] + target[1]) / 2;
  const hueAcc = Math.max(0, 1 - Math.pow(hueDiff / 25, 1.5));
  const satWeightR = Math.min(1, avgSat / 30);
  const recovery = (10 - base) * hueAcc * satWeightR * 0.25;
  const huePenFactor = Math.max(0, (hueDiff - 30) / 150);
  const satWeightP = Math.min(1, avgSat / 40);
  const penalty = base * huePenFactor * satWeightP * 0.15;
  const raw = base + recovery - penalty;
  const noise = jitter && raw < 9.8 ? (Math.random() - 0.5) * 0.08 : 0;

  return round2(clamp(raw + noise, 0, 10));
}

function hueAngle(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const angle = radToDeg(Math.atan2(y, x));
  return angle >= 0 ? angle : angle + 360;
}

function deltaHue(h1: number, h2: number, c1: number, c2: number): number {
  if (c1 * c2 === 0) return 0;
  const diff = h2 - h1;
  if (Math.abs(diff) <= 180) return diff;
  return diff > 180 ? diff - 360 : diff + 360;
}

function averageHue(h1: number, h2: number, c1: number, c2: number): number {
  if (c1 * c2 === 0) return h1 + h2;
  if (Math.abs(h1 - h2) <= 180) return (h1 + h2) / 2;
  return h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
