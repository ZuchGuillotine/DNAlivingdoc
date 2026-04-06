# Genetics Web Fact Gate Execution Plan

## Context and Constraints
- Branch: `codex/genetics-web-fact-gate` (created from `origin/main`).
- Scope: web only on this branch (`client/`, `server/`, `db/`), no iOS feature work.
- Release policy: local-only validation first; no deploy workflow changes until acceptance gates pass.
- Migration status: **completed** in collaborator test environment.

## Goals
1. Build a Fact Gate genetics system that only renders approved, cited facts.
2. Support raw SNP upload, coverage/integrity scoring, deterministic report versioning, and living report refresh.
3. Use existing backend/frontend conventions (Drizzle schema in `db/schema.ts`, Express routes in `server/routes`, React pages/components in `client/src`).

## Execution Progress (2026-02-07)
- Completed:
  - New genetics schema entities and migration script added.
  - Fact Gate service and API (`GET /api/genetics/facts`) added.
  - Parser + coverage/integrity services with tests added.
  - Persisted upload endpoint (`POST /api/genetics/uploads`) added.
  - Deterministic report builder + storage endpoint (`POST /api/genetics/reports/generate`) added.
  - Initial web route/page (`/genetics`) and header navigation link added.
  - Tiered genetics report rendering expanded in web UI:
    - findings grouped by tier with confidence labels
    - ClinVar stars shown for Tier 2 findings
    - expandable ClinVar star explanation in report view
    - per-finding citations, coverage/integrity section, and limitations rendering
  - Integrated `mobile-alpha` context/startup refactor into this branch (web-compatible port):
    - fixed duplicate/invalid imports and malformed context service code paths
    - removed double system-prompt injection in `chatWithAI`
    - added parallel context fetches + expanded stack/protocol context wiring
    - fixed pgvector query serialization in embedding search
    - added Vite proxy error handlers to reduce startup race noise while backend boots
    - cleaned OpenAI/embedding test harness and centralized OpenAI jest mock
- Pending:
  - End-to-end manual verification in migrated environment.

## Implementation Snapshot (Working Notes)
- Backend routes added:
  - `GET /api/genetics/facts`
  - `POST /api/genetics/analyze-preview`
  - `GET /api/genetics/uploads`
  - `POST /api/genetics/uploads`
  - `POST /api/genetics/reports/generate`
  - `GET /api/genetics/uploads/:uploadId/report/latest`
- Backend services added:
  - `server/services/geneticsFactGate.ts` (pure Fact Gate logic)
  - `server/services/geneticsFactService.ts` (active factset approved-fact lookup)
  - `server/services/geneticsParserService.ts` (raw SNP normalization + parse stats)
  - `server/services/geneticsCoverageService.ts` (coverage + integrity scoring)
  - `server/services/geneticsCatalogService.ts` (fact-backed coverage reference data)
  - `server/services/geneticsReportBuilder.ts` (stable payload + deterministic hash)
  - `server/services/geneticsReportService.ts` (report generation + persistence)
- Frontend added:
  - `client/src/pages/genetics.tsx`
  - `client/src/App.tsx` route wiring for `/genetics`
  - `client/src/components/header.tsx` navigation link
  - Tiered findings, confidence badges, ClinVar stars, and source rendering in `/genetics`
- Data model / migration artifacts:
  - `db/schema.ts` genetics table definitions and exported types/schemas
  - `db/migrations/20260207_add_genetics_fact_gate_tables.ts`
 - Release guardrail artifact:
   - `docs/genetics_release_checklist.md`

## Test Status (Genetics Scope)
- Added tests:
  - `server/tests/geneticsFactService.test.ts`
  - `server/tests/geneticsParsingAndCoverage.test.ts`
  - `server/tests/geneticsReportBuilder.test.ts`
- Last run:
  - Command: `npm test -- --testPathPattern='(geneticsFactService|geneticsParsingAndCoverage|geneticsReportBuilder)' --runInBand`
  - Result: `3 passed, 0 failed` test suites; `8 passed, 0 failed` tests.

## Test Status (Context/Startup Integration)
- Last run:
  - Command: `npm test -- --runInBand --testPathPattern='(openai|embeddingService)'`
  - Result: `2 passed, 0 failed` test suites; `8 passed, 0 failed` tests.
- Latest combined validation run:
  - Command: `npm test -- --runInBand --testPathPattern='(geneticsFactService|geneticsParsingAndCoverage|geneticsReportBuilder|openai|embeddingService)'`
  - Result: `5 passed, 0 failed` test suites; `16 passed, 0 failed` tests.
