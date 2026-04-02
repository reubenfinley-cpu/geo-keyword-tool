import { useRef, useEffect } from "react";

const TEAL = "#085041";
const AMBER = "#633806";

function simColor(s) { return s >= 0.80 ? TEAL : s >= 0.65 ? AMBER : "#888"; }
function simBg(s)    { return s >= 0.80 ? "#E1F5EE" : s >= 0.65 ? "#FAEEDA" : "#f5f5f5"; }

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
}

// Custom hook: runs an animation loop, cleans up on unmount
function useAnim(drawFn) {
  const canvasRef = useRef(null);
  const frameRef  = useRef(0);
  const rafRef    = useRef(null);
  const drawRef   = useRef(drawFn);
  drawRef.current = drawFn;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    frameRef.current = 0;
    const loop = () => {
      drawRef.current(ctx, canvas, frameRef.current++);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return canvasRef;
}

const cvStyle = {
  width: "100%", display: "block",
  borderRadius: 10, border: "0.5px solid #e5e5e5", background: "#fff",
};

// ── Section A: Prompt dots drifting around a centroid ───────────────────────
const CENTROID_DOTS = Array.from({ length: 13 }, (_, i) => {
  const a = (i / 13) * Math.PI * 2;
  const r = 38 + (i % 4) * 14;
  return {
    ox: 300 + Math.cos(a) * r,
    oy: 100 + Math.sin(a) * r * 0.65,
    phase: i * 0.48,
    speed: 0.38 + (i % 5) * 0.09,
    drift: 10 + (i % 3) * 4,
  };
});

function CentroidViz() {
  const ref = useAnim((ctx, _canvas, f) => {
    const t = f * 0.016;
    ctx.clearRect(0, 0, 600, 200);

    const pts = CENTROID_DOTS.map(d => ({
      x: d.ox + Math.sin(t * d.speed + d.phase) * d.drift,
      y: d.oy + Math.cos(t * d.speed * 0.72 + d.phase) * d.drift * 0.6,
    }));

    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    // Lines centroid → dots
    ctx.strokeStyle = "#cce8df";
    ctx.lineWidth = 1;
    pts.forEach(p => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke();
    });

    // Prompt dots
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#c0c0c0"; ctx.fill();
      if (i === 2) {
        ctx.font = "10px -apple-system,BlinkMacSystemFont,sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText("prompt", p.x + 7, p.y + 4);
      }
    });

    // Centroid (pulsing)
    const pulse = 1 + Math.sin(t * 2.6) * 0.16;
    ctx.beginPath(); ctx.arc(cx, cy, 8 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = TEAL; ctx.fill();
    ctx.font = "bold 10px -apple-system,BlinkMacSystemFont,sans-serif";
    ctx.fillStyle = TEAL;
    ctx.fillText("centroid", cx + 12, cy + 4);
  });

  return <canvas ref={ref} width={600} height={200} style={cvStyle} />;
}

// ── Section B: Cosine similarity — vectors from origin ──────────────────────
const KW_ITEMS = [
  { angle: -0.16, label: "brand platform",    score: 0.87 },
  { angle:  0.32, label: "content tools",     score: 0.79 },
  { angle:  0.64, label: "workflow mgmt",     score: 0.71 },
  { angle: -0.58, label: "brand guidelines",  score: 0.67 },
  { angle:  1.08, label: "project planning",  score: 0.55 },
  { angle: -1.12, label: "team onboarding",   score: 0.43 },
];
const B_OX = 145, B_OY = 100, B_LEN = 125, B_CYCLE = 290;

