# updated
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import secrets
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import anthropic
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = SentenceTransformer("all-mpnet-base-v2")
claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

class GeneratePromptsRequest(BaseModel):
    pain_point: str
    persona: str
    persona_description: str
    stage: str
    stage_description: str
    product_context: str = ""

class ScoreKeywordsRequest(BaseModel):
    prompts: list[str]
    keywords: list[str]

class FullRunRequest(BaseModel):
    prompts: list[str]

class DeduplicateRequest(BaseModel):
    prompts: list[str]
    threshold: float = 0.78

@app.post("/generate-prompts")
def generate_prompts(req: GeneratePromptsRequest):
    system_lines = [
        "You are an expert in buyer psychology and enterprise marketing.",
        "Your job is to generate realistic prompts that a real person would type into an AI assistant",
        "(like ChatGPT, Claude, or Perplexity) when experiencing a specific pain point.",
        "",
        "Rules:",
        "- Write in first person, as if the person is typing right now",
        "- Vary the length: some short and vague, some detailed and specific",
        "- Focus exclusively on the journey stage provided",
        "- Do NOT include any brand names or vendor references",
        "- Do NOT include preamble, explanation, or numbering",
        "- Adobe's core value proposition is AI-driven, so exactly 8 of the 30 prompts must be AI-adjacent. However, the framing must honestly reflect where the persona is in their journey. At Discovery stage, references to the solution category must only appear as vague curiosity or peer comparison — the persona has not yet identified a solution (e.g. how are other companies solving this?, is there a smarter way to handle this than what we're doing now?). Never use explicit solution searches, capability questions, or vendor references at Discovery stage. At Exploration stage, prompts can begin to reference solution categories and approaches. At Evaluation stage, prompts can reference specific capabilities, feature requirements, and platform comparisons. At Decision stage, prompts can reference pricing, implementation timelines, integration requirements, and risk mitigation.",
        "- Every prompt must be clearly attributable to the defined persona and their professional context. References to domain-specific vocabulary should appear where they read naturally and help ground the prompt in the persona's world — but do not force jargon into prompts where the persona's professional context is already implied by the framing.",
        "- Every prompt must be a direct expression of the stated pain point. Do not introduce adjacent pain points, related product capabilities, or topics not explicitly implied by the pain point description. If a prompt could plausibly belong to a different pain point, rewrite or cut it.",
    ]
    if req.product_context.strip():
        system_lines.append(f"- Product context: {req.product_context.strip()}")
    system_lines.append("")
    system_lines.append("Return a valid JSON array of exactly 30 strings. Nothing else.")
    system = "\n".join(system_lines)

    user = f"""Pain point: {req.pain_point}
Persona: {req.persona} — {req.persona_description}
Journey stage: {req.stage} — {req.stage_description}"""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=system,
        messages=[{"role": "user", "content": user}]
    )

    import json
    text = response.content[0].text
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    prompts = json.loads(text)
    return {"prompts": prompts}

@app.post("/deduplicate")
def deduplicate(req: DeduplicateRequest):
    if len(req.prompts) < 2:
        return {"pairs": []}
    embeddings = model.encode(req.prompts)
    sims = cosine_similarity(embeddings)
    pairs = []
    seen_b = set()
    for i in range(len(req.prompts)):
        for j in range(i + 1, len(req.prompts)):
            if sims[i][j] >= req.threshold and j not in seen_b:
                seen_b.add(j)
                pairs.append({
                    "a": i,
                    "b": j,
                    "a_text": req.prompts[i],
                    "b_text": req.prompts[j],
                    "similarity": round(float(sims[i][j]), 4),
                })
    return {"pairs": pairs}

@app.post("/score-keywords")
def score_keywords(req: ScoreKeywordsRequest):
    prompt_embeddings = model.encode(req.prompts)
    centroid = np.mean(prompt_embeddings, axis=0, keepdims=True)
    keyword_embeddings = model.encode(req.keywords)
    scores = cosine_similarity(keyword_embeddings, centroid).flatten()
    results = [
        {"keyword": kw, "similarity": round(float(score), 4)}
        for kw, score in zip(req.keywords, scores)
    ]
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return {"results": results}

@app.post("/generate-seeds")
def generate_seeds(req: FullRunRequest):
    system = """You are an SEO keyword researcher specializing in B2B software discovery.
Given a list of prompts that a software buyer would type into an AI assistant,
extract 15 seed terms suitable for keyword research on Google.

Rules:
- Each seed term should be 2-3 words maximum
- Use common, high-level terms that have broad search volume (e.g. 'brand management', 'content governance', 'creative workflow' — not 'brand intelligence platform' or 'AI-powered brand compliance')
- Think of seeds as the parent topic, not the specific solution
- Mix of problem-oriented terms ('brand consistency issues') and solution-oriented terms ('brand management software')
- No brand names, no overly technical terms, no compound phrases over 3 words
- No duplicates

Return a valid JSON array of exactly 15 strings. Nothing else."""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=system,
        messages=[{"role": "user", "content": f"Prompts:\n" + "\n".join(req.prompts)}]
    )

    import json
    text = response.content[0].text
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    seeds = json.loads(text)
    return {"seeds": seeds}

