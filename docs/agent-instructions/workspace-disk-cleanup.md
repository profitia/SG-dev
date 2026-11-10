# WORKSPACE DISK CLEANUP — SAFE MULTI-TASK MAINTENANCE

WORKSPACE DISK CLEANUP — SAFE MULTI-TASK MAINTENANCE
Task type: Local disk cleanup / Workspace maintenance
Scope: Local development machine
Target: Recover at least 10 GB of usable disk space, if safely possible
Mode: Execute safe cleanup autonomously
Product code changes: NOT AUTHORIZED
Git merge / deploy / database changes: NOT AUTHORIZED
1. Objective
The local development machine is running out of disk space because multiple Codex tasks, builds, tests and development worktrees have generated temporary files and caches.
Perform a controlled cleanup of unnecessary local files to recover disk space and unblock active development tasks.
This is a housekeeping task, not a product-development task.
The priority is to remove regenerable, unused files without damaging active work, source code, dependencies required by running tasks, or governance evidence.
2. Analyse disk usage
Before deleting anything:
Check current available disk space.
Identify directories consuming the most space.
Inspect relevant development folders, Git worktrees, temporary folders and build-output directories.
Determine which files are generated, obsolete, unused or safely regenerable.
Identify currently active Codex sessions, worktrees, builds and processes wherever technically possible.
Distinguish active dependencies from orphaned or abandoned dependencies.
Use appropriate disk inspection tools for the current operating system.
Avoid expensive full-filesystem scans when targeted inspection can identify the main consumers.
3. Cleanup candidates
Prioritise the following categories:
A. Build artifacts
Old .next build outputs.
Obsolete dist and build directories.
Generated intermediate compilation output.
Stale bundler caches.
Orphaned build artifacts from completed tasks.
B. Test artifacts
Old test-results directories.
Playwright temporary output.
Generated test screenshots and videos.
Stale test traces.
Coverage reports.
Temporary test databases and fixtures that are verified to be disposable.
Generated benchmark/performance outputs not required as canonical evidence.
Do not delete source tests, source fixtures or regression-test definitions.
C. Development caches
Obsolete npm cache entries.
Stale package-manager temporary downloads.
Vite / Next.js / TypeScript caches.
Expired tool caches.
Other verifiably regenerable development caches.
D. Temporary working files
Abandoned temporary files.
Stale generated logs.
Temporary files from completed builds.
Unused temporary exports.
Orphaned files from terminated tasks.
E. Abandoned development environments
Inspect unused worktrees and old dependency installations.
Only remove items that are positively verified as abandoned or disposable.
Never assume that an old timestamp alone proves an environment is unused.
4. Multi-task safety — critical
Multiple Codex agents may be working on the same machine simultaneously.
Therefore:
Do not interrupt active Codex sessions.
Do not delete files used by active processes.
Do not delete active Git worktrees.
Do not delete dependencies required by another running task.
Do not clean shared build directories while another process is using them.
Do not reset or modify branches.
Do not delete uncommitted or untracked source files.
Do not remove active PMOS runtime dependencies.
Do not touch active task preflight environments.
Do not delete recovery snapshots or rollback material.
Do not remove files belonging to another task merely because they are outside the current worktree.
Where ownership or activity cannot be established, exclude the candidate from automatic cleanup.
Preserve parallel work on SG2, SRM, AppShell, ADP, forecasting and other projects.
5. Governance protection
Never delete:
Canonical source code.
Source test files.
PMOS records.
MEMOROS records.
PHR evidence.
Canonical validation artifacts.
Handoff records.
Active task manifests.
Git metadata or repository history.
Environment configuration or secrets.
Database files or persistent volumes.
Migration files.
Unique backups or recovery snapshots.
A file located in a temporary directory is not automatically disposable.
Confirm its purpose and whether it is referenced by active tasks before removal.
Do not use broad, unbounded recursive deletion against project roots, shared temporary directories or unknown paths.
6. Autonomous execution
You are authorised to remove positively identified, unused, regenerable local artifacts and caches.
Do not require separate approval for every clearly safe cache file.
Execution procedure:
Establish initial free space.
Identify candidate cleanup targets.
Check their ownership and active usage.
Prepare a bounded deletion list.
Remove only approved classes of disposable artifacts.
Recalculate available disk space.
Repeat with the next safe category if necessary.
Stop when sufficient space has been recovered or no further safe candidates remain.
If a cleanup candidate is ambiguous, contains unique data or may affect another active task, do not delete it. Report it separately for explicit owner approval.
Do not delete source-controlled files solely to gain disk space.
Do not run destructive package-manager resets, prune unrelated containers or volumes, or remove shared dependencies without verified safety.
7. Target result
Attempt to recover at least 10 GB of usable disk space.
If that amount cannot safely be recovered, free as much space as possible within the authorised scope.
Do not delete higher-risk files merely to meet the numerical target.
Verify that enough free space remains for dependency installation, tests and build execution.
8. Post-cleanup validation
After cleanup:
Report free space before and after.
Confirm the actual amount recovered.
Verify that active worktrees still exist.
Verify Git repository integrity without modifying repository state.
Confirm active processes were not interrupted.
Confirm active PMOS and development environments remain intact.
Confirm no source code, canonical evidence or persistent business data was removed.
Do not reinstall all removed caches or rebuild every project as part of verification, because that would immediately consume the recovered space.
9. Final report
Provide a concise table:
Category
Space recovered
Action
Build outputs
GB
Removed / Skipped
Test artifacts
GB
Removed / Skipped
Development caches
GB
Removed / Skipped
Temporary files
GB
Removed / Skipped
Abandoned environments
GB
Removed / Skipped
Also report:
Initial free disk space.
Final free disk space.
Total reclaimed space.
Items excluded because another task may be using them.
Any higher-risk cleanup candidates requiring approval.
Whether disk capacity is now sufficient for normal development.
10. Final instruction
Perform the cleanup now.
Do not stop after diagnosis if safe cleanup candidates have been identified.
Prioritise actual disk recovery while protecting every active development task.
Do not modify product code, Git history, databases, deployment environments or governance records.
The expected result is a clean, functional development machine with enough free space for ongoing Codex tasks.
