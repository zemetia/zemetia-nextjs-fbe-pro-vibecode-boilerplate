# Project-Scoped Rules: Autonomous Engineering & Quality Assurance

## 1. Mandatory Test Verification Policy
To prevent repeated deployment failures and ensure high-quality delivery, the agent MUST follow these rules before reporting a task as complete or asking the user to test:

1. **Local Syntax & Compilation Checks**:
   - For JavaScript, always run static check tools or compile commands (e.g., `node -c`) on modified files before deploying.
   - Never deploy files with syntax or import errors.

2. **Automated & Browser Verification**:
   - Whenever a feature (especially user interfaces or document exporter modules like PDF exports) is modified, the agent must run validation tests or launch a browser subagent (`browser_subagent`) to load the application.
   - Verify that the browser console has no uncaught exceptions (e.g., duplicate declarations, undefined references).
   - Simulate the user flow (e.g., clicking the "Cetak PDF" button) to check for visual and functional correctness.

3. **Visual Proof & Verification Reporting**:
   - The agent must provide a summary of what was tested and how it was verified (e.g., showing console logs check, UI validation results, or generating a walkthrough artifact).
   - Only request the user to test when positive proof of verification has been established.

---

## 2. Automated Self-Healing & Regression Guard
1. **Automated Unit & Integration Test Execution**:
   - Whenever any business logic in `modules/` or data handler in `data/` is modified, the agent MUST execute unit tests (`npm run test:unit` or `./node_modules/.bin/jest tests/unit/`) to ensure no existing business workflows are broken.
   - If tests fail, the agent MUST inspect the stack trace, fix the root cause, and re-run tests until 100% green before proceeding.

2. **Security & Permission Auditing**:
   - When introducing or modifying user roles or Firestore queries, audit `firestore.rules` to ensure strict security compliance and role-based access control (RBAC).

3. **Clean Repository Policy (Anti-Pollution)**:
   - Do NOT create loose backup files (e.g. `.bak`, `.cleanup`, `.final`, `.day1backup`).
   - Use Git version control for all tracking. Clean up any temporary scratch files before declaring a task complete.
