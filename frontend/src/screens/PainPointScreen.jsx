import { useState } from "react";
import axios from "axios";
import { PERSONAS, STAGES } from "../constants";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function PainPointScreen({ onNext }) {
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [persona, setPersona] = useState(null);
  const [stage, setStage] = useState(null);

  const [phase, setPhase] = useState("idle"); // idle | decomposing | generating | done
  const [capabilities, setCapabilities] = useState([]);
  const [painPoints, setPainPoints] = useState([]);
  const [error, setError] = useState(null);

  const canGenerate = productName.trim() && productDescription.trim() && persona && stage;

  async function handleGenerate() {
    setError(null);
    setCapabilities([]);
    setPainPoints([]);
    setPhase("decomposing");
    try {
      const capRes = await axios.post(`${API}/decompose-capabilities`, {
        product_name: productName.trim(),
        product_description: productDescription.trim(),
      });
      const caps = capRes.data.capabilities;
      setCapabilities(caps);
      setPhase("generating");

      const ppRes = await axios.post(`${API}/generate-pain-points`, {
        capabilities: caps,
        persona: persona.label,
        persona_description: persona.desc,
        journey_stage: stage.label,
        journey_stage_description: stage.desc,
      });
      setPainPoints(ppRes.data.pain_points);
      setPhase("done");
    } catch (e) {
      setError(e?.response?.data?.detail || "Something went wrong. Please try again.");
      setPhase("idle");
    }
  }

  function handleSelect(painPoint) {
    onNext({ painPoint, persona, stage, productName, productDescription });
  }

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Adobe product name</label>
          <input
            value={productName}
            onChange={e => setProductName(e.target.value)}
            placeholder="e.g. Adobe Experience Manager"
            style={{ width: "100%", fontSize: 14, borderRadius: 8, border: "0.5px solid #e5e5e5", padding: "8px 12px", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Adobe product description</label>
          <textarea
            rows={4}
            value={productDescription}
            onChange={e => setProductDescription(e.target.value)}
            placeholder="Describe what the product does, who it's for, and its key capabilities. The more detail, the better the pain points."
            style={{ width: "100%", fontSize: 14, borderRadius: 8, border: "0.5px solid #e5e5e5", padding: "10px 12px", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>
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
        onClick={() => onNext({ painPoint: "", persona: null, stage: null, productName: "", productDescription: "" })}
        style={{ background: "none", border: "none", fontSize: 12, color: "#aaa", cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationColor: "#ddd", alignSelf: "flex-end" }}
      >
        Skip — enter pain point manually
      </button>

      <button
        disabled={!canGenerate || phase === "decomposing" || phase === "generating"}
        onClick={handleGenerate}
        style={{
          width: "100%", padding: 10, fontSize: 14, borderRadius: 8,
          border: "0.5px solid #ddd",
          background: (canGenerate && phase === "idle") ? "#111" : "#f5f5f5",
          color: (canGenerate && phase === "idle") ? "#fff" : "#aaa",
          cursor: (canGenerate && phase === "idle") ? "pointer" : "not-allowed",
        }}
      >
        {phase === "decomposing" ? "Decomposing capabilities…" : phase === "generating" ? "Generating pain points…" : "Generate pain points"}
      </button>

      {error && (
        <p style={{ fontSize: 13, color: "#e53e3e", margin: 0 }}>{error}</p>
      )}

      {(phase === "generating" || phase === "done") && capabilities.length > 0 && (
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 8 }}>
            Capabilities identified ({capabilities.length})
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {capabilities.map((cap, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 20,
                background: "#f3f3f3", color: "#555", border: "0.5px solid #e5e5e5",
              }}>{cap}</span>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && painPoints.length > 0 && (
        <div>
          <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 8 }}>
            Select a pain point to research
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {painPoints.map((pp, i) => (
              <div
                key={i}
                onClick={() => handleSelect(pp)}
                style={{
                  border: "0.5px solid #e5e5e5", borderRadius: 8,
                  padding: "12px 14px", cursor: "pointer",
                  background: "#fff", transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#111"; e.currentTarget.style.background = "#f9f9f9"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.background = "#fff"; }}
              >
                <p style={{ fontSize: 13, color: "#111", margin: 0, lineHeight: 1.5 }}>{pp}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
