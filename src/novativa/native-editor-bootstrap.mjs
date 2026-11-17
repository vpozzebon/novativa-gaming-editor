/**
 * Novativa native PlayCanvas Editor bridge readiness.
 * Pure validation: no requests, local storage, token handling or artificial identity.
 * Do not create window.config from partial canonical scene data.
 */
const REQUIRED = Object.freeze([
    'canonical_context',
    'backend_adapter',
    'authorized_asset_delivery',
    'scene_persistence',
    'preview_runtime'
]);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameOriginPath = value => typeof value === 'string' && value.startsWith('/') &&
    !value.startsWith('//') && !value.includes('\\') && !/[\r\n]/.test(value);

export class NovativaNativeEditorUnavailable extends Error {
    constructor(code, details = []) {
        super(code);
        this.name = 'NovativaNativeEditorUnavailable';
        this.code = code;
        this.details = Object.freeze([...details]);
    }
}

/**
 * Accept the BFF response as evidence of availability, never as an EditorConfig.
 * The PlayCanvas native Editor requires realtime/messenger, native scene and
 * project document persistence, asset contracts and an authenticated shell.
 * The present Novativa Console's v1 bootstrap intentionally says can_open:false.
 */
export function inspectNovativaNativeEditorBootstrap(input, expectedProjectId) {
    const response = isRecord(input) && isRecord(input.data) ? input.data : input;
    if (!isRecord(response) ||
        response.schema !== 'novativa.gaming.editor.bootstrap.v1' ||
        response.environment !== 'dev' ||
        !sameOriginPath('/api/projects/' + encodeURIComponent(String(expectedProjectId)) + '/gaming/editor/bootstrap') ||
        typeof expectedProjectId !== 'string' || !/^prj_[A-Za-z0-9_-]+$/.test(expectedProjectId) ||
        response.project_id !== expectedProjectId ||
        !isRecord(response.permissions) ||
        !isRecord(response.requirements)) {
        throw new NovativaNativeEditorUnavailable('NOVATIVA_EDITOR_BOOTSTRAP_INVALID');
    }
    const missing = REQUIRED.filter(key => response.requirements[key] !== true);
    if (response.permissions.can_view !== true || response.permissions.role_can_manage !== true) {
        throw new NovativaNativeEditorUnavailable('NOVATIVA_EDITOR_NOT_AUTHORIZED');
    }
    if (response.can_open !== true || response.permissions.can_edit !== true ||
        missing.length || !sameOriginPath(response.entrypoint)) {
        return Object.freeze({canOpen:false,reason:'NOVATIVA_NATIVE_BACKEND_PENDING',
            missing:Object.freeze(missing), projectId:expectedProjectId,entrypoint:null});
    }
    return Object.freeze({canOpen:true,reason:null,missing:Object.freeze([]),
        projectId:expectedProjectId,entrypoint:response.entrypoint});
}

/**
 * Never promote the v1 bootstrap result to a native PlayCanvas config:
 * missing native API/realtime/messenger and scene contracts must fail closed.
 */
export function requireNovativaNativeEditorBootstrap(input, expectedProjectId) {
    const state = inspectNovativaNativeEditorBootstrap(input, expectedProjectId);
    if (!state.canOpen) throw new NovativaNativeEditorUnavailable(state.reason, state.missing);
    return state;
}
