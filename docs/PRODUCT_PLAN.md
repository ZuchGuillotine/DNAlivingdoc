# DNA Living Document Product Plan

## Overview

DNA Living Document is a genetics product that turns a user-uploaded DNA file into a vetted, continuously updated report. The product is designed to answer two questions well:

1. What can this specific file reliably say today?
2. What changed later as the underlying evidence evolved?

The system is intentionally conservative. Users should only ever see approved facts that are backed by traceable source snapshots, validated by an internal judge, and governed by a publishing workflow that can be audited and frozen if quality issues are found.

## Product Vision

Create a genetics report that behaves like a living clinical knowledge document rather than a one-time static export. Each report should be:

- immediate after upload
- explicit about coverage and limitations
- transparent about evidence quality
- versioned over time
- capable of notifying users when meaningful changes occur

## Core Product Principles

- Approved facts only: no draft, speculative, or unreviewed content can render in user-facing surfaces.
- Evidence-first UX: every result must carry its evidence tier, source citations, and limitations.
- Versioned truth: each report is pinned to a factset snapshot so users can compare what was known at different times.
- Conservative communication: the system should avoid diagnosis language, treatment advice, or overstating certainty.
- Human oversight where it matters: physician review is used for process approval, audits, and high-impact exceptions rather than as the primary bottleneck for every fact.

## Target User Experience

### 1. Upload and Instant Assessment

A user uploads a DNA file and immediately receives:

- a Coverage Map showing what panels and evidence tiers the file can support
- a Data Integrity score with clear reasons for missingness, duplicates, or parsing limitations
- plain-language explanations of what the system can and cannot infer from the uploaded file

### 2. Vetted Report Generation

The user can generate a report that contains only approved facts. The report should:

- group findings by panel and evidence tier
- include citations for every finding
- show ClinVar star badges where relevant
- explain why a result may be absent when data coverage is insufficient

### 3. Living History and Updates

The report persists as a living document. Over time, the user can:

- view previous report versions
- compare what changed between versions
- receive notifications when a relevant fact changes, is retired, or is reclassified

## User-Facing Features

### Upload DNA File

Upload a supported raw SNP file and receive an immediate parse result with normalized genotype calls.

### Coverage Map

Show coverage by panel and evidence tier, including explicit gaps such as missing rsIDs that block specific interpretations.

### Data Integrity

Provide a 0 to 100 integrity score with reason codes covering parsing issues, duplicates, missingness, and other limitations.

### Vetted Report

Generate a deterministic report pinned to a specific factset version. Every rendered fact must have citations and an approved revision.

### Living Report History

Maintain versioned report history so users can inspect prior snapshots and compare changes in findings, citations, tiers, and trust labels.

### Notifications

Enable in-app update notifications by default, with a user setting to turn them off.

## Internal Product Features

### Fact Gate

A hard enforcement layer that ensures only approved fact revisions can be queried or rendered by any user-facing endpoint.

### Curator Agent

An internal agent that monitors upstream sources and drafts candidate fact revisions when source records change.

### Strict Judge

A validation gate that checks every candidate fact against source snapshots, formatting rules, tier rules, and communication constraints before approval.

### Physician Audit

A periodic audit process that samples newly approved facts and always reviews high-impact changes. The physician adviser can freeze publishing globally if issues are detected.

## Evidence Model

| Tier | Source | UI Label | User Confidence |
| --- | --- | --- | --- |
| 1 | CPIC / FDA | Clinical Guideline | High |
| 2 | ClinVar (>=1 star) | Vetted Clinical Research | Variable |
| 3 | PharmGKB (1A/1B) | Strong Association | Moderate |
| 4 | Peer-reviewed GWAS | Preliminary/Educational | Low |

Tier 3 and Tier 4 can be feature-flagged initially while the product launches with a narrower, more conservative fact library.

## ClinVar Star Handling

ClinVar facts with one or more stars are eligible for inclusion, but star count must be visible and explained.

### Product Rules

- Eligibility rule: any ClinVar record with at least 1 star may be surfaced if it passes internal fact standards.
- Trust rule: star count affects the confidence label and warnings, but does not independently block inclusion.
- UI rule: every ClinVar-backed result shows the observed star count and an expandable explanation of what stars generally mean.
- Disclosure rule: the product must visually distinguish 1-star, 2-star, and 3 to 4-star items and tailor disclaimers accordingly.

## Governance and Safety Model

### Fact Lifecycle

1. Source update is ingested.
2. Curator Agent drafts a candidate fact revision with citations and source snapshot metadata.
3. Strict Judge evaluates the candidate.
4. Approved revisions become publishable.
5. Publishing creates a new factset version.
6. Impact scan identifies affected users and uploads.
7. Notifications and history updates are generated.

### Human-in-the-Loop Model

- The Strict Judge is the primary publishing gate.
- A physician adviser approves the overall process at launch.
- The physician adviser audits a sample of newly approved facts on a regular schedule.
- All high-impact updates are routed into targeted physician review.
- A publishing freeze can be activated if audit failures indicate a quality problem.

## Data Model