- Notes:
  - `tsx` import smoke check was blocked by sandbox IPC permission (`EPERM` on temp pipe).
  - Repo-wide typecheck still has broad pre-existing errors outside this scope.

## Current Blockers / Dependencies
- Repo-wide typecheck (`npm run check`) currently contains pre-existing unrelated failures; collaborators are addressing separately.

## Phase Status
- Phase 0 (Branch/guardrails): `completed` (branch/worktree isolation + feature flag checks + release checklist doc in place).
- Phase 1 (Foundation + Fact Gate): `completed` (core schema + gate + tests complete; migration executed in collaborator environment).
- Phase 2 (Upload/Coverage/Integrity): `in_progress` (persisted upload + parser/coverage services + tests complete; manual validation pending).
- Phase 3 (Deterministic report skeleton + initial UI): `in_progress` (deterministic builder/service + initial web page complete; expanding tiered/star UX and report rendering).
- Phase 4 (Curator workflow): `pending`.
- Phase 5 (Living updates/notifications): `pending`.

## Phase 0 - Branch Isolation and Guardrails
1. Create isolated branch/worktree from `origin/main`.
2. Keep implementation web-only in this branch.
3. Add feature flag `WEB_GENETICS_ENABLED` with default off outside local development.
4. Add verification checklist requiring local test pass before merge/deploy.

## Phase 1 - Foundation (Schema + Fact Gate)
1. Add genetics schema entities:
   - `genetics_uploads`
   - `genetics_genotype_calls`
   - `genetics_coverage_maps`
   - `genetics_citations`
   - `genetics_facts`
   - `genetics_fact_revisions`
   - `genetics_factsets`
   - `genetics_factset_memberships`
   - `genetics_report_versions`
   - `genetics_user_fact_instances`
2. Add migration(s) for these tables.
3. Implement Fact Gate service and API:
   - Return only approved facts in active factset.
   - Reject draft/in-review/rejected records from user-facing responses.
4. Add tests:
   - Fact Gate filtering behavior.
   - Citation presence and status enforcement.
   - Deterministic response shape for report generation inputs.

## Phase 2 - Upload, Coverage, Integrity
1. Add web upload endpoint for DNA files (raw SNP first).
2. Parse and normalize SNP rows.
3. Compute coverage by panel/tier and integrity scoring.
4. Add tests:
   - Parser edge cases (missing genotype, duplicate rsID, malformed rows).
   - Coverage calculations.
   - Integrity reason generation.

## Phase 3 - Deterministic Reports and Tiered UI
1. Build deterministic report generator pinned to factset version.
2. Store report versions and user fact instances.
3. Build web UI route and page for genetics report:
   - Coverage and integrity sections.
   - Tiered findings with citations.
   - ClinVar stars shown for `>= 1`, with expandable explainer.
4. Add tests:
   - Report determinism.
   - UI rendering for confidence tiers and star explainer.

## Phase 4 - Curator Pipeline (Agent + Strict Judge + Audit)
1. Add internal candidate fact workflow (draft/review/approved/rejected/retired).
2. Add strict judge validation checks before approval.
3. Add physician audit sampling tables and controls.
4. Add tests:
   - Workflow transitions.
   - Strict judge rejection on advisory language or missing citation.
   - Audit freeze preventing publish.

## Phase 5 - Living Reports, Refresh, and Notifications
1. Add refresh jobs (scheduled + triggered by high-impact deltas).
2. Publish new factset versions and detect impacted users.
3. Add report history and diff endpoints/UI.
4. Add default-on notification preference for genetics updates.
5. Add tests:
   - Impact scan correctness.
   - Notification opt-out behavior.
   - Version diff output correctness.

## Out of Scope (Explicit)
- No supplement chat context injection in this program.
- No automatic GWAS ingestion.
- No haplotype/star-allele inference from raw SNP.

## Future Test Data Inputs
- Candidate public sources for fixture generation and integration testing:
  - NCBI dbSNP exports (rsID-centered reference validation)
  - openSNP user-contributed genotype files (format variance testing)
- Usage approach:
  - sanitize and store as local test fixtures only
  - do not directly surface unvetted third-party claims in Fact Gate output

## Local Validation Gates
1. `npm run check`
2. `npm run test` and targeted genetics suites
3. `npm run dev:local` manual end-to-end verification
4. `npm run build`
