/**
 * Converts the authorized, read-only Novativa Gaming hierarchy into the
 * entity data shape consumed by the UPSTREAM PlayCanvas Editor's
 * "scene:raw" -> "entities:load" pipeline.
 *
 * No ShareDB connection and no PlayCanvas project ID are fabricated here.
 * This snapshot is NOT a writable realtime scene.
 */
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const isName=value=>typeof value==='string'&&value.length>0&&value.length<=160&&
    /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/.test(value);
const isTriple=(arr,min,max)=>Array.isArray(arr)&&arr.length===3&&
    arr.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max);
const invalid=message=>{throw new TypeError('NOVATIVA_NATIVE_SCENE_INVALID: '+message);};

/** Keep the upstream entity shape exact, but do not infer absent transforms. */
function entity(resourceId,parentId,name,children,transform) {
    return {
        resource_id:resourceId,
        parent:parentId,
        name,
        children:[...children],
        enabled:false, // no absolute Racing anchors -> NEVER render at the fake origin
        tags:[],
        position:[...(transform?.position??[0,0,0])],
        rotation:[...(transform?.rotation??[0,0,0])],
        scale:[...(transform?.scale??[1,1,1])],
        components:{},
        template:null,
        template_id:null,
        template_ent_ids:null
    };
}

/**
 * @param {object} hierarchy Result of authenticated GET /gaming/editor/native/.../hierarchy.
 * @returns {{schema:string,readOnly:true,entities:object,bindings:object,revisions:object,spatiallyLocated:false}}
 */
export function buildNovativaPlayCanvasReadOnlyScene(hierarchy) {
    if (!isRecord(hierarchy)||
        hierarchy.schema!=='novativa.playcanvas.canonical-hierarchy.v1'||
        hierarchy.channel!=='dev'||!isName(hierarchy.game_id)||!isName(hierarchy.scene_id)||
        hierarchy.coordinate_space!=='placement-anchor-local'||
        hierarchy.world_transforms_available!==false||
        !Number.isSafeInteger(hierarchy.binding_revision)||hierarchy.binding_revision<1||
        !Number.isSafeInteger(hierarchy.layout_revision)||hierarchy.layout_revision<0||
        !Array.isArray(hierarchy.entities)||hierarchy.entities.length>512||
        !isRecord(hierarchy.root)||hierarchy.root.entity_id!=='scene_root'||
        hierarchy.root.parent_id!==null) invalid('scope');
    const entities=Object.create(null);
    const bindings=Object.create(null);
    const childIds=[];
    const digest=/^[a-f0-9]{64}$/;
    for (const node of hierarchy.entities) {
        if (!isRecord(node)||!isName(node.entity_id)||node.entity_id==='scene_root'||
            Object.hasOwn(entities,node.entity_id)||node.parent_id!=='scene_root'||
            node.binding_id!==node.entity_id||!isName(node.anchor_ref)||
            !isRecord(node.asset)||!isName(node.asset.definition_id)||
            typeof node.asset.definition_version!=='string'||
            !/^\d+\.\d+\.\d+$/.test(node.asset.definition_version)||
            !digest.test(node.asset.sha256)||typeof node.editable!=='boolean') invalid('binding');
        const t=node.local_transform;
        if (t!==null&&(!isRecord(t)||
            !isTriple(t.position,-200,200)||!isTriple(t.rotation,-180,180)||
            !isTriple(t.scale,0.1,10))) invalid('transform');
        childIds.push(node.entity_id);
        entities[node.entity_id]=entity(node.entity_id,'scene_root',node.binding_id,[],t);
        bindings[node.entity_id]={
            anchorRef:node.anchor_ref,
            assetDigest:node.asset.sha256,
            definitionId:node.asset.definition_id,
            definitionVersion:node.asset.definition_version,
            editableInCanonicalGaming:node.editable,
            authoredLocalTransform:t!==null
        };
    }
    entities.scene_root=entity('scene_root',null,hierarchy.scene_id,childIds,null);
    return {
        schema:'novativa.playcanvas.read-only-scene-snapshot.v1',
        readOnly:true,
        spatiallyLocated:false,
        gameId:hierarchy.game_id,
        sceneId:hierarchy.scene_id,
        revisions:{bindings:hierarchy.binding_revision,layout:hierarchy.layout_revision},
        // This exact map is accepted as data.entities by upstream entities-load.
        entities,
        // Canonical references remain separate from PlayCanvas components.
        bindings
    };
}
