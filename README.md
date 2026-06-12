# Goal Machine Agent OS

**Research-grounded AI agent that turns any measurable goal into a complete, evidence-backed execution system.**

A three-model pipeline that classifies your goal, retrieves peer-reviewed research, and generates a fully structured Goal Machine configuration — with actions, backup plans, accountability, and stop conditions all traced to cited studies. The agent monitors daily execution, corrects in real time, and detects when the plan is working versus when it needs to be rebuilt.

**[Launch Goal Machine](https://lvvphole.github.io/Goal-Machine)** — the companion app that runs the generated config.

---

## What It Does

Most AI tools give advice based on training data. This system retrieves evidence from a curated corpus of peer-reviewed research and generates recommendations that cite their source. Every action, every backup plan, every quota traces back to a specific study with an effect size.

You input a goal. The agent validates it, retrieves the research, generates the plan, scores its confidence, and monitors execution. When you fall behind, it adjusts. When the plan stops working, it tells you why and rebuilds.

---

## Architecture

```
USER INPUT
     │
     ▼
┌──────────────────────────────────────┐
│  HARNESS (deterministic)             │
│  Input validation, 4 gates, timeout  │
└──────────────┬───────────────────────┘
               │
     ┌─────────▼─────────┐
     │   MODEL A          │  Classifier
     │   Claude Haiku     │  Domain, base rate, risk flags
     └─────────┬─────────┘
               │
          Gate 2: Base rate > 20%?
               │
     ┌─────────▼─────────┐
     │   MODEL B          │  Research Retriever
     │   Claude Sonnet    │  RAG over curated corpus
     └─────────┬─────────┘
               │
          Gate 3: Evidence sufficient?
               │
     ┌─────────▼─────────┐
     │   MODEL C          │  Plan Generator
     │   Claude Sonnet    │  Synthesize into Goal Machine config
     └─────────┬─────────┘
               │
          Gate 4: Schema valid? Citations present? Quota in bounds?
               │
     ┌─────────▼─────────┐
     │   STATE MANAGEMENT │
     │   (deterministic)  │  FSM, versions, confidence, evidence, escalation
     └─────────┬─────────┘
               │
               ▼
     GoalMachineConfig JSON
     renders in Goal Machine UI
```

All three models are swappable via config. The harness logic never changes regardless of which models power it.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, App Router, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL + pgvector) |
| ORM | Prisma |
| Schema validation | Zod |
| Model interface | Anthropic SDK, OpenAI SDK, Instructor |
| Vector search | Supabase pgvector |
| Embeddings | OpenAI text-embedding-3-small |
| Primary models | Claude Haiku 4.5 (classifier), Claude Sonnet 4.6 (retriever + generator) |
| Fallback models | GPT-4o-mini (classifier), GPT-4o (retriever + generator) |
| Deployment | Vercel |

---

## File Structure

```
goal-machine-agent-os/
│
├── app/                              # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/page.tsx
│   ├── goal/
│   │   ├── new/page.tsx
│   │   └── [goalId]/
│   │       ├── page.tsx
│   │       ├── execution/page.tsx
│   │       ├── evidence/page.tsx
│   │       ├── versions/page.tsx
│   │       └── escalations/page.tsx
│   └── settings/models/page.tsx
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   └── Header.tsx
│   └── goal/
│       ├── GoalIntakeForm.tsx
│       ├── ValidationGate.tsx
│       ├── StateMachineView.tsx
│       ├── DailyExecutionLoop.tsx
│       ├── ConfidencePanel.tsx
│       ├── ObservabilityDashboard.tsx
│       ├── EvidenceLedger.tsx
│       ├── VersionHistory.tsx
│       └── EscalationPanel.tsx
│
├── lib/
│   ├── models/                       # Swappable model interface
│   │   ├── interface.ts
│   │   ├── anthropic.ts
│   │   └── openai.ts
│   ├── harness/                      # Deterministic pipeline
│   │   ├── pipeline.ts
│   │   ├── gates.ts
│   │   ├── retry.ts
│   │   └── model-router.ts
│   ├── state/                        # 5 state management primitives
│   │   ├── machine.ts
│   │   ├── version-store.ts
│   │   ├── confidence.ts
│   │   ├── evidence.ts
│   │   └── escalation.ts
│   ├── loops/                        # Execution loops
│   │   ├── daily.ts
│   │   ├── weekly.ts
│   │   └── convergence.ts
│   ├── corpus/                       # RAG pipeline
│   │   ├── ingest.ts
│   │   └── store.ts
│   ├── schemas/                      # Zod schemas (10 files)
│   └── db/supabase.ts
│
├── api/                              # API route handlers
│   ├── goals/create.ts
│   ├── goals/correct.ts
│   ├── goals/evaluate.ts
│   ├── goals/retry.ts
│   ├── state/[goalId].ts
│   └── versions/rollback.ts
│
├── prompts/                          # Markdown prompt templates
│   ├── classifier.md
│   ├── retriever.md
│   ├── generator.md
│   └── verifier.md
│
├── prisma/schema.prisma              # Database schema
├── tests/                            # 6 test files
└── docs/                             # 4 documentation files
```

---

## State Machine

Every goal is in exactly one state. Transitions are triggered by the harness, not by models.

```
SETUP → activate → ACTIVE
ACTIVE → gap detected → CORRECTING → validated → ACTIVE
ACTIVE → 5 no-response → BREAKER → retry success → ACTIVE
ACTIVE → flatline 3 weeks → STALLED → rebuild → REBUILDING → validated → ACTIVE
ACTIVE → goal hit → COMPLETED
Any 3x failure → ESCALATED → user resolves → ACTIVE
```

