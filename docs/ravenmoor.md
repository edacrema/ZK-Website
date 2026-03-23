# Ravenmoor BackEnd — Contesto per Claude Code

## Progetto
"I Misteri di Ravenmoor" — motore narrativo interattivo con NPC autonomi.
Mystery/thriller ambientato in una villa nel 1987. 8 NPC con segreti, agende, relazioni.
Il giocatore è un investigatore che deve risolvere un omicidio.

## Stack
- Python 3.12+
- FastAPI (api.py)
- Google Gemini 3-Flash-Preview (3 modelli: main/parser/narrator, con thinking_level)
- SQLAlchemy + SQLite (db.py)
- NetworkX (spatial graph)
- Pydantic (models, schemas)
- pickle + HMAC-SHA256 (persistence)

## Struttura del codebase (~15.000 LOC)

```
api.py              — FastAPI routes, auth, crediti, SSE streaming, GET /api/games/{id}/state (resume)
auth.py             — JWT HS256, password hash, LOCAL_MODE bypass (get_current_user_or_local)
db.py               — SQLAlchemy: User, Game, CreditTransaction (SQLite separato in LOCAL_MODE)
main.py             — CLI entry point (LOCAL_MODE logging)
conversation_arbiter.py — Turn-taking NPC (integrato via hook in Fase 4)

config/
  settings.py       — 3 modelli Gemini 3 Flash (main/parser/narrator) con thinking_level, LOCAL_MODE
  constants.py      — Storm system, style guide narrativo
  feature_flags.py  — Feature flags infrastruttura (Fase 1.5)

core/
  models.py         — Intent, Belief, MemoryEntry, Goal, ParsedUserAction
  schemas.py        — Enums: IntentType(13), EmotionalTone(15), EffectType(9)
  state_manager.py  — Effect, EffectTransaction, InvariantChecker

data/
  characters_it.py  — 8 NPC: segreti, agende, oggetti, relazioni (IT, file sorgente)
  characters_en.py  — Patch EN (deepcopy + _NARRATIVE_PATCHES + _OBJECT_PATCHES)
  characters_de.py  — Patch DE (stesso pattern)
  characters.py     — Backward-compat alias (importa da characters_it via loader)
  loader.py         — get_characters(lang), get_player_config(lang) con cache + deepcopy
  map_data.py       — Blackwood Manor: ~28 location, grafo NetworkX
  player_config_it.py — Sebastiano Morel, missione, inventario (IT)
  player_config_en.py — Traduzione EN
  player_config_de.py — Traduzione DE
  player_config.py  — Backward-compat alias

engine/
  game_loop.py      — execute_turn() — orchestrazione turno, dual round, world events
  ai.py             — generate_npc_intent() — decisioni NPC, anti-ripetizione, multipli assassini
  parser.py         — parse_user_intent_llm() — parsing input, stimulus world events + scene context
  resolution.py     — resolve_user_action() — SEARCH/EXAMINE/ACCUSE/SLEEP
  narration.py      — Narrazione movimenti con spoken content, compat langchain v4
  rendering.py      — generate_pov_narrative_llm() — narrazione POV, compat langchain v4
  streaming.py      — StreamingTurnExecutor — SSE streaming, dual round, world events, fallback save
  opening.py        — Scena d'apertura procedurale
  persistence.py    — Save/Load pickle firmato HMAC (v4 con schema migrations)
  persistence_legacy.py — Loader formato save v1 legacy
  initialization.py — initialize_game_state() — setup con NPCMind, WorldEventManager, scene context
  task_handlers.py  — collect_task_effects(), EscortHandler (no force player position)
  world_tasks.py    — Definizioni task NPC

i18n/
  __init__.py       — Package
  loader.py         — get_text(), get_list() con fallback "it"
  locations.py      — ROOM_DISPLAY_NAMES, ROOM_SIMPLE_NAMES, DIRECTION_MASKS × 3 lang
  keywords.py       — Keyword arrays parser fallback × 3 lang
  opening.py        — OPENING_SEGMENTS, INITIAL_SCENE_CONTEXT, greetings × 3 lang
  messages.py       — HTTP_MESSAGES × 3 lang + get_msg()
  prompts/
    __init__.py
    ai_prompts.py           — NPC LLM system prompt blocks × 3 lang
    rendering_prompts.py    — NARRATOR_SYSTEM_PROMPT, SECTION_LABELS × 3 lang
    parser_prompts.py       — PARSER_RULES, PARSER_REPAIR_SUFFIX, CONTEXT_HEADER × 3 lang
    memory_prompts.py       — LTM/CHRONICLE system prompts × 3 lang
    narration_strings.py    — EXIT/ENTRY templates, PRESENCE × 3 lang
    resolution_messages.py  — SLEEP/SEARCH/EXAMINE/INTERROGATE/ACCUSE × 3 lang
    world_event_strings.py  — Blackout stimulus/narrative/restore × 3 lang

systems/
  clock.py          — WorldClock
  knowledge.py      — KnowledgeSystem — Triple Truth (95 righe)
  memory.py         — NPCMemory STM/LTM/Golden + WorldLedger + NarrativeChronicle + ltm_mailbox persistence
  npc_mind.py       — NPCMind 4 livelli (Fase 5) — sostituisce memory+knowledge quando new_memory=True
  scheduler.py      — DailyScheduler — routine e goal NPC
  spatial.py        — SpatialGraph — occupancy, pathfinding
  tension.py        — TensionManager — onda con decay
  world_events.py   — WorldEvent + WorldEventManager (Fase 8.0)

utils/
  api_adapter.py    — Astrazione chiamate LLM
  debug.py          — Stats e debug
  metrics.py        — Metriche operative telemetry (Fase 1.5)
  trace_store.py    — Event logging JSONL
```

