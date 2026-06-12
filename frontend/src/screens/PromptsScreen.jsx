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

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPromptCard({ text, similarity, onRemove, onKeep }) {
  return (
    <div style={{
      background: "#fffdf0",
      border: "0.5px solid #e8d080",
      borderRadius: 8,
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span
          style={{ fontSize: 13, color: "#111", lineHeight: 1.5, flex: 1 }}
          dangerouslySetInnerHTML={{ __html: escapeHtml(text) }}
        />
        <span style={{
          fontSize: 11,
          color: "#92610a",
          background: "#fef3c0",
          borderRadius: 4,
          padding: "2px 6px",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          {Math.round(similarity * 100)}% similar
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onRemove}
          style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid #ddd", background: "#fff", cursor: "pointer" }}>
          Remove
        </button>
        <button
          onClick={onKeep}
          style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid #e5e5e5", background: "#fff", color: "#888", cursor: "pointer" }}>
          Keep anyway
        </button>
      </div>
    </div>
  );
}

export default function PromptsScreen({ inputData, prompts, setPrompts, onBack, onNext }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newPrompt, setNewPrompt] = useState("");
  const [runningResearch, setRunningResearch] = useState(false);
  const [dedupPairs, setDedupPairs] = useState(null); // null = not yet run
  const [dedupLoading, setDedupLoading] = useState(false);
  const [manualKeeps, setManualKeeps] = useState(new Set());
  const [threshold, setThreshold] = useState(0.78);

  useEffect(() => {
    if (prompts.length === 0) fetchPrompts();
  }, []);

  async function runDedup(promptList, thresh) {
    if (promptList.length < 2) { setDedupPairs([]); return; }
    setDedupLoading(true);
    try {
      const res = await axios.post(`${API}/deduplicate`, { prompts: promptList, threshold: thresh });
      setDedupPairs(res.data.pairs);
    } catch (_) {}
    setDedupLoading(false);
  }

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
        product_context: inputData.productDescription || inputData.productContext || "",
      });
      const ps = res.data.prompts;
      setPrompts(ps);
      setManualKeeps(new Set());
      await runDedup(ps, threshold);
    } catch (e) {
      setError("Failed to generate prompts. Check the backend is running.");
    }
    setLoading(false);
  }

  function removePrompt(i) {
    const updated = prompts.filter((_, idx) => idx !== i);
    setPrompts(updated);
    runDedup(updated, threshold);
  }

  function removeDedupPrompt(text) {
    const updated = prompts.filter(p => p !== text);
    setPrompts(updated);
    setDedupPairs(prev => (prev || []).filter(p => p.b_text !== text && p.a_text !== text));
  }

  function keepPrompt(text) {
    setManualKeeps(prev => new Set([...prev, text]));
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

  const unresolvedPairs = (dedupPairs || []).filter(pair => !manualKeeps.has(pair.b_text));

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

      {dedupPairs !== null && (
        <div style={{ border: "0.5px solid #e8d080", borderRadius: 12, padding: "12px 14px", background: "#fffdf5", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#92610a" }}>
              {dedupLoading
                ? "Checking for duplicates…"
                : unresolvedPairs.length > 0
                  ? `${unresolvedPairs.length} potential duplicate${unresolvedPairs.length !== 1 ? "s" : ""} flagged`
                  : "No duplicates found"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#aaa" }}>Threshold: {Math.round(threshold * 100)}%</span>
              <input
                type="range" min={0.80} max={0.99} step={0.01}
                value={threshold}
                onChange={e => setThreshold(parseFloat(e.target.value))}
                onPointerUp={e => runDedup(prompts, parseFloat(e.target.value))}
                onMouseUp={e => runDedup(prompts, parseFloat(e.target.value))}
                style={{ width: 80, cursor: "pointer" }}
              />
            </div>
          </div>
          {!dedupLoading && unresolvedPairs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {unresolvedPairs.map((pair, i) => (
                <div key={i}>
                  {buildPromptCard({
                    text: pair.b_text,
                    similarity: pair.similarity,
                    onRemove: () => removeDedupPrompt(pair.b_text),
                    onKeep: () => keepPrompt(pair.b_text),
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
