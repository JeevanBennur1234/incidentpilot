---
name: incident-triage
description: >-
  Runbook for classifying diagnostics payload into failure categories, mapping log
  signatures, and deciding whether to run sandbox reproduction or escalate to a human.
---

# Runbook: Incident Triage

Use this runbook to classify incoming system diagnostics and determine the appropriate auto-fix progression.

## 1. Classification Categories
Classify the incident diagnostics payload into one of these four categories:
- **connection leak**: Database client connection pool is exhausted due to unreleased connections in some paths.
- **memory leak**: Server RAM usage continuously climbs or process crashes with Out of Memory (OOM).
- **unhandled exception**: App crashes due to `uncaughtException` or `unhandledRejection` with raw stack traces.
- **external dependency timeout**: External API calls fail with `ETIMEDOUT` or requests hang on gateway timeout.

## 2. Diagnostic Log Signatures
- **connection leak**:
  - Log events containing `"event":"connection_leak"` or `"event":"pool_acquire_start"` without matching `"event":"pool_release"`.
  - Health check pool stats indicating active connections equal to the pool limit (e.g. `active: 5`, `maxLimit: 5`, `idle: 0`).
- **memory leak**:
  - Error messages like `JavaScript heap out of memory` or `process out of memory`.
- **unhandled exception**:
  - Crash logs containing `ReferenceError`, `TypeError`, or stack traces not wrapped in custom error logger formats.
- **external dependency timeout**:
  - Logs containing `axios timeout`, `ETIMEDOUT`, or connection timeout status codes (504 Gateway Timeout).

## 3. Progression Thresholds
- **Proceed to Sandbox Reproduction**:
  - Classification confidence is **>= 80%** (e.g., clear matching log signatures and health metrics).
  - Proceed to launch Daytona sandbox, run reproduction scripts, and isolate the bug.
- **Escalate Directly to Human**:
  - Classification confidence is **< 80%** (e.g., ambiguous crash dump, conflicting logs, or multiple categories present).
  - Stop automated execution, write triage summary, and flag for operator intervention.
