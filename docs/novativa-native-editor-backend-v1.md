# Novativa — native PlayCanvas Editor backend contract (DEV)

Date: 2026-11-17. This repository is the **full upstream PlayCanvas Editor frontend**, not the existing partial PlayCanvas Engine GLB viewport in the Novativa Console.

## Ground truth verified

- Canonical human entry: `https://dev.novativa.com.br/console/gaming/editor`, Genesis/Novativa existing HttpOnly session; no new PlayCanvas login.
- Console BFF: `GET /api/projects/:projectId/gaming/editor/bootstrap` returns `novativa.gaming.editor.bootstrap.v1`, currently `can_open:false`, `entrypoint:null`. Its requirements explicitly show missing backend adapter, native scene persistence and native preview runtime.
- In the fork, `src/editor/index.ts` registers the full upstream Editor features. `src/common/editor.ts` calls `initBackend(rest, clients, config.unsupported)` and initializes realtime, messenger and relay. `src/editor/realtime/realtime.ts` connects to `config.url.realtime.http` and loads a native realtime scene; `src/editor/messenger/messenger.ts` connects to `config.url.messenger.ws`. `src/editor/ready.ts` requires entities/assets loading AND realtime authentication.
- Existing Gaming canonical contracts include SceneBindingRevision and SceneVisualLayoutRevision with signed GameSession read-only projections. They do NOT constitute native PlayCanvas realtime scene documents.
- Native PlayCanvas Editor expects a server-injected `window.config` containing project/user/branch/scene/schema/feature flags/URLs and native REST, realtime, messenger, assets, jobs, collaboration semantics. The fork README's upstream local-dev method relies on playcanvas.com backend and is not a self-hosted deployment.

## Admission contract (implemented here, tested)

`src/novativa/native-editor-bootstrap.mjs` classifies existing BFF v1 response and fails closed:
- Reject wrong schema, Project mismatch, environment other than DEV, missing permission/requirements.
- Require explicit `can_open`, `can_edit`, and all five readiness gates.
- Accept only same-origin path for the native Editor entrypoint, never a hosted PlayCanvas URL.
- Do NOT translate current `can_edit_local_transforms` into native Editor write rights.
- No identity, tokens, AWS, S3, DB access, or calls made by this module; no fallback to fake `window.config`.
- This module does not activate native frontend; it is the checked gate for integration across Console/Platform.

## Canonical read-only hierarchy projection (implemented and tested)

`src/novativa/canonical-scene-projection.mjs` accepts only the real
`gaming.editor.scene-document.v1` from the authenticated Gaming adapter. It
rejects cross-game/scene data, PROD channel, non-local coordinate claims,
duplicate IDs, malformed digests and out-of-bounds transforms. It returns
`novativa.playcanvas.canonical-hierarchy.v1` as a bounded, immutable,
read-only descriptor, **not** the PlayCanvas native scene document, without
inventing world transforms or a second asset registry. One of the confirmed
Racing billboards (`decor-08`) is the regression fixture with independent
anchor-local transform.

When backend document ownership/realtime is implemented, map these
descriptors to the native PlayCanvas entity/asset model behind a server-side
adapter. Do not submit native editor scene ops directly as Gaming events
until permission, base revisions, idempotency and audit are enforced on the
server.

## Backend adapters to build, in order

1. **Platform BFF:** a same-origin authenticated native launch shell, Project entitlement/grant checks, schema-defined config projection, `cache-control:no-store`, CSP for immutable script bundles, no privileged tokens in JS.
2. **Gaming native project and scene read model:** server-side projection from canonical Game/Scene/Bindings/Layout to PlayCanvas entity hierarchy; the title's anchor transforms remain title-owned (no fabricated world positions). Versioning and access audit remain append-only. Support retrieval after reload, authorized writes with expected revisions and idempotency (not client-owned scene blobs).
3. **Realtime/messenger transport:** authenticated, project-scoped notifications and document operation compatibility; choose an authorized server-side adapter, not calls directly to hosted PlayCanvas. Revocation/logout must stop writes and connections.
4. **Asset delivery:** approved GLBs through Console BFF, consistent with existing digest/grants and no browser S3 keys; reject unapproved URLs, scripts, extensions.
5. **Capabilities:** native Editor feature modules turn on only when each operation exists and is authorized; disable native project creation, social, commerce, store, exports, jobs, checkout, merges etc until explicitly implemented.
6. **Pilot:** one DEV Project, `vale-ambar` scene, read-only hierarchy first; only then allow isolated local transform save. Verify refresh, 403/409, cross-tenant, stale version, permission revocation, failure recovery, canonical EventStore and Racing update. No PROD.

## Non-goals and gates

Do not replace the existing working Console Editor or Racing client until a real native backend has passed browser E2E. Don't copy source to a parallel database; no direct browser AWS or internal Gaming endpoints; no PlayCanvas.com credential dependency; preserve source fork and upstream extensions.

Next slice is a **backend project/scene projection and authenticated shell**, not a second viewport.
