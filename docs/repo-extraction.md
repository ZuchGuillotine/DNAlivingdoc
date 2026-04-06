# Repo Extraction Notes

This project was copied from:

- parent repo: `Howareyoufeeling`
- source worktree: `.worktrees/genetics-web`
- source branch: `codex/genetics-web-fact-gate`

## Purpose

The goal of this extraction is to preserve the genetics-focused web application as its own project and git repository without rewriting its full history first.

## What Was Kept

- application source under `client/`, `server/`, `db/`, `src/`, and `scripts/`
- existing docs and infra files for continuity
- in-progress genetics routes, services, tests, and migrations from the worktree state

## What Still Needs Review

- product naming still references `Stack Tracker` in multiple places
- domains and cookie names still reference `stacktracker.io`
- infra defaults under `infra/` still use old stack names and secret names
- some archival or local-only files remain in the tree and should be pruned before first public push

## Suggested Publish Flow

1. Create a new empty remote repository.
2. Run `git init` in this directory if it has not already been initialized.
3. Commit the extracted snapshot.
4. Add the new remote.
5. Push `main`.

## Recommended First Cleanup Pass

- update package and app naming
- replace production URLs and auth callback defaults
- audit `.gitignore`
- remove backup/debug/generated artifacts that should not live in the new repo
- decide whether `infra/` ships with this project or moves to a separate infrastructure repository