## Comandi

```bash
# Avviare il server
uvicorn api:app --reload

# Test (se presenti)
python -m pytest tests/ -v

# Avvio locale CLI
python main.py
```

## Convenzioni di codice
- Lingua: il codice è in inglese, i commenti in italiano, le stringhe narrative in IT/EN/DE (bundle i18n)
- Type hints: usare sempre
- Pydantic: per tutti i modelli dati
- Async: le funzioni del game loop e delle chiamate LLM sono async
- Mutazioni di stato: devono passare per Effect/EffectTransaction (core/state_manager.py)
- Niente mutazioni dirette allo state fuori dalle transazioni
- Commit messages: `fix(faseN): descrizione breve` oppure `feat(faseN): descrizione breve`

## Piano di refactoring attivo
Il piano completo è in `docs/ravenmoor_fix_plan_v2.md` (7 fasi, 0 → 6).
L'analisi dei bug è in `docs/backend_analysis.md` (28 problemi identificati).

### Fasi completate
- **FASE 0** — Fix Dati Statici (fix atomiche a dati hardcoded)
- **FASE 1** — Transazioni Atomiche (Effect/EffectTransaction, invariant checker)
- **FASE 1.5** — Infrastruttura (schema versioning, feature flags, TurnResult, metriche)
- **FASE 2** — Unificazione Pipeline (TurnEngine, queue-based save, SSE backpressure)
- **FASE 3** — Fix Simulazione (adiacenza, cadaveri, SEARCH/ACCUSE, certainty decay, endgame)
- **FASE 4** — Integrazione Arbiter (hook pre/post-LLM, bug fix player exclusion, crisis bypass)
- **FASE 5** — Nuovo Sistema Memoria (NPCMind 4 livelli, consolidamento LLM, dual-run deploy, engine integration)
- **FASE 6** — Progressive Disclosure (situation level L1/L2/L3, token budget, binding_facts L3-only, chronicle async, L2 episodic filtering)
- **FASE 7** — Multi-lingua IT/EN/DE (i18n infrastruttura, traduzioni dati/prompt, API language param)
- **FASE 8** — WorldEvents + Secondo Omicidio + Early Game (8.0 infrastruttura, 8.1 dati personaggi, 8.2 medias-res + blackout)

