# NovaWorks standalone frontend

React 19, Vite 6, JavaScript and CSS. No server, database or provider credentials are required.

From the repository root: `npm ci --prefix app/client`, then `npm run dev`. Build with `npm run build`; serve the build with `npm run preview`.

`src/api.js` is a local browser adapter, not an HTTP client. It keeps the component response shapes stable while using fictional fixtures from `src/preview.js`, localStorage for imported work and sessionStorage for the demo role. Role views are a UI demonstration, not authentication or authorization. Only the supplied sample transcript maps to a predefined plan; custom text is rejected with a clear message. No AI calls are made.

`src/redesign.css` contains the Momentum visual direction; `public/assets/execution-map.svg` is the local custom illustration. Reduced-motion preferences, labeled form controls and mobile menu keyboard behavior are retained.

See the root README for the examiner walkthrough, local commands, deployment and suggested features.
