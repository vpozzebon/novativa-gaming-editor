const documentPattern = /^nps_[a-f0-9]{64}\.([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/;
const validDimension = value => Number.isInteger(value) && value >= 1 && value <= 8192;
const validFlag = value => typeof value === 'boolean';
const fields = new Map([
    ['antiAlias', validFlag],
    ['height', validDimension],
    ['useDevicePixelRatio', validFlag],
    ['width', validDimension]
]);

/** @param {unknown} documentId @param {string} branchId */
export function isNovativaProjectSettingsDocument(documentId, branchId) {
    return typeof documentId === 'string' && documentPattern.exec(documentId)?.[1] === branchId;
}

/**
 * Gaming publishes replacement snapshots. A removed override must restore
 * the attested schema default, including after a reconnect.
 * @param {unknown} snapshot
 * @param {Record<string, unknown>} defaults
 */
export function projectNovativaReadOnlySettings(snapshot, defaults) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        throw new Error('NOVATIVA_PROJECT_SETTINGS_INVALID');
    }
    const entries = Object.entries(snapshot);
    if (!entries.length || entries.some(([key, value]) => !fields.get(key)?.(value))) {
        throw new Error('NOVATIVA_PROJECT_SETTINGS_INVALID');
    }
    return Object.fromEntries([...fields.keys()].map(key => [
        key, Object.hasOwn(snapshot, key) ? snapshot[key] : defaults[key]
    ]));
}
