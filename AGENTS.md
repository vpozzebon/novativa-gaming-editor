# Agent Guidelines for PlayCanvas Editor

## Project

- TypeScript frontend for the PlayCanvas web-based 3D editor
- Build: Rollup + SWC | Styles: SASS | Lint: ESLint 9 + Stylelint 16 | Test: Mocha + Chai
- Node >=22.x (see `.nvmrc`)
- Commands: `npm run build`, `npm run develop`, `npm run lint`, `npm run fmt`, `npm test`, `npm run typecheck`

## How the Editor Loads

- A backend server renders an HTML shell via Mustache templates
- Injects `var config = {...}` (user, project, flags, URLs) into a `<script>` tag
- Frontend bundle loaded from a configurable base URL; `window.config` drives all runtime behavior
- Page variants:
    - **Editor** — `src/editor/index.ts` → `editor.js` (full editor)
    - **Projects** — `src/projects/index.ts` → `projects.js` (project/scene selection)
    - **Code Editor** — `src/code-editor/index.ts` → `code-editor.js` (Monaco)
    - **Launch** — `src/launch/index.ts` → `launch.js` (app preview)

## Architecture

- Class hierarchy: `Caller` → `Editor<T>` (`src/common/editor.ts`) → `MainEditor` (`src/editor/editor.ts`)
- **Caller pattern** — cross-module communication via `this.call('method:name', ...args)` / `this.method('method:name', handler)`
- **Side-effect imports** — `src/editor/index.ts` registers all modules on import; do not remove imports unless removing a feature
- **editor-api** — `@playcanvas/editor-api` at `modules/editor-api/`, exposes `api.globals.*` (history, selection, assets, entities, realtime); `editor` global injected via Rollup footer

## Conventions

- Path aliases: `@/*` → `./src/*`
- Naming: PascalCase classes, camelCase functions, UPPER_SNAKE_CASE constants, kebab-case files
- Strict TypeScript — all public APIs must have proper type annotations
- Only fix lint issues in code you are modifying
- Styles live in `sass/`, compiled via `compile-sass.mjs`
- Heavy work (texture convert, search, console) goes in Web Workers (`src/workers/`)

## Things to Avoid

- Don't edit `dist/` — generated output
- Don't remove side-effect imports from `index.ts` without understanding consequences
- Don't bypass the Caller pattern for cross-module communication
- Don't add heavy synchronous work to the main thread — use Web Workers
- Don't introduce circular dependencies
- Don't hardcode URLs or config values — use `window.config`

When in doubt, look at similar existing code or ask.


---

## Novativa integration overlay (2026-11-17)

**Important: this is the open-source PlayCanvas Editor frontend fork, NOT the presently running Novativa Gaming Editor.** The user-facing https://dev.novativa.com.br/console/gaming/editor currently lives in [vpozzebon/novativa](https://github.com/vpozzebon/novativa) and uses a bounded **PlayCanvas Engine GLB viewport**, not this fork's complete hosted Editor backend, realtime collaboration or scene/project persistence. Do not claim this full fork is deployed or operational merely because its static bundles build.

### Start here before changing a Novativa integration
1. Preserve all **upstream PlayCanvas conventions above** (Caller, side-effect registration, editor-api, no generated-dist edits). Consult the current package.json for build/runtime scripts: they may have evolved since the upstream guide was authored (the inspected package uses Vite and Node >=22.22.0).
2. Read [Novativa Gaming checkpoint #191](https://github.com/vpozzebon/novativa-gaming/issues/191), [documentation PR #192](https://github.com/vpozzebon/novativa-gaming/pull/192), [Novativa Console Editor docs](https://github.com/vpozzebon/novativa/blob/develop/docs/gaming-editor-console.md), and the actual authenticated Platform/Gaming contracts. Verify live state/target branch first; do not treat a dated checkpoint as a current runtime measurement.
3. For any plan to activate this fork's native Editor, first define an authorized **Console BFF / Gaming HTTP-to-HTTP bootstrap**, window.config contract, project+scene permissions, canonical persistence, allowed GLB delivery and preview/session semantics. **Do not use hosted PlayCanvas backend secrets/accounts as a shortcut**, invent dual scene stores or expose privileged tokens to the browser.
4. Genesis owns canonical identity and tenant/workspace; Novativa Platform owns Project/role/entitlement and Console same-origin auth; Gaming owns immutable GLB definitions, grants, SceneBindingRevision, append-only SceneVisualLayoutRevision and GameSession; Racing owns physical track anchors; World Runtime owns persistent entities. This fork must not acquire those authorities.
5. All writes must be scoped, authorized, idempotent, audited and append-only through trusted backend adapters. Avoid direct browser access to databases, internal APIs, AWS or Secrets Manager. Reject spoofed tenant/workspace values and permission ambiguities.
6. Never silently deploy this fork to DEV/PROD or replace the working partial Editor. Implement native capabilities behind explicit compatibility gates, test separately, and keep existing Racing gameplay unaffected.

### What is already proven vs pending
- **Elsewhere, not in this fork:** users demonstrated Racing hot-load of GLBs and the partial Console Editor's Save/Reset/Duplicate, camera auto-fit and XYZ gizmo.
- **Outstanding:** GameSession feed HTTP 401 in a stale Racing tab (server r19/8 GLBs versus client r18/7), outdoor material/logo blank, world-position/clone locator, and full native Editor backend.
- **Future only:** [Gaming Ads #189](https://github.com/vpozzebon/novativa-gaming/issues/189) (per-session creative decisions, campaigns, measurement and billing).
- Source of truth: source files, CI, live authorized APIs and published GameVersion, not cached conversation state. Document the exact test evidence and deployment state before claiming success.
