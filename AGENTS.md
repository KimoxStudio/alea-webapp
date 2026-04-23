<claude-mem-context>
# Memory Context

# [alea-webapp] recent context, 2026-04-23 3:53pm GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,937t read) | 353,515t work | 95% savings

### Apr 17, 2026
S24 KIM-380 PR #114 — QA Cycle 2 Deep Validation + Security Review Post-Fix (Apr 17 at 11:10 AM)
S1 User says QA manual is cancelled — verify latest plan reflects this (Apr 17 at 11:10 AM)
S31 KIM-380 — Fix dual QR generation on removable_top tables + Caveman plugin duplicate hook cleanup (Apr 17 at 12:42 PM)
S35 Login UX Redesign — Execute docs/login-layout-redesign-plan on new branch, commits only, no PR (Apr 17 at 12:57 PM)
S41 .gitignore multimedia exclusions removed — *.png, *.pdf, *.webm patterns deleted and pushed (Apr 17 at 1:10 PM)
S43 KIM-380 PR #114 — Review and respond to PR comments in English, preserve user-requested changes, two QA + team review cycles (Apr 17 at 1:29 PM)
S140 alea-webapp session start — caveman ultra mode, handoff state read (Apr 17 at 1:48 PM)
### Apr 21, 2026
S147 alea-webapp KIM-381 — PR #115 review comments resolved, test suite audited, branch pushed (Apr 21 at 10:23 AM)
S156 User asked why Claude was editing Codex files instead of Claude files — debugging caveman ultra mode not persisting (Apr 21 at 11:38 AM)
### Apr 22, 2026
1041 10:51a ✅ alea-webapp Linear Housekeeping — KIM-382 Started, Stale Issues Cancelled
1043 10:52a 🔵 alea-webapp KIM-382 — Check-in Activation Architecture Fully Mapped
1046 " 🔵 alea-webapp KIM-382 — Critical Conflict: cancel-pending Cron Fires at start+20min, Blocks 60-min Activation Window
1048 10:53a 🔵 alea-webapp — 3 Orphaned Locked Worktrees Detected
1049 10:54a 🔵 alea-webapp KIM-382 — Check-in Activation Window Logic Confirmed
1051 " 🟣 alea-webapp KIM-382 — Check-in Late Window + GRACE_PERIOD_MINUTES Bump
1054 10:55a 🔵 alea-webapp KIM-382 Branch — Typecheck + Build Green, Files Staged
1056 10:57a 🔵 activateReservationByTable Check-In Window Architecture
1059 " ✅ activateReservationByTable — 4 Boundary Tests Added for Late Check-In Window
1061 11:03a 🔵 alea-webapp Full Test Suite — Node.js Heap OOM on Full Run
1062 11:06a 🔵 alea-webapp KIM-382 — reservations-service.test.ts OOM Crash on activateReservationByTable Tests
S160 alea-webapp KIM-382 — Resume plan, check Linear for stale issues, confirm branch state (Apr 22 at 11:09 AM)
1063 11:10a 🔵 alea-webapp — Full CI Validation Green on develop (Apr 22)
1064 " 🟣 alea-webapp KIM-382 — 60 New Test Lines Staged in reservations-service.test.ts
1065 11:11a ✅ alea-webapp KIM-382 — Reservation Service Tests Committed + Pushed to Remote
1067 11:13a 🔵 alea-webapp — Vitest Config: CLUB_TIMEZONE Pin + Test Structure Confirmed
1068 " ✅ alea-webapp — Vitest Pool Changed to Forks with maxForks: 2
1070 11:16a 🔵 alea-webapp — Vitest Forks Pool Causes Worker Crash: ERR_IPC_CHANNEL_CLOSED
1071 11:17a 🔴 alea-webapp — Vitest Pool Reverted to Threads After Forks Worker Crash
1073 11:20a 🔴 alea-webapp — Test Scripts Get NODE_OPTIONS=--max-old-space-size=4096 to Fix Worker OOM
1074 11:23a ✅ alea-webapp KIM-382 — Vitest OOM Fix Committed to feat/KIM-382-qr-activation-window
1077 11:26a 🔵 alea-webapp KIM-382 — ERR_WORKER_OUT_OF_MEMORY Persists Despite 4GB NODE_OPTIONS Fix
1078 11:27a ✅ alea-webapp — vitest.config.mts Switched from threads to forks Pool with singleFork + execArgv
1080 11:29a ✅ alea-webapp — OOM Fix Reverted: pool config + NODE_OPTIONS Removed from vitest.config.mts + package.json
1082 11:30a ✅ alea-webapp — 28 Server/API/Utils Test Files Patched with @vitest-environment node
1083 11:33a 🔵 alea-webapp — ERR_IPC_CHANNEL_CLOSED After @vitest-environment node Patch — OOM Still Crashes Worker
1084 11:36a 🔵 alea-webapp — Test Suite: 41 Files Pass, ERR_IPC_CHANNEL_CLOSED After Last Component Test
1085 11:37a 🔵 alea-webapp — reservations-service.test.ts Is 2,206 Lines / 93 Tests — Largest Test File in Suite
1086 11:40a 🔵 alea-webapp — pnpm test Still OOM-Crashing After @vitest-environment node Patches
1087 11:46a 🔵 alea-webapp reservations-service.test.ts — Full activateReservationByTable Test Suite Mapped
1088 11:51a 🔵 alea-webapp — No Shared __mocks__ Directory; Each Test File Uses Inline vi.mock
1090 5:01p 🔵 alea-webapp KIM-382 — Branch State Confirmed Clean, vitest.config.mts Lacks Pool Config
1093 5:02p 🔵 alea-webapp KIM-382 — Remaining @vitest-environment node Candidates Identified
1094 " 🔵 alea-webapp — reservation-dialog.test.tsx Full Content Confirmed: Proper jsdom Test, ERR_IPC Cause Unclear
1095 5:04p ✅ alea-webapp KIM-382 — 4 More Test Files Patched with @vitest-environment node
1096 " ✅ alea-webapp — test:coverage Script Updated with NODE_OPTIONS Memory Flag
1097 5:06p 🔵 alea-webapp KIM-382 — Full Test Suite Running with 15 Vitest Threads
1098 5:07p ✅ alea-webapp — vitest.config.mts OOM Tuning: 6GB Heap + NODE_OPTIONS env
1100 5:15p 🔵 alea-webapp KIM-382 — OOM Still Crashing Under threads Pool Despite 6GB Heap
1101 5:20p ✅ alea-webapp KIM-382 — Primary Session Underperforming: Handoff + Plan Update Requested for Codex Delegation
1103 5:33p 🔵 alea-webapp KIM-382 — singleThread: true Still OOM Crashing in tinypool Worker
### Apr 23, 2026
1223 3:09p 🔵 alea-webapp KIM-382 — Current Branch State + Pending Test Blocker
1225 3:11p 🔵 alea-webapp KIM-382 — Uncommitted Working Tree State Confirmed
1226 3:12p 🔵 reservation-dialog.test.tsx ERR_IPC_CHANNEL_CLOSED — Root Cause: Real setTimeout Leak
1227 " 🔵 reservation-dialog.test.tsx — True Root Cause: Radix UI react-presence Infinite Loop in jsdom
1228 " 🔵 reservation-dialog.tsx onOpenChange Guard — Did Not Fix Radix Presence Loop
1229 3:13p 🔴 reservation-dialog.tsx — useEffect Referential Stability Fix Resolves Infinite Re-render Loop
1230 " 🔴 api-client.test.ts — Wrong @vitest-environment node Annotation Removed
1231 " 🔴 alea-webapp KIM-382 — Full Test Suite Green: 42 Files, 521 Tests
1232 " 🔵 alea-webapp — Coverage Branch Threshold Failure: 68.31% vs 75% Required
1233 3:14p 🟣 auth-service.test.ts — 5 New Branch-Coverage Tests Added

Access 354k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>