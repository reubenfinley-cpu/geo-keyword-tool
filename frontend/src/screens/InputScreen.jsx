import { useState } from "react";

const PERSONAS = [
  { id: "cmo", label: "CMO", desc: "Vision, budget, business outcomes" },
  { id: "marketing-dm", label: "Marketing DM", desc: "Execution, campaign performance" },
  { id: "creative-dm", label: "Creative DM", desc: "Brand, creative excellence" },
  { id: "cio", label: "CIO", desc: "Digital transformation, AI strategy" },
  { id: "it-dm", label: "IT DM", desc: "Integration, security, vendor eval" },
  { id: "martech-dm", label: "MarTech / Ops DM", desc: "Stack, campaign ops, data" },
];

const STAGES = [
  { id: "awareness", label: "Discovery", desc: "Something is broken but I can't name it yet" },
  { id: "exploration", label: "Exploration", desc: "I see the problem and I'm looking for solutions" },
  { id: "evaluation", label: "Evaluation", desc: "I'm comparing vendors and building a shortlist" },
  { id: "decision", label: "Decision", desc: "I'm close to choosing and need final reassurance" },
];

export default function InputScreen({ onNext, initialPainPoint = "", initialPersona = null, initialStage = null, initialProductContext = "" }) {
  const [painPoint, setPainPoint] = useState(initialPainPoint);
  const [persona, setPersona] = useState(initialPersona);
  const [stage, setStage] = useState(initialStage);
  const [productContext, setProductContext] = useState(initialProductContext);

  const canSubmit = painPoint.trim() && persona && stage;

  const card = (selected, onClick, title, desc) => (
    <div onClick={onClick} style={{
      border: "0.5px solid " + (selected ? "#111" : "#e5e5e5"),
      borderRadius: 8, padding: "10px 12px", cursor: "pointer",
      background: selected ? "#f9f9f9" : "#fff",
      transition: "border-color 0.15s",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#111", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>{desc}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Pain point</label>
        <textarea
          rows={3} value={painPoint} onChange={e => setPainPoint(e.target.value)}
          placeholder="Describe the pain point in plain language. E.g. difficulty scaling content production while maintaining brand consistency across global markets."
          style={{ width: "100%", fontSize: 14, borderRadius: 8, border: "0.5px solid #e5e5e5", padding: "10px 12px", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Product context</label>
        <textarea
          rows={3} value={productContext} onChange={e => setProductContext(e.target.value)}
          placeholder="Describe the product or solution being researched (optional). E.g. what it does, who it's for, key capabilities."
          style={{ width: "100%", fontSize: 14, borderRadius: 8, border: "0.5px solid #e5e5e5", padding: "10px 12px", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 8 }}>Persona</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {PERSONAS.map(p => card(persona?.id === p.id, () => setPersona(p), p.label, p.desc))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 8 }}>Journey stage</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {STAGES.map(s => card(stage?.id === s.id, () => setStage(s), s.label, s.desc))}
        </div>
      </div>

      <button
        disabled={!canSubmit}
        onClick={() => onNext({ painPoint, persona, stage, productContext })}
        style={{ width: "100%", padding: 10, fontSize: 14, borderRadius: 8, border: "0.5px solid #ddd", background: canSubmit ? "#111" : "#f5f5f5", color: canSubmit ? "#fff" : "#aaa", cursor: canSubmit ? "pointer" : "not-allowed" }}>
        Generate prompts
      </button>
    </div>
  );
}