### Stato: tutte le fasi completate (0 → 8)
- Il piano in docs/ravenmoor_fix_plan_v2.md (fasi 0-6) completato interamente
- Fase 7 (multi-lingua) e Fase 8 (world events) implementate su branch dedicati

### Dipendenze tra fasi
```
Fasi 0+1 in parallelo → 1.5 → Fasi 2+3 in parallelo → Fasi 4+5 → Fase 6
```

### Sviluppo post-fasi (branch sistema-a-2-turni)

**Hotfix post-review** (`0a17f92`, `ba0c3d6`)
- UniqueConstraint fix, SSE refund/race condition, player_killed handling
- Streaming state/refund, CAS rollback, NPC lock, rendering, murder failsafe

**Sistema a 2 round per turno** (`a3785fb`)
- NPC proattivi: dual round con Round 1 (NPC agiscono) + Round 2 (player agisce)
- `_pending_r1_moves` per context sharing tra i due round

**Sistema a 2 livelli per i piani NPC** (`aaaec24`)
- Soluzione B: piani NPC con livello strategico e tattico

**Fix persistence — salvataggio su disconnect** (`865be36`)
- Fallback save nel `finally` block del legacy SSE streaming (cattura `GeneratorExit`)
- Nuovo endpoint `GET /api/games/{game_id}/state` per resume senza side-effect
- `ltm_mailbox` persistente: salvato nello state pickle, ripristinato al load

**LOCAL_MODE + Gemini 3 Flash + fix NPC behavior** (`fb3d4ba`)
- `LOCAL_MODE`: auth bypass, SQLite separato, logging
- Upgrade modelli a `gemini-3-flash-preview` con `thinking_level` (medium/minimal/low)
- Anti-ripetizione NPC: `_get_recent_encounters()`, `_get_repetition_warnings()`
- Differenziazione stimoli per ruolo NPC e azioni MOVE
- Selezione casuale hook dialogo per varianza narrativa
- Fix drink task recipient, escort handler no-force-position
- Anti-ping-pong tracking: `last_move_turn`
- `_cancel_refused_tasks()` per cleanup task rifiutati
- Compat langchain-google-genai v4+: content parts come list

**Fix NPC che inventano personaggi inesistenti**
- Eliminati 6 riferimenti a "personale" generico in Mrs. Hudson e 1 in Lord Finchley (`data/characters.py`)
- Identity string Mrs. Hudson: ora specifica "Io e Mr. Gregory gestiamo tutta la villa da soli" (`engine/initialization.py`)
- Prompt NPC: vincolo rafforzato "LISTA COMPLETA ED ESCLUSIVA" con regole esplicite anti-invenzione (`engine/ai.py`)
- Prompt narratore: aggiunta "REGOLA CRITICA: NON INVENTARE PERSONAGGI" con lista dei 9 personaggi (`engine/rendering.py`)

**Fase 7 — Multi-lingua IT/EN/DE** (branch `multilanguage`)
- Infrastruttura i18n completa: `i18n/` con loader, locations, keywords, opening, messages, prompts
- Dati per lingua: `characters_it/en/de.py`, `player_config_it/en/de.py` con `data/loader.py`
- Pattern deepcopy+patch per EN/DE (narrative + objects patches)
- API: `POST /api/start {"language":"en"}`, `game.language` in DB, `state["game_language"]` in pickle
- Schema migration v3: aggiunge `game_language` default "it" a save vecchi
- Feature flag: `multilanguage: True`

**Fase 8 — WorldEvents, Secondo Omicidio, Early Game** (branch `nuovo-plot-system`)
- **8.0 — WorldEvent system** (`systems/world_events.py`):
  - `WorldEvent` dataclass: trigger_turn/condition, stimulus/narrative text, state/restore effects, duration
  - `WorldEventManager`: register, check_and_fire, get_active_events, get_expiring_events, tick
  - Integrato in streaming.py (sezione 1.7) e game_loop.py per entrambi i path
  - Narrativa emessa PRIMA degli NPC (firing e restore), stimulus iniettato nel parser (Priority 1.5)
