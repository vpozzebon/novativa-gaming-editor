/**
 * Read-only adaptation from the REAL Gaming editor scene-document B2B contract.
 * This is a hierarchy descriptor, not a serialized PlayCanvas scene or World X data.
 */
const ID = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
const DIGEST = /^[a-f0-9]{64}$/;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function invalid(message) { throw new TypeError('NOVATIVA_CANONICAL_SCENE_INVALID: ' + message); }
function name(v) { return typeof v === 'string' && v.length <= 160 && ID.test(v); }
function transform(v) {
    if (v === null) return null; // not authored != identity persisted
    if (!isObject(v)) invalid('transform');
    const check = (key, low, high) =>
        Array.isArray(v[key]) && v[key].length === 3 &&
        v[key].every(n => typeof n === 'number' && Number.isFinite(n) && n >= low && n <= high);
    if (!check('position', -200, 200) || !check('rotation', -180, 180) ||
        !check('scale', 0.1, 10)) invalid('transform bounds');
    return Object.freeze({
        position:Object.freeze([...v.position]),
        rotation:Object.freeze([...v.rotation]),
        scale:Object.freeze([...v.scale])
    });
}
export function projectCanonicalSceneToEditorHierarchy(doc, {gameId,sceneId}={}) {
    if (!isObject(doc) || doc.schema !== 'gaming.editor.scene-document.v1' ||
        doc.game_id !== gameId || doc.scene_id !== sceneId ||
        doc.channel !== 'dev' || doc.coordinate_space !== 'placement-anchor-local' ||
        doc.world_transforms_available !== false ||
        !Number.isSafeInteger(doc.binding_revision) || doc.binding_revision < 1 ||
        !Number.isSafeInteger(doc.layout_revision) || doc.layout_revision < 0 ||
        !isObject(doc.root) || doc.root.node_id !== 'scene_root' ||
        doc.root.parent_id !== null || !Array.isArray(doc.nodes) || doc.nodes.length > 512) {
        invalid('scope or schema');
    }
    const ids = new Set();
    const children = doc.nodes.map(node => {
        if (!isObject(node) || !name(node.node_id) || node.node_id !== node.binding_id ||
            ids.has(node.node_id) || node.parent_id !== 'scene_root' ||
            !name(node.anchor_ref) || !name(node.definition_id) ||
            typeof node.definition_version !== 'string' ||
            !/^\d+\.\d+\.\d+$/.test(node.definition_version) ||
            !DIGEST.test(node.artifact_digest) ||
            typeof node.editable !== 'boolean') invalid('node contract');
        ids.add(node.node_id);
        return Object.freeze({
            id:node.node_id,
            parentId:'scene_root',
            type:'canonical-asset-binding',
            asset:Object.freeze({
                definitionId:node.definition_id,
                version:node.definition_version,
                sha256:node.artifact_digest
            }),
            anchorRef:node.anchor_ref, // NOT an absolute position
            localTransform:transform(node.local_transform),
            editable:node.editable
        });
    });
    return Object.freeze({
        schema:'novativa.playcanvas.canonical-hierarchy.v1',
        gameId,sceneId,
        bindingRevision:doc.binding_revision,
        layoutRevision:doc.layout_revision,
        rootId:'scene_root',
        coordinateSpace:'placement-anchor-local',
        worldTransformsAvailable:false,
        children:Object.freeze(children)
    });
}
