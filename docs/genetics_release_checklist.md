# Genetics Web Release Checklist

## Scope Guardrail
- Confirm all genetics changes are in web paths only (`client/`, `server/`, `db/`).
- Confirm no iOS project files are included in genetics PRs.

## Feature Flag Guardrail
- `WEB_GENETICS_ENABLED` must remain `false` in shared/staging/production-like environments until explicit sign-off.
- Local development can enable genetics with `WEB_GENETICS_ENABLED=true`.

## Data and Migration Guardrail
- Verify genetics migration is applied in the target environment before manual testing.
- Verify `genetics_*` tables exist and are writable.

## Test Guardrail
- Run targeted suites:
  - `npm test -- --runInBand --testPathPattern='(geneticsFactService|geneticsParsingAndCoverage|geneticsReportBuilder|openai|embeddingService)'`
- Resolve or explicitly document any failures before merge.

## Manual Validation Guardrail
- Upload raw SNP text and confirm persisted upload appears in `/genetics`.
- Generate report and confirm:
  - deterministic hash present
  - findings grouped by tier
  - ClinVar stars display and explainer works
  - citations and limitations render

## Merge/Deploy Guardrail
- Keep deployment workflows unchanged until local validation is signed off.
- Capture rollback notes for schema/data changes before first non-local enablement.
