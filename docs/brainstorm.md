# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

BrainStorm v1 is a strategic brainstorming engine. It loads expert profiles and country-exposure overlays from markdown assets, runs a graph-based deliberation round driven by a strategic question, and produces a scenario document. The system implements the **Triple Truth System** (World Truth, Agent Beliefs, Shared Knowledge), **inter-expert interaction** (challenge/response cycles), **emergent phenomena detection**, **goal-directed expert behavior**, and optional **web search enrichment**. It uses Claude Sonnet 4.6 with extended thinking for LLM-backed generation, with a deterministic fallback when `ANTHROPIC_API_KEY` is absent.

## Running

```bash
# Start the FastAPI server (primary method)
uvicorn BrainStorm_v1.api:app --reload --port 8010

# Or via the local helper
python BrainStorm_v1/main.py
```

The app must be run from the **parent directory** of `BrainStorm_v1/` because all imports use the `BrainStorm_v1.` package prefix.

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` to enable LLM generation. Without it, the app runs in deterministic-fallback mode.

## Dependencies

```bash
pip install -r requirements.txt
```

Core deps: `fastapi`, `uvicorn`, `pydantic>=2.0`, `python-dotenv`, `langgraph` (optional — falls back to a sequential runner if missing).

## Architecture

**Request flow:** `api.py` → `SessionManager` → `build_brainstorm_graph()` → 12-node pipeline → `SessionSnapshot` response.

### Graph pipeline (`brainstorm_app/graph/`)

The brainstorm round runs as a 12-node sequential graph:

1. **prepare_context** — increments round, extracts focus-point tokens, applies belief decay (RAVENMOOR-style certainty *= 0.92 per round for unreinforced beliefs)
2. **generate_arguments** — iterates each expert profile, updates argument_goal_phase (establishing/defending/redirecting), calls LLM (or deterministic fallback) with beliefs and interest system context, scores with domain-agnostic alignment
3. **arbitrate_arguments** — sorts by score, selects top N (round_budget), defers the rest
4. **challenge_phase** — each expert evaluates others' claims, propagates claims as beliefs with decayed certainty, detects contradictions, issues challenges based on bias operators and revision triggers
5. **response_phase** — challenged experts respond (defend/partial_concede/full_concede) based on revision triggers, updates social weights between experts
6. **plan_searches** — evaluates search triggers (challenge, contradiction, confidence-drop, new-territory) for each expert, builds search queue constrained by Knowledge Boundaries and Source Trust Profile
7. **execute_searches** — runs web searches via SearchProvider (Brave API or deterministic), classifies trust, stores results in RuntimeMind, adds high-trust results to WorldTruth
8. **coordinate_round** — neutral coordinator analyzes debate dynamics, identifies tensions and gaps, generates targeted directives for next round
9. **update_state** — processes challenges/responses into claim status transitions (asserted→challenged→contested/conceded/reinforced), updates RuntimeMinds, checks SharedKnowledge promotion threshold
10. **detect_phenomena** — rule-based detection of: unexpected consensus, productive conflict, cross-domain insight, position change, revealing deadlock
11. **update_chronicle** — builds ChronicleEntry (narrative arc, tensions, belief shifts), appends to WorldChronicle for multi-round memory
12. **synthesize_round** — generates scenario document via LLM (or fallback), includes coordinator analysis and phenomena

`builder.py` wires these nodes into a LangGraph `StateGraph` if available, otherwise into `SimpleCompiledGraph` (a plain sequential runner in `compat.py`). The graph state is a `TypedDict` (`BrainStormGraphState`).

### Triple Truth System (`brainstorm_app/core/`)

Modeled after RAVENMOOR's `KnowledgeSystem` / `SemanticStore`:

- **World Truth** (`world_truth.py`) — objective facts seeded from overlays, enriched by high-trust web search results. `WorldFact` entries with confidence, source, tags. `SharedKnowledge` entries promoted when 2+ experts converge on same claim.
- **Agent Beliefs** (`runtime_mind.py`) — per-expert `RuntimeMind` with continuous certainty (0.0-1.0), source weights, asymptotic reinforcement formula, contradiction handling (weaker belief halved), per-round decay. Beliefs injected into LLM prompts with certainty annotations.
- **Shared Knowledge** — `SharedKnowledge` in WorldTruth, promoted from claims when threshold of supporting experts is met.

### Claim lifecycle (`brainstorm_app/core/claim.py`)

Claims transition through: ASSERTED → CHALLENGED → CONTESTED/CONCEDED/REINFORCED/WITHDRAWN. Each transition is tracked in `status_history` with round, trigger, and old/new status.

### Interest System

Expert behavior is goal-directed with phases (like RAVENMOOR's murder_goal.phase):
- `ESTABLISHING` — first round, setting up public position
- `DEFENDING` — claims were challenged, reinforcing position
- `CONCEDING` — strong evidence forced belief revision
- `REDIRECTING` — hidden interest not served, redirecting debate

Each expert has a `hidden_interest` (what they privately want to foreground) and a `public_position_seed` (how they argue publicly). The LLM prompt instructs experts to argue through the public seed while steering toward the hidden interest.

### Services (`brainstorm_app/services/`)

- **`session_manager.py`** — in-memory session store (dict + threading Lock), orchestrates graph invocation per round, initializes RuntimeMinds and WorldTruth at session creation
- **`anthropic_client.py`** — `AnthropicReasoner` calls Anthropic Messages API directly via `urllib` (no SDK). Prompt builders for: profile argument, scenario document, challenge, response. Falls back gracefully on `AnthropicServiceError`.
- **`markdown_assets.py`** — `AssetCatalog` loads profile packs and overlays from `assets/profiles/`.
- **`streaming.py`** — SSE wrapper that runs `run_round` in a thread and emits graph events via an `asyncio.Queue`.
- **`web_search.py`** — `SearchProvider` protocol with `BraveSearchProvider` (Brave Search API via urllib) and `DeterministicSearchProvider` (returns empty, graceful degradation).

### Data models (`brainstorm_app/core/`)

- `models.py` — `MarkdownAsset` (parsed markdown file) and `SessionRoundResult` dataclasses
- `schemas.py` — Pydantic v2 request/response models
- `runtime_mind.py` — `RuntimeMind`, `Belief`, `SocialWeight`, `WebSearchResult`, `ArgumentGoalPhase`
- `world_truth.py` — `WorldTruth`, `WorldFact`, `SharedKnowledge`
- `claim.py` — `Claim`, `ClaimStatus`
- `chronicle.py` — `WorldChronicle`, `ChronicleEntry`

### Asset format (`assets/profiles/`)

Expert profiles and overlays are markdown files with YAML-like frontmatter. Profiles have sections like "Identity Core", "Method Contract", "Bias Operators", "Knowledge Boundaries", "Hidden Interest And Public Position", "Runtime Seed". Overlays have "Structural Profile", "Main Transmission Channels", "Key Vulnerabilities", etc. The `## What Each Expert Should Look At` section in overlays maps lens names to per-profile guidance.

