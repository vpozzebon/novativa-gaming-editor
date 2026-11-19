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

## 2026-11-18: upstream-native compatibility gate (implemented)

Audited `src/editor-api/external-types/config.d.ts`, `src/editor-api/realtime/connection.ts`,
`src/editor-api/realtime/scene.ts`, and `src/editor/entities/entities-load.ts`.

**Critical compatibility mismatch:** upstream EditorConfig requires numeric `project.id`,
numeric `self.id` and a numeric `scene.uniqueId`. Genesis/Novativa project,
user and scene identifiers are canonical strings. Truncating/hashing an ID into a
number would introduce potential collisions and a parallel identity authority.
A dedicated server-managed, durable, uniquely indexed native alias projection is
needed, or a deliberate upstream-wide string-ID migration; do not invent aliases
in `window.config`.

**Realtime mismatch:** the original Editor initiates a WebSocket connection,
sends `auth{accessToken}`, waits for an authenticated ShareDB connection, subscribes
to document collection `scenes` keyed by numeric `uniqueId`, and handles OT
`submitOp` messages. That protocol is not supplied by the Gaming
`SceneBindingRevision` or `SceneVisualLayoutRevision` read APIs. A real
authenticated, authorized, base-revision-checked ShareDB compatibility service
must map edits to canonical Gaming commands with append-only audit, or the native
Editor must be adapted to a differently specified scene transport. Do not send a
fake `auth` acknowledgement merely to bypass its loader.

New `src/novativa/native-runtime-contract.mjs` verifies those 10 backend
capabilities, real server-provided positive numeric aliases, a native ShareDB
scene document, and same-origin service endpoints; tests deliberately keep the
current state closed. The Platform BFF counterpart returns a truthful
`novativa.playcanvas.native-runtime.v1` capability document under authenticated
`GET /api/projects/:projectId/gaming/editor/native/runtime?gameId=...&sceneId=...`
with `native_ids:null`, `can_open:false`, `native_config:null` and unavailable
realtime services. This is a **working BFF endpoint**, not a launched Editor.


## Native PlayCanvas scene entity read model (18/11/2026)

The original upstream code at `src/editor/entities/entities-load.ts` expects a ShareDB
`scene:raw` event with `data.entities` as a map. Its `Entity` class expects
`resource_id`, `parent`, `children`, `position`, `rotation`, `scale`,
`components`, `enabled`, tags and template metadata. Importantly, the
upstream `src/editor-api/realtime/scene.ts` can submit ShareDB ops to mutate
entities; a synthetic local scene must **never** be mistaken for an authenticated
writable server document.

Implemented `src/novativa/native-scene-snapshot.mjs` to translate the
existing authorized `novativa.playcanvas.canonical-hierarchy.v1` to these
PlayCanvas entity fields **for read-only inspection**. A safe
`src/novativa/native-scene-read-client.mjs` composes a same-origin authenticated
BFF fetch with that conversion. The root contains canonical binding IDs,
unchanged local transform values and separate immutable asset references.
It marks all entities `enabled:false` and `spatiallyLocated:false`
because the Racing title owns absolute anchor locations; rendering them
all at a fabricated origin would be incorrect. A null local transform is
represented by identity only in the view and explicitly marked not authored.

This is a tested projection **not** a working native PlayCanvas session. It
does not create a ShareDB scene, subscribe to realtime, edit assets or publish
scene changes. For native Editor startup, implement an authorized server-side
ShareDB document/operation adapter with stable scene aliases, scene snapshots,
permission revocation and append-only Gaming writes. Its `scene:raw` must
be bound to that server transport, not an untrusted browser-generated event.
The server must reject every mutation until corresponding Gaming commands,
revision-based concurrency and audit are installed. Do not substitute this
client module for a real backend.



## Server-owned scene read route (18/11/2026)

The native client now retrieves the Platform-owned snapshot rather than
constructing its authority from a browser-only hierarchy:

`GET /api/projects/:projectId/gaming/editor/native/scenes/:sceneId/snapshot?gameId=...`

Platform PR #143 creates a server-side `data.entities` map from the current
authorized Gaming document and advertises it as `urls.scene_snapshot` in
`novativa.playcanvas.native-runtime.v1`. The client validates its
`novativa.playcanvas.server-scene-snapshot.v1` response, scene/game scope,
read-only marker, disabled entities, canonical binding references, and absence
of native ShareDB availability. Cross-project access is always authorized
by Platform using the existing Genesis session and server-side tenancy.

`loadNovativaNativeSceneReadOnly` does **not** emit `scene:raw`, create a
fake ShareDB socket or enable collaboration/writes. Full PlayCanvas native
startup still needs a genuine authorized realtime transport with stable
scene identifiers and server-enforced append-only Gaming operations.


## DEV native Editor hierarchy hydration gate — 19/11/2026

An authenticated user in Novativa Console successfully observed persistent ShareDB scene `vale-ambar`, revision `40`, with **9 entities**. The read-only Game and Scene remain authority of the Gaming and the Platform. The fork's native path already connects `RealtimeConnection` -> `RealtimeScenes.load` -> `RealtimeScene` -> `editor.emit('scene:raw')` -> `entities:load` -> original `EntitiesTreeView` when the **full native editor** is safely bootstrapped.

A new `src/novativa/native-editor-scene-guard.mjs` is applied **only** when the upstream Editor's realtime URL is the strict, same-origin, persistent Novativa DEV websocket. Before forwarding `load:scene` into the existing original PlayCanvas entities loader, it rejects foreign/non-numeric scene identities, mismatched canonical numeric IDs, missing root/children, malformed transforms, unexpected active entities or components, and invalid parent relationships. Rejection emits `realtime:scene:error` and does not hydrate the hierarchy. Standard PlayCanvas operation outside the Novativa socket is unchanged.

Tests build a 9-entity canonical fixture through the fork's existing `buildNovativaPlayCanvasReadOnlyScene` projection and exercise valid IDs, altered IDs, injected active components, malformed spatial state, and mutation-free acceptance.

**This guard does not implement or fabricate a server-owned `EditorConfig`, user identity, missing messenger, native asset API, project settings, or original Editor HTML shell.** Full bootstrap `can_open:false` remains in force, as does the prohibition on writes; a successful transport diagnostic is not proof of the complete PlayCanvas UI. Only turn on native shell after compatible complete configuration and authenticated end-to-end browser validation. No production release.
