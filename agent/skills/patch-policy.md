---
name: patch-policy
description: >-
  Quality and safety rules for the patcher subagent to write correct database pool leak fixes
  and verify them before proposing them for human approval.
---

# Policy: Patcher Code Modifications

Follow these rules strictly when proposing or implementing code patches:

## 1. Fix Patterns for Connection Leaks
- **Try/Finally Block**: Always wrap the acquired database client usage in a `try/finally` block. The `client.release()` call must be executed within the `finally` block to guarantee release regardless of exception status.
- **No Masking**: You **MUST NOT** increase the connection pool size configuration (e.g., changing max from 5 to 50) as a fix. This merely delays pool exhaustion and masks the underlying leak.

## 2. Testing and Validation
- **Sandbox Testing**: All patches must be applied and verified within the isolated sandbox environment first.
- **Verification Criteria**: Run the full test suite (`npm test`, `npm run lint`) inside the sandbox. The tests must pass completely with zero errors.

## 3. Human Review Requirements
- **Single-File Preference**: Keep patches localized and minimal.
- **Review Trigger**: Any patch modifying **more than 2 files** requires a detailed review note for the human operator, explaining the side-effects and reasoning, even if all automated tests pass.
