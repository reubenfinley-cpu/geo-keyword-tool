import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const PERSONA_DESCRIPTIONS = {
  "cmo": "Sets vision and owns the budget, thinks in business outcomes and competitive positioning",
  "marketing-dm": "Bridges strategy and execution, owns campaign performance and team output",
  "creative-dm": "Leads brand and creative strategy, cares about creative excellence and brand integrity",
  "cio": "Drives digital transformation and AI strategy, focused on security and tech ROI",
  "it-dm": "Executes technology strategy, evaluates integrations and manages vendor relationships",
  "martech-dm": "Bridges marketing and technology, manages the MarTech stack and campaign ops",
};

const STAGE_DESCRIPTIONS = {
  "awareness": "Something feels broken but they cannot name the problem yet — describing symptoms",
  "exploration": "Understands the problem clearly and is actively looking for approaches and solutions",
  "evaluation": "Knows what kind of solution they need and is comparing vendors and building a shortlist",
  "decision": "Close to choosing, looking for reassurance, pricing, case studies, or negotiation leverage",
};

export default function PromptsScreen({ inputData, prompts, setPrompts, onBack, onNext }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newPrompt, setNewPrompt] = useState("");
  const [runningResearch, setRunningResearch] = useState(false);

  useEffect(() => {
    if (prompts.length === 0) fetchPrompts();
  }, []);

  async function fetchPrompts() {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/generate-prompts`, {
        pain_point: inputData.painPoint,
        persona: inputData.persona.label,
        persona_description: PERSONA_DESCRIPTIONS[inputData.persona.id],
        stage: inputData.stage.label,
        stage_description: STAGE_DESCRIPTIONS[inputData.stage.id],
        industry: inputData.industry,
        company_size: inputData.companySize,
      });
      setPrompts(res.data.prompts);
    } catch (e) {
      setError("Failed to generate prompts. Check the backend is running.");
    }
    setLoading(false);
  }

  function removePrompt(i) {
    setPrompts(prompts.filter((_, idx) => idx !== i));
  }

  function addPrompt() {
    if (newPrompt.trim()) {
      setPrompts([...prompts, newPrompt.trim()]);
      setNewPrompt("");
    }
  }

  async function runResearch() {
    setRunningResearch(true);
    setError(null);
    try {
      const seedRes = await axios.post(`${API}/generate-seeds`, { prompts });
      const seeds = seedRes.data.seeds;

      const expandRes = await axios.post(`${API}/dataforseo-expand`, { seeds });
      const keywords = expandRes.data.keywords;
      const keywordData = expandRes.data.keyword_data;

      const scoreRes = await axios.post(`${API}/score-keywords`, { prompts, keywords });
      
      const enriched = scoreRes.data.results.map(r => {
        const match = keywordData.find(k => k.keyword === r.keyword);
        return { ...r, search_volume: match?.search_volume || 0, cpc: match?.cpc || 0 };
      });
      onNext(enriched);
    } catch (e) {
      setError("Something went wrong during keyword research. Check the backend.");
    }
    setRunningResearch(false);
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: "3rem 0", color: "#888", fontSize: 14 }}>
      Generating prompts...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>Review and refine prompts</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {inputData.persona.label} · {inputData.stage.label} · {inputData.industry} · {inputData.companySize}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#aaa" }}>{prompts.length} prompts</div>
      </div>

      <div style={{ fontSize: 12, color: "#aaa" }}>
        Remove off-topic prompts, edit any that need tweaking, or add your own below.
      </div>

      {error && <div style={{ fontSize: 13, color: "#c00", padding: "8px 12px", background: "#fff5f5", borderRadius: 8 }}>{error}</div>}

      <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 12, padding: "0 1rem" }}>
        {prompts.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 0", borderBottom: i < prompts.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
            <span style={{ flex: 1, fontSize: 13, color: "#111", lineHeight: 1.5 }}>{p}</span>
            <span onClick={() => removePrompt(i)} style={{ fontSize: 18, color: "#ccc", cursor: "pointer", lineHeight: 1, flexShrink: 0, padding: "0 4px" }}>×</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newPrompt} onChange={e => setNewPrompt(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addPrompt()}
          placeholder="Add a prompt manually..."
          style={{ flex: 1, fontSize: 13, borderRadius: 8, border: "0.5px solid #e5e5e5", padding: "8px 12px", fontFamily: "inherit" }} />
        <button onClick={addPrompt} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "0.5px solid #ddd", background: "#fff", cursor: "pointer" }}>Add</button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "0.5px solid #ddd", background: "#fff", cursor: "pointer" }}>Back</button>
        <button
          onClick={runResearch}
          disabled={runningResearch || prompts.length < 5}
          style={{ flex: 1, fontSize: 14, padding: 10, borderRadius: 8, border: "0.5px solid #ddd", background: runningResearch ? "#f5f5f5" : "#111", color: runningResearch ? "#aaa" : "#fff", cursor: runningResearch ? "not-allowed" : "pointer" }}>
          {runningResearch ? "Running keyword research..." : "Run keyword research"}
        </button>
      </div>
    </div>
  );
}