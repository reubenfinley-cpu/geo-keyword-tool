import { useState } from "react";

export default function ResultsScreen({ results, onBack }) {
  const [sortCol, setSortCol] = useState("similarity");
  const [sortDir, setSortDir] = useState(-1);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(-1); }
  }

  const sorted = [...results].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === "string") return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  const totalVol = results.reduce((s, k) => s + (k.search_volume || 0), 0);
  const avgCpc = results.reduce((s, k) => s + (k.cpc || 0), 0) / results.length;
  const avgSim = results.reduce((s, k) => s + k.similarity, 0) / results.length;

  function exportCSV() {
    const rows = [["keyword", "similarity", "search_volume", "cpc"]];
    results.forEach(r => rows.push([r.keyword, r.similarity, r.search_volume || 0, r.cpc || 0]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "geo-keywords.csv"; a.click();
  }

  const simColor = (s) => s >= 0.80 ? "#085041" : s >= 0.65 ? "#633806" : "#888";
  const simBg = (s) => s >= 0.80 ? "#E1F5EE" : s >= 0.65 ? "#FAEEDA" : "#f5f5f5";
  const sortArrow = (col) => sortCol === col ? (sortDir === -1 ? " ↓" : " ↑") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>Keyword results</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{results.length} keywords</div>
        </div>
        <button onClick={exportCSV} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #ddd", background: "#fff", cursor: "pointer" }}>Export CSV</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Total search volume", value: totalVol.toLocaleString(), sub: "across all keywords" },
          { label: "Avg CPC", value: "$" + avgCpc.toFixed(2), sub: "commercial intent signal" },
          { label: "Avg similarity", value: avgSim.toFixed(2), sub: "prompt–keyword alignment" },
        ].map(s => (
          <div key={s.label} style={{ background: "#f9f9f9", borderRadius: 8, padding: 12, border: "0.5px solid #e5e5e5" }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "#111" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "0.5px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid #e5e5e5" }}>
              {[["keyword", "Keyword", "40%"], ["similarity", "Similarity", "22%"], ["search_volume", "Volume", "19%"], ["cpc", "CPC", "19%"]].map(([col, label, w]) => (
                <th key={col} onClick={() => toggleSort(col)} style={{ width: w, textAlign: "left", fontSize: 11, fontWeight: 500, color: "#888", padding: "10px 12px 10px 0", paddingLeft: col === "keyword" ? 12 : 0, cursor: "pointer", userSelect: "none", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}{sortArrow(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((k, i) => (
              <tr key={i} style={{ borderBottom: i < sorted.length - 1 ? "0.5px solid #f5f5f5" : "none" }}>
                <td style={{ padding: "10px 12px", fontWeight: 500, color: "#111" }}>{k.keyword}</td>
                <td style={{ padding: "10px 12px 10px 0" }}>
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, fontWeight: 500, background: simBg(k.similarity), color: simColor(k.similarity) }}>{k.similarity.toFixed(2)}</span>
                </td>
                <td style={{ padding: "10px 12px 10px 0", color: "#111" }}>{(k.search_volume || 0).toLocaleString()}</td>
                <td style={{ padding: "10px 12px 10px 0", color: "#888" }}>${(k.cpc || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={onBack} style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "0.5px solid #ddd", background: "#fff", cursor: "pointer", alignSelf: "flex-start" }}>Back to prompts</button>
    </div>
  );
}