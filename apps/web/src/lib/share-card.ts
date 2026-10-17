/** Haftalik natijadan Instagram story (1080×1920) rasm — brauzerda canvas bilan chiziladi. */

export type ShareData = {
  title: string;
  score: number | null;
  scoreLabel: string;
  streak: number;
  streakLabel: string;
  range: string;
  categories: { label: string; score: number | null }[];
  goal: string | null;
  motto: string;
};

const W = 1080;
const H = 1920;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number, value: number) {
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = "rgba(247,240,230,0.15)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#e8b984";
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, Math.min(1, value)));
  ctx.stroke();
}

export async function renderShareCard(d: ShareData): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const serif = getComputedStyle(document.body).getPropertyValue("--font-fraunces") || "Georgia";
  const sans = getComputedStyle(document.body).getPropertyValue("--font-manrope") || "Arial";

  // Fon
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2b1d14");
  g.addColorStop(0.6, "#3a2719");
  g.addColorStop(1, "#6b4e3d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 260, 0, W * 0.85, 260, 520);
  glow.addColorStop(0, "rgba(192,133,82,0.45)");
  glow.addColorStop(1, "rgba(192,133,82,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Logo
  ctx.fillStyle = "#c08552";
  ctx.beginPath();
  ctx.arc(120, 170, 34, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#f7f0e6";
  ctx.fillRect(80, 182, 80, 8);
  ctx.font = `600 52px ${serif}`;
  ctx.fillText("Dailer", 180, 190);

  ctx.font = `700 34px ${sans}`;
  ctx.fillStyle = "#e8b984";
  ctx.fillText(d.title.toUpperCase(), 80, 330);
  ctx.font = `500 34px ${sans}`;
  ctx.fillStyle = "rgba(247,240,230,0.7)";
  ctx.fillText(d.range, 80, 380);

  // Katta halqa va ball
  ring(ctx, W / 2, 720, 250, 38, (d.score ?? 0) / 100);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f7f0e6";
  ctx.font = `400 200px ${serif}`;
  ctx.fillText(d.score == null ? "–" : `${Math.round(d.score)}`, W / 2, 770);
  ctx.font = `600 36px ${sans}`;
  ctx.fillStyle = "rgba(247,240,230,0.7)";
  ctx.fillText(`% ${d.scoreLabel}`, W / 2, 840);

  // Streak
  ctx.font = `400 96px ${serif}`;
  ctx.fillStyle = "#f7f0e6";
  ctx.fillText(`🔥 ${d.streak}`, W / 2, 1110);
  ctx.font = `600 34px ${sans}`;
  ctx.fillStyle = "rgba(247,240,230,0.7)";
  ctx.fillText(d.streakLabel, W / 2, 1165);

  // Yo'nalishlar
  const cats = d.categories.slice(0, 4);
  const step = W / (cats.length + 1);
  cats.forEach((c, i) => {
    const x = step * (i + 1);
    ring(ctx, x, 1340, 70, 14, (c.score ?? 0) / 100);
    ctx.font = `600 40px ${sans}`;
    ctx.fillStyle = "#f7f0e6";
    ctx.fillText(c.score == null ? "–" : `${Math.round(c.score)}%`, x, 1354);
    ctx.font = `600 28px ${sans}`;
    ctx.fillStyle = "rgba(247,240,230,0.7)";
    ctx.fillText(c.label, x, 1460);
  });

  // Maqsad va shior
  ctx.font = `italic 400 46px ${serif}`;
  ctx.fillStyle = "#f7f0e6";
  let y = 1620;
  if (d.goal) {
    for (const line of wrap(ctx, `“${d.goal}”`, W - 200).slice(0, 2)) {
      ctx.fillText(line, W / 2, y);
      y += 60;
    }
  }
  ctx.font = `700 30px ${sans}`;
  ctx.fillStyle = "#e8b984";
  ctx.fillText(d.motto, W / 2, H - 110);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

export async function shareOrDownload(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
  } catch {
    // foydalanuvchi bekor qildi — yuklab olishga o'tmaymiz
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
