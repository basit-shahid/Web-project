# Frontend demo testing

From the repository root:

```sh
npm ci --prefix app/client
npm run build
npm run preview
```

Use the printed preview address. Follow the examiner walkthrough in the root README to import the sample, explore three projects and twelve tasks, filter the directory, switch demo roles, refresh and reset.

Optional automated acceptance: with Playwright and Chromium already installed, run `node scripts/verify-frontend.cjs`. Set DEMO_URL if the preview port differs from 4173. Set PLAYWRIGHT_MODULE / CHROMIUM_PATH to select preinstalled tools if required. The test uses a fresh browser context and does not alter your usual browser's data. It checks the local workflow, storage recovery, role views, responsive layouts and absence of API calls.

No backend, provider, database or deployed-site tests apply to this branch. See FRONTEND_DEMO.md for the verified scope and limitations.
