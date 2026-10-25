# Frontend-only conversion on basitbranch

The branch retains the Momentum redesign and replaces the network adapter with a browser-only demo adapter. Tracked backend source, server tests, database migrations, serverless API entry point, Docker setup, recording scripts and backend deployment instructions were removed. The full-stack version remains on frontend/momentum-redesign; Git history was not rewritten. Existing ignored local backend configuration, dependencies and data were left untouched and are not part of the pushed frontend branch.

The normal route and the legacy preview query now use the same local demo flow. No backend is required. Importing the exact supplied meeting populates three fixture projects and twelve fixture tasks; unsupported transcripts display an explanation. Local storage retains the imported plan, session storage retains the selected role, and a confirmed reset clears only the demo's plan. Role filters illustrate the intended experience but do not provide security.

Root build/dev/preview scripts, static Vercel settings, CI and the root/client documentation now match the frontend workflow. There are no server dependencies in the root manifest or lockfile. All product assets are local.

## Verification

Verified in the conversion workspace:

- Frozen client dependency install and Vite production build.
- Browser acceptance in Chromium against the static production preview server.
- Sample import: three projects, twelve tasks; duplicate import does not duplicate records.
- Local persistence after refresh; manager sees one project; developer sees three tasks.
- Unsupported transcript error and corrupted-storage recovery through reset.
- Project/task/directory search recovery, mobile menu Escape and focus restoration.
- Projects, details and directory have no horizontal overflow at widths 320, 375, 683, 800, 1024 and 1440.
- Zero /api requests and zero browser JavaScript errors during acceptance.
- Git whitespace checks.

Not claimed: real authentication, authorization, live AI extraction, remote persistence, cross-device sharing, deployment verification, Firefox/WebKit or full accessibility certification.

The optional acceptance script is scripts/verify-frontend.cjs. With Playwright and Chromium already installed, run it while `npm run preview` is serving the build. DEMO_URL selects that address; PLAYWRIGHT_MODULE can point to an installed Playwright module; CHROMIUM_PATH can select an existing Chromium executable. These are development test tools, not runtime dependencies.

## Presentation roadmap (suggestions only)

1. Editable project/task review with owner and date validation.
2. Kanban task states and progress calculated from saved state.
3. Deadline timeline and effort-based team workload.
4. CSV export / printable project summary.

Prefer adding these along the existing meeting → plan → assignment → delivery story over unrelated modules. If AI is later restored, replace the explicit sample import with a real server integration and preserve an honest offline demo option.
