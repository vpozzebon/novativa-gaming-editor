/**
 * PlayCanvas Editor upstream compatibility gate for Novativa.
 *
 * Upstream EditorConfig uses numeric user/project IDs, string branch IDs and
 * a ShareDB scene document behind authenticated realtime/messenger transports.
 * Canonical Genesis/Platform IDs are strings. Never truncate/hash them into
 * artificial numeric IDs or claim SceneBindingRevision is a ShareDB document.
 *
 * This is a pure validator. No browser secrets, requests or connection attempts.
 */
const record = v => !!v && typeof v === 'object' && !Array.isArray(v);
const privatePath = value => typeof value === 'string' &&
    value.startsWith('/api/projects/') && !value.startsWith('//') &&
    !/[\\\r\n\t#]/.test(value) && !/%(?:2f|5c|0[0-9a-f]|7f)/i.test(value);
const intId = v => Number.isSafeInteger(v) && v > 0;
const id = v => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(v);

export class NativePlayCanvasBackendPending extends Error {
    constructor(missing) {
        super('NOVATIVA_PLAYCANVAS_NATIVE_BACKEND_PENDING');
        this.code = 'NOVATIVA_PLAYCANVAS_NATIVE_BACKEND_PENDING';
        this.missing = Object.freeze([...missing]);
    }
}

/**
 * Arguments must come from an authenticated SERVER-owned manifest,
 * not untrusted window.config or client-provided IDs.
 *
 * A full authenticated shell must construct this only after verifying
 * the equivalent server-side readiness checks independently.
 */
export function inspectNativePlayCanvasRuntime(manifest) {
    if (!record(manifest) || manifest.schema !== 'novativa.playcanvas.native-runtime.v1' ||
        manifest.environment !== 'dev' || !id(manifest.project_id) ||
        !id(manifest.user_id) || !id(manifest.scene_id)) {
        throw new TypeError('NOVATIVA_NATIVE_RUNTIME_MANIFEST_INVALID');
    }
    const missing = [];
    if (!record(manifest.native_ids) ||
        !intId(manifest.native_ids.project) || !intId(manifest.native_ids.user) ||
        !intId(manifest.native_ids.scene)) {
        missing.push('canonical-native-id-aliases');
    }
    const capabilities = record(manifest.capabilities) ? manifest.capabilities : {};
    for (const capability of [
        'native_project_persistence', 'native_scene_persistence',
        'sharedb_scene_read', 'sharedb_scene_write',
        'realtime_authenticated', 'messenger_authenticated',
        'approved_asset_delivery', 'editor_schema_available',
        'runtime_preview_available', 'authorized_editor_shell'
    ]) {
        if (capabilities[capability] !== true) missing.push(capability);
    }
    const urls = record(manifest.urls) ? manifest.urls : {};
    for (const route of ['api', 'realtime', 'messenger', 'assets']) {
        if (!privatePath(urls[route])) missing.push('same-origin-' + route);
    }
    // The native Editor expects genuine server-side ShareDB scene documents,
    // not the immutable Gameplay binding/layout projection.
    if (manifest.scene_document_schema !== 'playcanvas.sharedb.scene.v1') {
        missing.push('native-sharedb-scene-document');
    }
    return Object.freeze({
        ready:missing.length === 0,
        missing:Object.freeze(missing),
        canonicalProjectId:manifest.project_id,
        canonicalSceneId:manifest.scene_id
    });
}

export function requireNativePlayCanvasRuntime(manifest) {
    const readiness = inspectNativePlayCanvasRuntime(manifest);
    if (!readiness.ready) throw new NativePlayCanvasBackendPending(readiness.missing);
    return readiness;
}
