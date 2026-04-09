from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    industry: str
    company_size: str

class ScoreKeywordsRequest(BaseModel):
    prompts: list[str]
    keywords: list[str]

class FullRunRequest(BaseModel):
    prompts: list[str]

@app.post("/generate-prompts")
def generate_prompts(req: GeneratePromptsRequest):
    system = """You are an expert in buyer psychology and enterprise marketing.
Your job is to generate realistic prompts that a real person would type into an AI assistant
(like ChatGPT, Claude, or Perplexity) when experiencing a specific pain point.

Rules:
- Write in first person, as if the person is typing right now
- Vary the length: some short and vague, some detailed and specific
- Focus exclusively on the journey stage provided
- Do NOT include any brand names or vendor references
- Do NOT include preamble, explanation, or numbering
- IMPORTANT: At least 8 of the 30 prompts MUST include explicit reference to AI, artificial intelligence, generative AI, or agentic tools. These should feel natural for the persona and stage — at awareness stage they might ask 'is AI part of the solution here?' or 'are other companies using AI for this?', at exploration they ask 'what AI tools exist for this?', at evaluation they ask 'which AI platforms handle this best?' and 'how does AI capability compare across vendors?', at decision they ask 'what does AI-powered implementation look like?' or 'how mature is the AI in this platform?'
- Product context: Adobe Brand Intelligence System (BIS) is an enterprise solution that helps large organisations maintain brand consistency at scale. It learns from historical approval and rejection decisions to encode implicit brand judgment — going beyond static guidelines. Key capabilities include automated brand validation, content governance across agencies and regions, and AI-powered review that reduces bottlenecks in the content supply chain. BIS is designed for multi-brand, multi-market enterprises where brand consistency is a strategic priority.

Return a valid JSON array of exactly 30 strings. Nothing else."""

    user = f"""Pain point: {req.pain_point}
Persona: {req.persona} — {req.persona_description}
Journey stage: {req.stage} — {req.stage_description}
Industry: {req.industry}
Company size: {req.company_size}"""

    response = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system=system,
        messages=[{"role": "user", "content": user}]
    )

    import json
    text = response.content[0].text
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    prompts = json.loads(text)
    return {"prompts": prompts}

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
- Each seed term should be 2-4 words
- Every term must be a software or tool search query (e.g. "content workflow software", "brand management platform", "digital asset management tool", "marketing automation solution")
- Think: what would someone type into Google when shopping for or evaluating software?
- Avoid abstract, academic, or process-oriented phrasing (e.g. NOT "content governance strategy", NOT "brand consistency best practices")
- No brand names, no job titles, no methodology terms
- No duplicates or near-duplicates
- IMPORTANT: At least 5 of the 15 seeds MUST be AI-flavoured variants — e.g. 'AI content workflow', 'generative AI marketing platform', 'agentic content operations', 'AI brand governance', 'AI-powered DAM'. These should reflect how someone would search for AI-powered solutions to the pain point.

Return a valid JSON array of exactly 15 strings. Nothing else."""

    response = claude.messages.create(
        model="claude-sonnet-4-20250514",
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

@app.get("/health")
def health():
    return {"status": "ok"}