@app.post("/dataforseo-expand")
def dataforseo_expand(body: dict):
    seeds = body.get("seeds", [])
    login = os.getenv("DATAFORSEO_LOGIN")
    password = os.getenv("DATAFORSEO_PASSWORD")

    all_keywords = {}

    for seed in seeds[:10]:
        payload = [{"keyword": seed, "language_name": "English", "location_code": 2840, "limit": 30}]
        r = requests.post(
            "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live",
            auth=(login, password),
            json=payload
        )
        data = r.json()
        try:
            items = data["tasks"][0]["result"][0]["items"]
            if items:
                print(f"DEBUG first item keys: {list(items[0].keys())}")
                print(f"DEBUG first item: {str(items[0])[:500]}")
            if not items:
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                kw = item.get("keyword")
                if not kw:
                    continue
                kw_info = item.get("keyword_info") or {}
                volume = kw_info.get("search_volume", 0) or 0
                cpc = kw_info.get("cpc", 0) or 0
                if kw not in all_keywords:
                    all_keywords[kw] = {"keyword": kw, "search_volume": volume, "cpc": cpc}
        except Exception as e:
            print(f"DEBUG: parse error={e}")
            continue

    print(f"DEBUG: total keywords={len(all_keywords)}")
    return {"keywords": list(all_keywords.keys()), "keyword_data": list(all_keywords.values())}

class DecomposeCapabilitiesRequest(BaseModel):
    product_name: str
    product_description: str

class GeneratePainPointsRequest(BaseModel):
    capabilities: list[str]
    persona: str
    persona_description: str
    journey_stage: str
    journey_stage_description: str = ""

@app.post("/decompose-capabilities")
def decompose_capabilities(req: DecomposeCapabilitiesRequest):
    import json
    system = """You are a product strategist specialising in B2B SaaS.
Analyse the product description and decompose it into 8–12 distinct capabilities.
Each capability must be a concise verb-phrase (e.g. "enforce brand guidelines across distributed teams", "automate asset tagging with AI").
Focus on what the product actually does, not marketing language.
Return a valid JSON array of strings. Nothing else."""

    user = f"Product name: {req.product_name}\n\nProduct description:\n{req.product_description}"

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=system,
        messages=[{"role": "user", "content": user}]
    )
    text = response.content[0].text
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    capabilities = json.loads(text)
    return {"capabilities": capabilities}

@app.post("/generate-pain-points")
def generate_pain_points(req: GeneratePainPointsRequest):
    import json
    system = """You are a B2B buyer research expert.
Given a list of product capabilities and a buyer persona at a specific journey stage, generate exactly 8 distinct pain points that this persona would experience — pain points that the listed capabilities directly address.
Rules:
- Write each pain point from the persona's perspective, in plain language (not marketing copy)
- Each pain point should be 1–2 sentences describing a concrete, relatable problem
- Tailor the language and context to the persona's role and the journey stage. At Discovery stage, pain points must describe symptoms the persona feels without any awareness that a solution exists. At Exploration stage, pain points can assume the persona has identified the problem category and is beginning to look for solutions. At Evaluation stage, pain points reflect a persona who is actively comparing options and needs to justify a specific choice. At Decision stage, pain points are about risk, confidence, and finalising commitment — the persona is close to buying but needs reassurance.
- Do not reference the product or any vendor
- No duplicates, no generic filler
Return a valid JSON array of exactly 8 strings. Nothing else."""

    caps_text = "\n".join(f"- {c}" for c in req.capabilities)
    user = f"Capabilities:\n{caps_text}\n\nPersona: {req.persona} — {req.persona_description}\nJourney stage: {req.journey_stage} — {req.journey_stage_description}"

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": user}]
    )
    text = response.content[0].text
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    pain_points = json.loads(text)
    return {"pain_points": pain_points}

@app.post("/debug-similarity")
def debug_similarity(body: dict):
    prompts = body.get("prompts", [])
    if len(prompts) != 2:
        return {"error": "Provide exactly 2 prompts"}
    embeddings = model.encode(prompts)
    score = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    return {"similarity": round(float(score), 4), "prompt_a": prompts[0], "prompt_b": prompts[1]}

class AuthRequest(BaseModel):
    password: str

@app.post("/auth")
def auth(req: AuthRequest):
    app_password = os.getenv("APP_PASSWORD")
    if not app_password:
        raise HTTPException(status_code=500, detail="Server misconfigured: APP_PASSWORD not set")
    if not secrets.compare_digest(req.password, app_password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    return {"ok": True}

@app.get("/health")
def health():
    return {"status": "ok"}