**States:** SETUP, ACTIVE, CORRECTING, BREAKER, STALLED, REBUILDING, ESCALATED, COMPLETED, ABANDONED

---

## Confidence Engine

Every output is scored before it reaches the user.

```
Confidence = (evidence_quality × 0.35)
           + (evidence_quantity × 0.20)
           + (domain_match × 0.25)
           + (user_data_density × 0.20)
```

| Score | Action |
|---|---|
| > 0.80 | Apply automatically |
| 0.50 to 0.80 | Present with caveats |
| 0.30 to 0.50 | Escalate for human review |
| < 0.30 | Reject, insufficient evidence |

Confidence decays 2% per day without fresh user data. Floor at 0.30.

---

## Research Corpus

Evidence is retrieved from a curated corpus of peer-reviewed research. No open-web scraping. Papers are ingested as PDFs, chunked, embedded, and stored in Supabase pgvector.

Foundational sources include:

- Locke & Latham (2002) — goal-setting theory
- Lally et al. (2010) — habit formation, 66-day study
- Gollwitzer (1999) — implementation intentions
- Fogg (2009) — behavior model, tiny habits
- Oettingen (2012) — mental contrasting, WOOP
- Deci & Ryan (2000) — self-determination theory
- Hall et al. (2011) — metabolic adaptation
- Dunlosky et al. (2013) — effective study strategies
- Harkin et al. (2016) — meta-analysis on goal monitoring
- Dixon & Adamson (2011) — Challenger Sales

Every recommended action cites its source. Every backup plan names the study behind it.

---

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/goals/create | Generate config from goal input |
| POST | /api/goals/correct | Daily gap correction |
| POST | /api/goals/evaluate | Weekly evaluation |
| POST | /api/goals/retry | Graduated retry on circuit breaker |
| GET | /api/state/[goalId] | Current state and history |
| POST | /api/versions/rollback | Roll back to previous config version |

---

## Database Schema (8 tables)

| Table | Purpose |
|---|---|
| goals | Goal records with current state and confidence |
| config_versions | Append-only config history with diffs |
| evidence | Research records with quality scores |
| action_provenance | Links actions to source evidence |
| state_transitions | Immutable log of every state change |
| escalations | Escalation records with resolution tracking |
| execution_events | Daily log entries |
| agent_runs | Model call log with token usage and cost |

---

## Execution Loops

**Daily Correction:** Computes gap (required pace minus actual pace). Detects convergence phase (early = rebuild, mid = adjust, late = fine-tune). Calls Model C for a correction sized to the phase. Enforces learning rate: max one structural change per cycle, never zero change when behind.

**Weekly Evaluation:** Aggregates 7-day completion rates. Detects flatline (3 consecutive weeks within 3% of each other). Detects L-to-G broken (actions on target but goal not moving). Compares current version performance against two weeks prior. Triggers rebuild or rollback recommendation.

**Graduated Retry:** On circuit breaker (5 consecutive no-response actions), generates a structured retry sequence: different channel, different message, different contact, then dormant. Each retry vector supported by evidence.

---

## Escalation System

Seven escalation triggers:

| Trigger | Response |
|---|---|
| Confidence below threshold | Return partial config with flagged gaps |
| No corpus match for domain | Return general behavioral science framework |
| Contradictory evidence | Present both sides, user decides |
| 3 consecutive model failures | Return last successful partial output |
| All retry vectors exhausted | Analysis of what failed, next steps |
| User rejected recommendation 3 times | Pause recommendations for that dimension |
| Rebuild failed to improve trajectory | Recommend goal reformulation |

Graceful degradation: full plan → partial with caveats → general framework → escalation → rejection with explanation.

---

## Setup

### Prerequisites

- Node.js 20+
- Supabase account
- Anthropic API key
- OpenAI API key (for embeddings and fallback)

### Install

```bash
git clone https://github.com/Lvvphole/goal-machine-agent-os
cd goal-machine-agent-os
npm install
```

### Environment

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

### Database

```bash
npx prisma db push
npx tsx lib/corpus/seed.ts
```

### Run

```bash
npm run dev
```

### Deploy

```bash
vercel --prod
```

---

## Model Configuration

Models are swapped in `lib/models/` without touching pipeline logic. Default config:

```
Classifier:  claude-haiku-4-5  (fallback: gpt-4o-mini)
Retriever:   claude-sonnet-4-6  (fallback: gpt-4o)
Generator:   claude-sonnet-4-6  (fallback: gpt-4o)
Embeddings:  text-embedding-3-small
Temperature: 0.0 (all models, enforced by harness)
```

---

## Operating Principle

The models are probabilistic. The harness is deterministic. The research corpus is the ground truth.

Every recommendation traces back to a cited study. The harness enforces this before any output reaches the user. The agent does not give advice. It retrieves evidence, structures it, scores its confidence, and monitors execution.

The system is the product. The research is the authority. The models are translators.

---

## Related

- **[Goal Machine App](https://lvvphole.github.io/Goal-Machine)** — the companion execution tracker this agent populates
- **[Goal Machine v5.0 Ruleset](https://github.com/Lvvphole/Goal-Machine/blob/main/README.md)** — the 82-rule, 17-phase framework this agent implements

---

Built on systems thinking, decision theory, game theory, gradient descent optimization, and the Hormozi Value Equation.