Profile packs are directories under `assets/profiles/`; overlays live in an `overlays/` subdirectory within a pack.

## API Endpoints

- `GET /healthz` — health check with graph/LLM backend info
- `GET /api/assets` — lists available profile packs and overlays
- `POST /api/sessions/start` — creates a session from topic + strategic_question + profile_pack + overlay_ids + enable_web_search
- `GET /api/sessions/{session_id}/state` — current session snapshot
- `POST /api/sessions/{session_id}/round` — runs one deliberation round (sync)
- `POST /api/sessions/{session_id}/round/stream` — runs one round with SSE event stream
- `GET /api/sessions/{session_id}/minds` — all experts' RuntimeMinds
- `GET /api/sessions/{session_id}/chronicle` — WorldChronicle entries
- `GET /api/sessions/{session_id}/claims` — claim graph with full status history

## SSE Event Types

`round_start`, `expert_argument`, `expert_challenge`, `expert_response`, `web_search`, `coordinator_directive`, `world_update`, `phenomena_detected`, `chronicle_entry`, `synthesis`, `round_end`, `final_state`, `stream_end`

## Key Design Decisions

- Sessions are in-memory only (no persistence yet) — session state is a plain dict protected by a threading Lock.
- The Anthropic API is called via raw `urllib`, not the Anthropic SDK.
- LLM calls are always optional; every LLM path has a deterministic fallback so the app works without an API key.
- The `emit` callback pattern threads through the graph nodes to support SSE streaming without coupling nodes to transport.
- Speaker counts apply a negative score bias to prevent the same expert from dominating across rounds.
- Belief mechanics (certainty, decay, reinforcement, contradiction) are modeled after RAVENMOOR's SemanticStore.
- Web search is optional (`enable_web_search` flag), uses Brave Search API, and respects per-expert search budgets.
- All generated text is in English.