function SimilarityViz() {
  const ref = useAnim((ctx, _canvas, f) => {
    const frame = f % B_CYCLE;
    ctx.clearRect(0, 0, 600, 200);

    // Origin dot
    ctx.beginPath(); ctx.arc(B_OX, B_OY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ccc"; ctx.fill();

    // Centroid vector (always visible)
    const cex = B_OX + B_LEN * 1.3;
    ctx.beginPath(); ctx.moveTo(B_OX, B_OY); ctx.lineTo(cex, B_OY);
    ctx.strokeStyle = TEAL; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cex, B_OY);
    ctx.lineTo(cex - 8, B_OY - 4); ctx.lineTo(cex - 8, B_OY + 4);
    ctx.closePath(); ctx.fillStyle = TEAL; ctx.fill();
    ctx.font = "11px -apple-system,BlinkMacSystemFont,sans-serif";
    ctx.fillStyle = TEAL;
    ctx.fillText("centroid", cex + 6, B_OY + 4);

    // Keyword vectors, staggered
    KW_ITEMS.forEach((kw, i) => {
      const start = 28 + i * 34;
      if (frame < start) return;
      const prog  = Math.min(1, (frame - start) / 22);
      const color = simColor(kw.score);

      const kx = B_OX + Math.cos(kw.angle) * B_LEN;
      const ky = B_OY + Math.sin(kw.angle) * B_LEN;
      const ex = B_OX + Math.cos(kw.angle) * B_LEN * prog;
      const ey = B_OY + Math.sin(kw.angle) * B_LEN * prog;

      // Arc showing angle gap (only once arrow is fully drawn)
      if (prog >= 0.99) {
        ctx.beginPath();
        ctx.arc(B_OX, B_OY, 26,
          Math.min(0, kw.angle), Math.max(0, kw.angle), false);
        ctx.strokeStyle = color + "55"; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Arrow shaft
      ctx.beginPath(); ctx.moveTo(B_OX, B_OY); ctx.lineTo(ex, ey);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();

      // Arrowhead
      if (prog >= 0.99) {
        const a = kw.angle;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(kx - 7 * Math.cos(a - 0.42), ky - 7 * Math.sin(a - 0.42));
        ctx.lineTo(kx - 7 * Math.cos(a + 0.42), ky - 7 * Math.sin(a + 0.42));
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();

        // Score pill
        const px = kx + Math.cos(kw.angle) * 18;
        const py = ky + Math.sin(kw.angle) * 14;
        ctx.font = "bold 10px -apple-system,BlinkMacSystemFont,sans-serif";
        const tw = ctx.measureText(kw.score.toFixed(2)).width;
        fillRoundRect(ctx, px - 4, py - 10, tw + 10, 15, 6, simBg(kw.score));
        ctx.fillStyle = color;
        ctx.fillText(kw.score.toFixed(2), px, py);
      }
    });
  });

  return <canvas ref={ref} width={600} height={200} style={cvStyle} />;
}

// ── Section C: Seed expansion ────────────────────────────────────────────────
const SEEDS = [
  { x: 95,  y: 52,  label: "brand platform"   },
  { x: 95,  y: 105, label: "content workflow"  },
  { x: 95,  y: 160, label: "asset management"  },
];
const KW_NODES = [
  { si: 0, tx: 350, ty: 28,  label: "brand portal software"  },
  { si: 0, tx: 350, ty: 55,  label: "brand guidelines tool"  },
  { si: 0, tx: 490, ty: 40,  label: "brand management app"   },
  { si: 1, tx: 350, ty: 94,  label: "content ops platform"   },
  { si: 1, tx: 350, ty: 120, label: "creative workflow tool"  },
  { si: 1, tx: 490, ty: 107, label: "content calendar"       },
  { si: 2, tx: 350, ty: 149, label: "DAM software"           },
  { si: 2, tx: 350, ty: 175, label: "digital asset platform" },
  { si: 2, tx: 490, ty: 162, label: "media management"       },
];
const C_CYCLE = 250;

function ExpansionViz() {
  const ref = useAnim((ctx, _canvas, f) => {
    const frame = f % C_CYCLE;
    ctx.clearRect(0, 0, 620, 210);

    // Seed pills
    SEEDS.forEach((s, i) => {
      const alpha = Math.min(1, (frame - i * 8) / 18);
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.font = "bold 11px -apple-system,BlinkMacSystemFont,sans-serif";
      const tw = ctx.measureText(s.label).width;
      fillRoundRect(ctx, s.x - 8, s.y - 11, tw + 18, 20, 8, "#E1F5EE");
      ctx.fillStyle = TEAL;
      ctx.fillText(s.label, s.x + 1, s.y + 2);
      ctx.globalAlpha = 1;
    });

    // Expanding keyword lines + nodes
    KW_NODES.forEach((n, i) => {
      const start = 40 + i * 18;
      if (frame < start) return;
      const prog  = Math.min(1, (frame - start) / 22);
      const alpha = Math.min(1, (frame - start - 8) / 14);
      const seed  = SEEDS[n.si];

      const lx = seed.x + (n.tx - seed.x) * prog;
      const ly = seed.y + (n.ty - seed.y) * prog;
      ctx.beginPath(); ctx.moveTo(seed.x, seed.y); ctx.lineTo(lx, ly);
      ctx.strokeStyle = "#e0e0e0"; ctx.lineWidth = 1; ctx.stroke();

      if (alpha > 0 && prog >= 0.99) {
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(n.tx, n.ty, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#bbb"; ctx.fill();
        ctx.font = "10px -apple-system,BlinkMacSystemFont,sans-serif";
        ctx.fillStyle = "#444";
        ctx.fillText(n.label, n.tx + 7, n.ty + 4);
        ctx.globalAlpha = 1;
      }
    });
  });

  return <canvas ref={ref} width={620} height={210} style={cvStyle} />;
}

// ── Main screen ──────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    num: "01",
    title: "Prompt generation & semantic centroid",
    body: "You describe a buyer pain point, persona, and journey stage. Claude generates 30 realistic prompts that person might type into an AI assistant. Each prompt is embedded as a high-dimensional vector using a sentence-transformer model — the mean of all those vectors is the centroid, representing the composite meaning of your buyer's intent.",
    Viz: CentroidViz,
  },
  {
    num: "02",
    title: "Cosine similarity scoring",
    body: "Every keyword candidate is also embedded as a vector. We score each keyword by its cosine similarity to the centroid — the cosine of the angle between the two vectors. A small angle means the keyword is semantically close to what your buyer is thinking. Scores above 0.80 are teal, 0.65-0.80 are amber, and lower-scoring keywords are grey.",
    Viz: SimilarityViz,
  },
  {
    num: "03",
    title: "DataForSEO keyword expansion",
    body: "Before scoring, Claude extracts 15 short seed terms from your prompts — software-category phrases like 'content ops platform'. DataForSEO's keyword suggestions API expands each seed into related terms with real search volume and CPC data, giving you a grounded pool of candidates to score against the centroid.",
    Viz: ExpansionViz,
  },
];

export default function HowItWorksScreen({ onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>How it works</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>The methodology behind GEO keyword scoring</div>
        </div>
        <button onClick={onBack} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #ddd", background: "#fff", cursor: "pointer" }}>
          Back to tool
        </button>
      </div>

      {SECTIONS.map(({ num, title, body, Viz }) => (
        <div key={num} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: TEAL, letterSpacing: "0.05em" }}>{num}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{title}</span>
          </div>
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.65, margin: 0 }}>{body}</p>
          <Viz />
        </div>
      ))}
    </div>
  );
}
