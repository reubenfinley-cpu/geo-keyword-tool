import { useState } from "react";
import PainPointScreen from "./screens/PainPointScreen";
import InputScreen from "./screens/InputScreen";
import PromptsScreen from "./screens/PromptsScreen";
import ResultsScreen from "./screens/ResultsScreen";
import HowItWorksScreen from "./screens/HowItWorksScreen";

function PasswordGate({ onAuth }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (value === "adobe2026") {
      sessionStorage.setItem("auth", "1");
      onAuth();
    } else {
      setError(true);
      setValue("");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 320, padding: "2rem", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 0.25rem" }}>GEO Research Tool</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 1.5rem" }}>Adobe · AI search visibility</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
            autoFocus
            style={{
              width: "100%", padding: "0.5rem 0.75rem", fontSize: 14,
              border: "0.5px solid " + (error ? "#e53e3e" : "#ddd"),
              borderRadius: 6, boxSizing: "border-box", outline: "none", marginBottom: "0.5rem"
            }}
          />
          {error && <p style={{ fontSize: 12, color: "#e53e3e", margin: "0 0 0.5rem" }}>Incorrect password</p>}
          <button type="submit" style={{
            width: "100%", padding: "0.5rem", fontSize: 14, fontWeight: 500,
            background: "#111", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer"
          }}>Enter</button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("auth") === "1");
  const [screen, setScreen] = useState(0);
  const [painPointData, setPainPointData] = useState(null);
  const [inputData, setInputData] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [results, setResults] = useState(null);
  const [showHow, setShowHow] = useState(false);

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

  const STEPS = ["Pain points", "Input", "Prompts", "Results"];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>GEO Research Tool</h1>
          <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>Adobe · AI search visibility</p>
        </div>
        <button
          onClick={() => setShowHow(h => !h)}
          style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationColor: "#ccc" }}>
          How it works
        </button>
      </div>

      {showHow ? (
        <HowItWorksScreen onBack={() => setShowHow(false)} />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
            {STEPS.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 11, fontWeight: 500,
                    background: screen === i ? "#111" : screen > i ? "#eee" : "transparent",
                    color: screen === i ? "#fff" : "#888",
                    border: "0.5px solid " + (screen === i ? "#111" : "#ddd"),
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: screen === i ? "#111" : "#aaa", fontWeight: screen === i ? 500 : 400 }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 0.5, background: "#eee" }} />}
              </div>
            ))}
          </div>

          {screen >= 1 && (inputData?.painPoint || painPointData?.painPoint) && (
            <div style={{ marginBottom: "1.5rem", padding: "10px 14px", background: "#f9f9f9", border: "0.5px solid #e5e5e5", borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 3 }}>Pain point</span>
              <span style={{ fontSize: 13, color: "#444", lineHeight: 1.5 }}>
                {screen === 1 ? (painPointData?.painPoint || "") : (inputData?.painPoint || "")}
              </span>
            </div>
          )}

          {screen === 0 && (
            <PainPointScreen onNext={(data) => { setPainPointData(data); setScreen(1); }} />
          )}
          {screen === 1 && (
            <InputScreen
              onNext={(data) => { setInputData({ ...data, productDescription: painPointData?.productDescription || "" }); setScreen(2); }}
              initialPainPoint={painPointData?.painPoint || ""}
              initialPersona={painPointData?.persona || null}
              initialStage={painPointData?.stage || null}
              initialProductContext={painPointData?.productDescription || ""}
            />
          )}
          {screen === 2 && <PromptsScreen inputData={inputData} prompts={prompts} setPrompts={setPrompts} onBack={() => setScreen(1)} onNext={(results) => { setResults(results); setScreen(3); }} />}
          {screen === 3 && <ResultsScreen results={results} onBack={() => setScreen(2)} />}
        </>
      )}
    </div>
  );
}

export default App;
