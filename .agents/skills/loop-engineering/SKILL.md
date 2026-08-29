---
name: loop-engineering
description: Execute tasks using strict Closed-Loop Engineering protocol (#loop). Anti-quick-patch, first-principles systemic analysis, 5 extreme edge-case failure mode stress tests, autonomous self-verification loop, and holistic production-grade delivery.
---

# Closed-Loop Engineering Protocol Agent (`#loop`)

You are operating under the **Closed-Loop Engineering** protocol. This protocol enforces rigorous root-cause analysis, stress-testing against catastrophic edge cases, autonomous self-verification, and complete, production-grade delivery. Quick patches and superficial fixes are strictly forbidden.

---

## Trigger & Invocation

This protocol is activated when:
- The user includes `#loop` in their prompt (e.g., `#loop [task / issue description]`).
- The user requests **Closed-Loop Engineering**, **Metode Closed Loop**, or deep systemic debugging.
- Mission-critical, distributed, concurrent, or financial/transactional systems are undergoing refactor or debugging.

---

## 4 Core Pillars of Closed-Loop Engineering

### 1. First-Principles Systemic Analysis (Anti-Quick-Patch)
- **Zero Guesswork / No Symptom Patching**: Reject superficial fixes that merely suppress errors or mask race conditions.
- **Architectural Dissection**: Trace the data lifecycle from first principles:
  - Inter-Process Communication (IPC) serialization & protocols.
  - Concurrency models (async events, thread pools, file & network locks, shared memory).
  - Race conditions, re-entrancy, and state mutations.
  - Data integrity across storage tiers (Memory -> Local Cache -> Persistent Disk / Cloud DB).

### 2. Exhaustive Edge-Case Matrix (5 Extreme Failure Modes Stress-Test)
Every proposed design, refactor, or bugfix must be explicitly stress-tested against the **5 Extreme Failure Modes**:

1. **Racy Partial Reads & Corrupt Binary/JSON Payloads**:
   - Incomplete writes during concurrent access.
   - Broken packets, corrupt chunk deserialization, truncated streams, or schema mismatches.
   - *Mitigation required*: Atomic write-rename patterns, CRC/checksums, schema validation guards, transaction boundaries.

2. **I/O Latency, OS Disk Buffer Caching & Disk Locks**:
   - Non-flushed OS disk buffers causing data loss upon unexpected shutdowns.
   - Stale cache reads, file locking contention, or thread starvation during high I/O burst.
   - *Mitigation required*: Explicit sync/flush routines (`fsync`), non-blocking lock strategies, exponential backoff.

3. **Clock Drift, Timezone Shifts & Timestamp Desync**:
   - Monotonic time vs wall-clock skew across different runtime environments / clients / servers.
   - Out-of-order event arrivals due to NTP sync jumps or local clock lags.
   - *Mitigation required*: Monotonic sequence counters, UTC timestamp enforcement, logical clocks (Lamport/Vector) if distributed.

4. **Transient Disconnect / Network Lag vs Genuine Terminal Crashes**:
   - Distinguishing temporary network jitter/timeout from unrecoverable process termination.
   - Heartbeat dropouts, reconnect storms, and duplicate/idempotent packet retries.
   - *Mitigation required*: Exponential retry with jitter, idempotency keys, explicit connection state machines (Disconnected vs Reconnecting vs Dead).

5. **Memory/Buffer Flushing, State Persistence & Real Emergency Scenarios**:
   - Last-known-good snapshot persistence when process crashes mid-cycle.
   - High-severity domain-specific real emergencies (e.g., Margin Call / Stop Out in trading, balance mismatch in accounting, vault discrepancy in gold inventory) vs False Lag.
   - *Mitigation required*: Debounced snapshots, atomic checkpointing, fail-safe circuit breakers, automated rollback mechanisms.

### 3. Autonomous Verification & Self-Correction Loop
- **Self-Critique Simulation**: Internally simulate worst-case scenarios and attack your own implementation before presenting it.
- **Failure Mode Defense Checklist**: Do not declare completion until every identified failure mode has a verified, solid fail-safe and fallback mechanism.
- **Evidence-Based Proof**: Verify code with unit/integration tests, syntax checks, compilation tests, or logic proofs.

### 4. Holistic Delivery (Production-Grade & Bulletproof)
- Deliver the **complete, integrated solution** addressing all affected touchpoints, not disconnected snippets that leave new vulnerabilities open.
- Provide full backwards compatibility, graceful error recovery, and clear observability (logging/metrics).

---

## Standard Operating Execution Workflow

Whenever `#loop` is invoked, execute and structure the output in the following standardized format:

```markdown
### 🔍 1. First-Principles Systemic Diagnosis
- **Problem Statement**: [Expected vs Actual behavior]
- **Architectural Breakdown**: [IPC, concurrency, state flow, and data lifecycles involved]
- **True Root Cause**: [In-depth root cause identified from first principles, eliminating surface symptoms]

---

### ⚡ 2. 5-Scenario Edge-Case Stress-Test Matrix
| # | Skenario Kegagalan Ekstrem | Potensi Dampak / Risiko | Mekanisme Pertahanan (Fail-Safe / Fallback) |
|---|---|---|---|
| 1 | **Partial / Corrupt Payload Read** | [Risk] | [Atomic writes, validation guards, CRC/Schema check] |
| 2 | **I/O Latency, Disk Lock & Buffer Flush** | [Risk] | [Explicit flush/sync, timeout backoff, lock release] |
| 3 | **Clock / Timestamp Drift** | [Risk] | [UTC + monotonic counter, sequence validation] |
| 4 | **Transient Drop vs Terminal Crash** | [Risk] | [State machine, exponential jitter retry, idempotency] |
| 5 | **State Snapshot & Real Emergency Event** | [Risk] | [Last-good snapshot persistence, circuit breaker, rollback] |

---

### 🛠️ 3. Holistic & Bulletproof Implementation
[Provide the complete, integrated, production-grade code with zero partial holes or leftover placeholders]

---

### 🔄 4. Autonomous Verification & Stress Simulation
- **Simulated Stress Results**: [Explain how the solution handles burst, crash mid-write, disconnect]
- **Verification Evidence**: [Unit tests, syntax validations, build verification results]

---

### 🛡️ 5. Failure Mode Defense & Fallback Summary
- Summary of fail-safes and fallback paths ensuring 100% operational resilience.
```

---

## Dual-Language Prompt Templates

### Bahasa Indonesia
> *"Terapkan metode Closed-Loop Engineering secara ketat untuk task ini:*
> 1. *Analisa Sistemik (Root Cause, Bukan Gejala): Jangan lakukan quick patch atau menebak-nebak. Bedah arsitektur sistem dari first principles (protokol komunikasi, konkurensi antar-proses, race condition, dan integritas data).*
> 2. *Matriks Skenario Ekstrem (Edge-Cases Stress-Test): Uji dan verifikasi rancangan terhadap 5 skenario kegagalan (Partial/Corrupt read, I/O latency & disk lock, Transient disconnect vs crash, State persistence & buffer flushing, Kondisi darurat riil vs false lag).*
> 3. *Autonomous Verification Loop: Lakukan self-critique dan simulasi logika secara mandiri. Jangan klaim selesai sebelum semua failure modes memiliki fail-safe dan fallback terbukti solid.*
> 4. *Deliverable Tuntas: Berikan solusi lengkap terintegrasi, bukan potongan solusi yang menyisakan celah baru."*

### English
> *"Execute this using a strict Closed-Loop Engineering protocol:*
> 1. *First-Principles Root-Cause Analysis: Do not apply superficial patches. Analyze the full distributed architecture (file/network concurrency, race conditions, IPC serialization, state integrity).*
> 2. *Exhaustive Edge-Case Matrix: Stress-test your design against all edge failure modes (Racy partial reads and corrupt binary payloads, OS disk buffer caching and lack of flush, Timestamp / clock drift across environments, Transient network drops vs genuine terminal crashes, Memory/buffer flushing and last good snapshot persistence).*
> 3. *Autonomous Verification & Self-Correction Loop: Iterate and verify internally through simulated stress scenarios. Ensure data persistence and debounced timeouts are in place before declaring completion.*
> 4. *Holistic Delivery: Deliver a bulletproof, production-grade implementation that resolves the core architectural bottleneck permanently."*
