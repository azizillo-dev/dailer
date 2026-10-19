/** Hafta kartasi — vazifalar × kunlar jadvali rasmi (canvas, 1080 kenglik). */

type GridRow = {
  title: string;
  cells: { state: string; progress: number | null }[];
  done: number;
  scheduled: number;
  unit: string | null;
  value: number | null;
  value_target: number | null;
};
type GridData = {
  rows: GridRow[];
  days: { score: number | null }[];
  completion: number | null;
  checkins: number;
  checkins_delta_pct: number | null;
  perfect_days: number;
  best_streak: { title: string; days: number } | null;
};
export type WeekCardText = {
  title: string;
  range: string;
  dayNames: string[];
  labels: {
    completion: string;
    checkins: string;
    bestStreak: string;
    perfect: string;
    habit: string;
    done: string;
    days: string;
    delta: string;
    vs: string;
    made: string;
  };
};

const W = 1080;
const C = {
  bg: "#fff8ef",
  card: "#ffffff",
  line: "#f1e3d2",
  ink: "#2a1f17",
  soft: "#6e5b4c",
  faint: "#a3907f",
  green: "#2f9e6b",
  accent: "#f28c45",
  deep: "#c4571e",
  danger: "#d9483b",
};

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function trimText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Balandlik vazifalar soniga qarab (kamida kvadrat). */
export async function renderWeekCard(d: GridData, tx: WeekCardText): Promise<Blob> {
  await document.fonts.ready;
  const rows = d.rows.slice(0, 16);
  // Vazifa ko'p bo'lsa qatorlar zichroq
  const ROW = rows.length > 12 ? 60 : 72;
  const top = 270;
  const cardH = 90 + rows.length * ROW + 20;
  const H = Math.max(1080, top + cardH + 28 + 230 + 110);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const serif = getComputedStyle(document.body).getPropertyValue("--font-fraunces") || "Georgia";
  const sans = getComputedStyle(document.body).getPropertyValue("--font-manrope") || "Arial";

  // Fon
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 120, 60, 0, W - 120, 60, 520);
  glow.addColorStop(0, "rgba(242,140,69,0.28)");
  glow.addColorStop(1, "rgba(242,140,69,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Logo va sarlavha
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(92, 96, 22, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = C.ink;
  box(ctx, 66, 104, 52, 6, 3);
  ctx.fill();
  ctx.font = `600 34px ${serif}`;
  ctx.fillText("Dailer", 132, 108);
  ctx.font = `600 84px ${serif}`;
  ctx.fillText(tx.title, 64, 220);
  ctx.textAlign = "right";
  ctx.font = `600 30px ${sans}`;
  ctx.fillStyle = C.soft;
  ctx.fillText(tx.range, W - 64, 214);
  ctx.textAlign = "left";

  // Jadval kartasi
  ctx.fillStyle = C.card;
  box(ctx, 48, top, W - 96, cardH, 36);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  const colX = (i: number) => 472 + i * 56;
  const doneX = W - 80;
  ctx.font = `700 22px ${sans}`;
  ctx.fillStyle = C.faint;
  ctx.fillText(tx.labels.habit.toUpperCase(), 80, top + 56);
  ctx.textAlign = "center";
  tx.dayNames.forEach((n, i) => ctx.fillText(n.slice(0, 2).toUpperCase(), colX(i), top + 56));
  ctx.textAlign = "right";
  ctx.fillText(tx.labels.done.toUpperCase(), doneX, top + 56);
  ctx.textAlign = "left";

  rows.forEach((r, ri) => {
    const y = top + 90 + ri * ROW;
    const cy = y + ROW / 2;
    if (ri > 0) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(72, y);
      ctx.lineTo(W - 72, y);
      ctx.stroke();
    }
    ctx.font = `700 30px ${sans}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(trimText(ctx, r.title, 340), 80, cy + 10);

    r.cells.forEach((c, i) => {
      const x = colX(i);
      if (c.state === "off") {
        ctx.fillStyle = C.line;
        ctx.beginPath();
        ctx.arc(x, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (c.state === "done") {
        ctx.fillStyle = C.green;
        ctx.beginPath();
        ctx.arc(x, cy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x - 8, cy + 1);
        ctx.lineTo(x - 2, cy + 7);
        ctx.lineTo(x + 9, cy - 6);
        ctx.stroke();
        return;
      }
      ctx.globalAlpha = c.state === "future" ? 0.4 : 1;
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
      const p = c.progress ?? (c.state === "partial" ? 0.5 : 0);
      if (p > 0) {
        ctx.strokeStyle = C.green;
        ctx.lineWidth = 4.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(x, cy, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    const measured = r.value_target != null;
    const complete = measured ? (r.value ?? 0) >= (r.value_target ?? 0) : r.scheduled > 0 && r.done >= r.scheduled;
    ctx.textAlign = "right";
    ctx.font = `800 30px ${sans}`;
    ctx.fillStyle = complete ? C.green : C.ink;
    const label = measured ? `${fmt(r.value ?? 0)}/${fmt(r.value_target ?? 0)}` : `${r.done}/${r.scheduled}${complete ? " ✓" : ""}`;
    ctx.fillText(label, doneX, measured ? cy + 2 : cy + 10);
    if (measured && r.unit) {
      ctx.font = `600 18px ${sans}`;
      ctx.fillStyle = C.faint;
      ctx.fillText(r.unit, doneX, cy + 26);
    }
    ctx.textAlign = "left";
  });

  // Xulosa kartasi
  const sy = top + cardH + 28;
  ctx.fillStyle = C.card;
  box(ctx, 48, sy, W - 96, 230, 36);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  const stats: [string, string, string][] = [
    [d.completion == null ? "–" : `${Math.round(d.completion)}%`, tx.labels.completion, C.green],
    [fmt(d.checkins), tx.labels.checkins, C.ink],
    [d.best_streak ? `${d.best_streak.days}` : "–", tx.labels.bestStreak, C.deep],
    [String(d.perfect_days), tx.labels.perfect, C.ink],
  ];
  stats.forEach(([v, l, color], i) => {
    const x = 84 + i * 160;
    ctx.font = `600 64px ${serif}`;
    ctx.fillStyle = color;
    ctx.fillText(v, x, sy + 96);
    // Yorliq ikki qatorga bo'linadi (qisqartirilmaydi)
    ctx.font = `600 21px ${sans}`;
    ctx.fillStyle = C.soft;
    wrapLines(ctx, l, 148).slice(0, 2).forEach((line, li) => ctx.fillText(line, x, sy + 128 + li * 25));
  });
  if (tx.labels.delta) {
    const up = (d.checkins_delta_pct ?? 0) >= 0;
    ctx.font = `700 24px ${sans}`;
    ctx.fillStyle = up ? C.green : C.danger;
    ctx.fillText(`${up ? "▲" : "▼"} ${tx.labels.delta}`, 84, sy + 204);
  }

  // Kunlar ustunchalari
  const bx = 760;
  d.days.forEach((day, i) => {
    const x = bx + i * 36;
    const h = 120;
    ctx.fillStyle = C.line;
    box(ctx, x, sy + 40, 26, h, 8);
    ctx.fill();
    const s = Math.min(1, (day.score ?? 0) / 100);
    if (s > 0) {
      ctx.fillStyle = s >= 1 ? C.green : C.accent;
      box(ctx, x, sy + 40 + h * (1 - s), 26, h * s, 8);
      ctx.fill();
    }
    ctx.font = `700 18px ${sans}`;
    ctx.fillStyle = C.faint;
    ctx.textAlign = "center";
    ctx.fillText(tx.dayNames[i].slice(0, 1).toUpperCase(), x + 13, sy + 190);
    ctx.textAlign = "left";
  });

  ctx.font = `600 22px ${sans}`;
  ctx.fillStyle = C.faint;
  ctx.fillText(tx.labels.made, 64, H - 44);
  ctx.textAlign = "right";
  ctx.fillText("dailer-seven.vercel.app", W - 64, H - 44);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}