### Fact Revisioning

Facts should use a stable `fact_id` and revision-based updates rather than destructive overwrites.

Recommended model:

- `fact_id`: stable identity for a fact concept
- `fact_revision_id`: immutable version for each approved or candidate revision
- `annotation_fact`: points to the latest approved revision only

This supports:

- living history
- diff views
- reproducible reports
- rollback and audit analysis

### Required Fact Fields

Approved fact revisions should store at minimum:

- `clinvar_stars_min`
- `clinvar_stars_observed`
- `confidence_modifier`
- `source_snapshot` as JSON with source identifiers and retrieval timestamp
- `judge_report` as JSON with checks, failures, and scores
- `audit_status` with values such as `not_audited`, `audited_pass`, `audited_fail`
- `fact_revision` metadata for diffing and provenance

### Factset Versioning

Every published report must reference a specific `factset_version` so the system can reconstruct exactly what was visible at generation time.

### User Update Events

Track report-impacting changes with a `user_update_event` model containing:

- `user_id`
- `upload_id`
- `event_type`
- `affected_fact_ids[]`
- `message_template_key`
- `status` such as `pending`, `sent`, or `dismissed`

## Refresh and Notification Strategy

### Default Behavior

Notifications are enabled by default for all users, with a settings toggle for opt-out.

### Scheduled Refresh Cadence

- ClinVar: monthly full refresh
- ClinVar: optional weekly delta scan
- CPIC / FDA: weekly update checks

### Triggered Refresh Events

A targeted refresh should also occur when:

- a relevant ClinVar record changes clinical significance
- review status or star count changes
- a fact is retired or replaced
- a guideline change modifies tier assignment or user-facing interpretation

## Initial Scope Recommendation

Launch conservatively with a small, high-confidence fact library:

- a limited set of Tier 1 CPIC and FDA facts tied to common SNPs
- a small Tier 2 ClinVar set where the rsIDs are broadly represented on consumer genotyping arrays

This keeps the first release operationally manageable while the governance, revisioning, and notification systems mature.

## Delivery Plan

### Phase 0: Rails, Schemas, and Governance

Goal: make fact gating, revisioning, judge flow, and audit controls real before broadening content.

Deliverables:

- Fact Gate enforcement across all user-facing endpoints
- factset snapshotting and membership tracking
- candidate to judge to approve to publish workflow skeleton
- audit mechanism and global freeze switch
- ClinVar star explainer content spec

Success criteria:

- Non-approved facts cannot be displayed.
- The system can publish factset v1 even with a very small fact library.

### Phase 1: Upload, Coverage Map, and Data Integrity

Goal: give users immediate clarity about what their file can answer.

Deliverables:

- provider-agnostic raw SNP parser
- coverage map engine by panel and tier
- integrity scoring heuristic
- upload UX with export guidance
- ClinVar star explainer UI

Success criteria:

- After upload, users immediately see coverage, integrity, and limitations.
- The product explains why certain interpretations are unavailable.

### Phase 2: Vetted Report Generation

Goal: generate stable, queryable reports from approved facts only.

Deliverables:

- deterministic report builder pinned to factset version
- report version storage with active pointer per upload
- user fact instance index for search and filtering
- report UI with tier sections, citations, star display, and coverage-based omissions

Success criteria:

- A user can upload data and receive a stable report pinned to factset v1.
- Reports are searchable by tier and rsID.
- No result renders without citations.

### Phase 3: Living Document, Refresh, and Notifications

Goal: keep reports current and expose meaningful changes over time.

Deliverables:

- source refresh jobs
- Curator Agent v1
- Strict Judge v1
- publish pipeline with factset versioning
- impact scan and default-on notifications
- report history and diff view
- audit sampling and dashboard

Success criteria:

- Source updates can produce newly approved facts and new factset versions.
- Impacted users are notified automatically.
- Users can compare report versions with citations and change reasons.
- Physician audit can freeze publishing when required.

### Phase 4: Hardening and Scale

Recommended follow-up work:

- parser expansion across more provider formats
- observability for parse failures, coverage distribution, and throughput
- user deletion and retention controls
- optional VCF ingestion as a separate epic

## Operating Metrics

The first production dashboard should track:

- parse success rate by provider
- integrity score distribution
- report generation success rate
- number of approved facts by tier
- source refresh throughput and latency
- judge pass and fail rates
- time from source change to published factset
- number of impacted-user notifications sent
- audit pass and fail rates
- count and duration of publishing freezes

## Launch Readiness Checklist

Before broad release, the product should have:

- hard Fact Gate enforcement
- reproducible factset versioning
- source snapshot traceability
- ClinVar star labeling and explainer copy
- in-app notifications and settings control
- audit sampling and freeze operations
- a conservative initial fact library with complete citations

## Summary

DNA Living Document should launch as a narrow but high-trust genetics product. The initial product does not need broad content coverage to be useful. It needs a defensible approval pipeline, transparent evidence labeling, reproducible report history, and a reliable mechanism for telling users when knowledge changes. Once those rails are in place, additional sources and broader interpretation coverage can be expanded safely.
