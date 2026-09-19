# TIMELINE — EDEN audit

**Repo:** [AFKmoney/EDEN](https://github.com/AFKmoney/EDEN)  
**HEAD at audit:** `b28a356` (plus commits docs 19 sept. 2026)  
**Audit date:** 2026-09-19  
**package.json version:** `1.0.0`  
**Ancien badge README « v3.2.0 LTS »:** marketing, pas le numéro npm. Corrigé dans le README du même commit.

Le fichier `TIMELINE.md` d’avant (2025-01-15, « 328 erreurs TypeScript, 0 % ») était un log d’un agent de correction, pas un état du tree actuel. Il est archivé en bas.

---

## Verdict

EDEN est un **IDE ternaire + VM Kleene + copilot + API agents**, pas un mock.

Le noyau (`CoreEngine`, tables de vérité, TASM→graphe, synthesizers, proxy multi-API avec stream) est écrit et utilisé par l’UI.  
Le backend `:4000` (`src/server/`) est écrit et testé (Jest AND/OR/NOT via `executeAgent`).  
Ce qui cloche : **trois évaluateurs**, **deux dialectes TASM**, **deux process serveur**, docs / versions décalés, fallback API simulé, pas de `LICENSE`, pas de tests sur `CoreEngine`.

Statut global : **kernel réel, packaging pas encore à la hauteur du kernel.**

---

## Architecture réelle (deux process)

| Process | Entrée | Port | Rôle |
|---|---|---|---|
| IDE + SSR + proxy AI | `src/server.ts` (`angular.json` → `ssr.entry`) | `3000` (`npm run dev`) | Canvas, VM navigateur, `/api/cli` + `/api/cli/stream` |
| API agents / auth / templates | `src/server/index.ts` | `4000` (`npm run server`) | Mongo + Redis + JWT + WebSocket + `executeAgent` |

`ng serve` ne démarre **pas** Mongo. Le marketplace / login parlent au backend `:4000`.

---

## Inventaire — ce qui existe dans le code

### Noyau ternaire — `src/app/core/CoreEngine.ts` (~76k)

VM à ticks (`startVM` / `stopVM` / `stepVm`, Hz → interval), propagation par arêtes, undo/redo, collision + clamp canvas, persist `localStorage` (`eden_genome_save`), export/import JSON, stats d’entropie Shannon base-3.

Gates dans `evaluateTernaryGate` (source de vérité du canvas) :

| Gate | Sémantique code |
|---|---|
| `AND` | Kleene min |
| `OR` | Kleene max |
| `NOT` | −x |
| `XOR` | somme balancée mod 3 |
| `CONSENSUS` | égalité → valeur ; mix avec 0 → UNKNOWN ; conflit ±1 → FALSE |
| `MUX` | sélecteur −1 / 0 / +1 sur les canaux suivants |
| `LATCH` | clock +1 strobe → `metadata.memoryState` |
| `CLOCK` | cycle FALSE → UNKNOWN → TRUE |
| `ADDER` / `FULLADDER` | sum + carry sur total ∈ [−3, +3] |
| `COMPARATOR` / `NEURON` / `INVERTER` / `MINMAX` / `LFSR` / `MULTIPLIER` / `PROBE` | implémentés dans le switch / metadata |

Synthesizers : `synthesizeHalfAdder`, `synthesizeFullAdder`, `synthesizeTernaryAlu`, `synthesizeTernaryNeuron`, `synthesizeTernaryMemoryWord`, `synthesizeTernaryDecisionTree`, `synthesizeTernaryLfsr`, `synthesizeTernaryMultiplier`, `synthesizeConsensusArbiter`, `synthesizeRingOscillator`, `synthesizeLogicBench`.

### TASM — `TasmCompilerService.ts`

Compilateur **réel** :

```
INPUT <id>, TRUE|FALSE|UNKNOWN|+1|-1|1
GATE  <id>, <GATE>, <in1>, <in2>...
PROBE <id>, <src>
```

Commentaires `;` `#` `//`. Layout par couches.  
`decompile()` → même dialecte.  
`transpileToVerilog()` : dual-rail 2 bits (`01`=+1, `00`=0, `10`=−1) pour AND / OR / NOT. XOR Verilog ≠ XOR du VM.  
`transpileToCpp()` : stub (`step()` print).

Le dialecte README historique (`SET3`, `ADD3`, `CARRY`, `CONS`, `JMPZ`, `.arch`) **n’est pas parsé** par ce compilateur.

`CompilerService.ts` est autre chose : dump HTML Tailwind des `metadata.content`, pas du HDL.

### Vérif formelle — `TruthTableService.ts`

Produit cartésien 3^N, cap 3 inputs = 27 états, 3 sweeps.  
`evalSimpleGate` est un **deuxième** évaluateur (CONSENSUS mismatch → FALSE tout de suite, pas le même que le CoreEngine).

### Copilot — `EdenAiPipelineService.ts` (~40k)

Contexte graphe + VFS + état VM, JSON `osActions` / nodes / edges / files, boucle OODA, mémoire agent.  
Provider UI par défaut : **`nvidia`**.  
`dispatchAutonomousIntent` : matching local (alu, neuron, ram, lfsr, …) **sans** LLM — ça marche offline.  
Sinon `CliService` → `POST /api/cli` ou stream `/api/cli/stream`.

### Proxy AI — `src/server.ts`

Providers câblés : nvidia, claude, gemini (`@google/genai`), openai, deepseek, groq, mistral, openrouter, local (Ollama). Stream SSE pour chacun. Timeout 120s.  
**Défaut code :** `tool || 'gemini'`.  
Sans clé : `generateSimulatedResponse()` fabrique un graphe JSON de 3 nodes. L’UI reste fluide, ce n’est pas de l’inférence.

`angular.json` définit encore `GEMINI_API_KEY` dans `options.define` (reste template AI Studio).

### Backend agents — `src/server/`

Express + helmet + CORS + rate limit + JWT + Mongo + Redis cache + Socket.IO.  
Routes : auth, users, agents (CRUD, clone, visibility, **execute**), templates (like/rate/fork/download), webhooks HMAC.  
`AgentService.executeAgent` : graphe topologique + VM ternaire **côté serveur** (troisième évaluateur).  
Tests Jest : `tests/AgentService.test.ts` (AND TRUE∧TRUE, OR FALSE∨TRUE, NOT), plus Template / User. Coverage Jest = `src/server/**` seulement.

### UI

Canvas (`SurfaceRenderer`, `NodeRenderer`, `ContextMenu`), palette, library, logic analyzer, truth table modal, TASM studio, provider hub, chat (`ChatPanel` ; `CliPanel` = alias 341 octets), VFS explorer, telemetry, login / register / profile, marketplace.  
Routes : `/login` `/register` `/profile` `/marketplace` + canvas sur `''`.

### Infra présente

Docker (racine + `docker/`), compose, nginx, prometheus, Railway, Vercel, workflows `ci-cd` / `docker-build` / `tests` / `monitor`, scripts deploy/seed, `FIX_ALL_ERRORS.sh` + `scripts/apply_fixes.*` (dette de l’ancien audit 328 erreurs).

---

## Écarts docs ↔ code (corrigés ou ouverts)

| Item | Avant | Réalité | Action |
|---|---|---|---|
| Version | README v3.2.0 LTS | `package.json` 1.0.0 | README aligné 1.0.0 |
| TASM | SET3 / ADD3 / JMPZ | INPUT / GATE / PROBE | README aligné sur le compilateur |
| AI branding | Gemini 2.5 | hub multi-API, défaut UI nvidia, fallback serveur gemini | README générique ; runtime gemini encore là |
| Fichier pipeline | `EdenAiPipeline.ts` | `EdenAiPipelineService.ts` | README corrigé |
| Serveur | un seul `server.ts` | SSR:3000 **et** API:4000 | README corrigé |
| LICENSE | badge MIT | **pas de fichier LICENSE** | ouvert |
| TIMELINE | 328 erreurs figées | log 2025 périmé | ce fichier |

---

## Dette ouverte (priorité)

1. **Un module `evaluateTernaryGate` partagé** — CoreEngine, TruthTableService, AgentService doivent appeler la même fonction. CONSENSUS diverge aujourd’hui.
2. **Un dialecte TASM** — soit le compilateur gagne SET3/ADD3, soit toute la doc reste INPUT/GATE/PROBE (choix actuel du README).
3. **Verilog XOR + C++** — XOR HDL incomplet ; `transpileToCpp` stub.
4. **Défaut AI** — `tool || 'gemini'` dans `src/server.ts` + `angular.json` `define.GEMINI_API_KEY`. Passer à un défaut neutre (`local` ou provider UI).
5. **Simulation silencieuse** — sans clé, le proxy ment (faux graphe). Marquer `[SIMULATED]` ou refuser.
6. **Tests noyau** — half-adder 9 états, CLOCK tick, collision. Jest ne couvre pas `src/app/core`.
7. **LICENSE** MIT manquant à la racine.
8. **Scripts `FIX_ALL_ERRORS.sh` / `apply_fixes.sh`** — ne plus les lancer ; archive ou delete.
9. **Clés dans `localStorage`** (`eden_provider_keys` via `CliService`) — contredit « keys never leave the server ».

---

## Fichiers noyau (tailles HEAD)

| Fichier | Octets |
|---|---|
| `src/app/core/CoreEngine.ts` | 76528 |
| `src/server/services/AgentService.ts` | 44373 |
| `src/app/core/EdenAiPipelineService.ts` | 40224 |
| `src/server.ts` | 27316 |
| `src/app/ui/SurfaceRenderer.ts` | 23830 |
| `src/app/ui/ChatPanel.ts` | 22493 |
| `src/app/core/AgentPersistenceService.ts` | 20018 |
| `src/app/core/TasmCompilerService.ts` | 13351 |
| `src/app/core/TruthTableService.ts` | 7175 |
| `tests/AgentService.test.ts` | 22460 |

---

## Historique court

| Date | Événement |
|---|---|
| 2025-01-15 | Ancien audit agent « 328 TS errors » + scripts sed (`FIX_ALL_ERRORS.sh`). Périmé comme état du repo. |
| 2026-09-19 | Docs : retrait branding Gemini du README / MANUAL / metadata. |
| 2026-09-19 | **Cet audit.** README + TIMELINE réécrits sur le code.

---

## Archive — log 2025-01-15 (ne plus traiter comme vérité live)

Agent « Vibe Code » : 328 erreurs tsc listées (TS1487 octal, TS2322 Response/void, TS2307 `@google/genai`, etc.), 0 correction appliquée selon ce log, scripts `scripts/apply_fixes.sh`, `apply_all_fixes.py`, `fix_typescript_errors.py`.  
Ne pas relancer ces scripts sans re-mesurer `npx tsc --noEmit` sur le HEAD courant.