- **8.1 — Secondo omicidio Julian→Holloway + subplot arricchiti**:
  - Julian: `murder_goal`, `secret_goal`, 4 nuovi oggetti, dialogue hooks
  - Holloway: rivoltella + lettera confessione + fact julian_clara
  - Gregory: lettera scuse 1958 + registro servizio + fact 1957
  - Mrs. Hudson: diario + foto + lettera al figlio giornalista (secret aggiornato)
  - Beatrice: diario privato (riconosce Vance) + fact about_vance_motive
  - Clara: polizza vita £100.000
  - 4 SUBPLOT_TRIGGERS (julian murder, holloway armed, hudson journalist, gregory 1957)
  - `engine/ai.py`: guardia multipli assassini (`_has_murder_goal`)
  - `engine/game_loop.py`: `murders` list tracking, rimosso gate singolo omicidio
  - Tutti i dati tradotti in EN/DE con patch pattern
- **8.2 — Early game medias-res + blackout**:
  - `i18n/opening.py`: apertura medias-res (voci concitate) + `INITIAL_SCENE_CONTEXT` per-NPC × 3 lang
  - Blackout evento al turno 4, durata 2 turni, con stimulus rafforzato "PRIORITÀ MASSIMA"
  - Restore: stimulus e narrative separati per quando la luce torna
  - `power_out` esposto nel payload frontend (`api.py` atmosphere)
- **Schema version**: v4 (migration v3→v4: `murders` list + `world_event_manager`)
- **Feature flag**: `world_events: True`

### Note modelli LLM
- Modello corrente: `gemini-3-flash-preview` (unico Flash 3.x disponibile per generateContent)
- `gemini-3.1-flash-preview` NON esiste ancora (testato: 404 NOT_FOUND)
- Modelli 3.1 disponibili: solo `gemini-3.1-pro-preview` (Pro) e `gemini-3.1-flash-image-preview` (image gen)
- Thinking levels: main=medium, parser=minimal, narrator=low — temperatura 1.0 per tutti

### Feature flags (da Fase 1.5 in poi)
Tutti in config/feature_flags.py. Ogni nuovo sistema legge il suo flag.
Il vecchio codice resta attivo quando flag=False.

## Regole per Claude Code
- Prima di modificare un file, leggilo sempre per intero
- Dopo ogni modifica, verifica che il file sia sintatticamente corretto con `python -c "import ast; ast.parse(open('NOMEFILE').read()); print('OK')"`
- Non modificare file fuori dalla fase corrente salvo esplicita richiesta
- Committa dopo ogni fix atomica con messaggio descrittivo
- Se una modifica tocca più di 3 file, chiedi conferma prima di procedere
- Usa il piano in docs/ravenmoor_fix_plan_v2.md come riferimento primario

## Checklist multi-lingua (IT/EN/DE)
Ogni modifica che tocca testo visibile al giocatore o testo iniettato nei prompt LLM DEVE:
1. **Nessuna stringa hardcoded in una sola lingua** — ogni testo user-facing va in un bundle `Dict[str, str]` con chiavi `it`, `en`, `de`
2. **Pattern di lookup standard**: `bundle.get(lang) or bundle["it"]` (fallback italiano)
3. **`lang` si ottiene da**: `state.get("game_language", "it")`
4. **Bundle i18n** in `i18n/` o `i18n/prompts/` — non inline nel codice engine
5. **Verifica a 3 vie**: dopo aver scritto il codice, controllare che ogni nuovo `Dict[str, str]` abbia esattamente 3 chiavi (it/en/de) e che il codice di lookup usi il pattern standard
6. **Compatibilità pickle**: se si aggiunge un campo a un dataclass serializzato (es. `WorldEvent`), usare `getattr(obj, "campo", default)` nel codice che lo legge, per non rompere save vecchi
