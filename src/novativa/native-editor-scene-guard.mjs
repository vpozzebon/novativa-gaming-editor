/**
 * Strict boundary between canonical Novativa Gaming ShareDB read snapshots
 * and the ORIGINAL PlayCanvas Editor entity hierarchy loader.
 *
 * This is not an EditorConfig, a scene store, or an authorization grant.
 * The upstream RealtimeScenes already emits load:scene and the native
 * Editor's entities-load consumes scene:raw. We validate before forwarding.
 */
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const triple=(value,min,max)=>Array.isArray(value)&&value.length===3&&
    value.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max);
const error=()=>new TypeError('NOVATIVA_NATIVE_EDITOR_SCENE_INVALID');

/**
 * @param {{id:unknown,uniqueId:unknown,data:unknown}} scene
 * @param {number|string} expectedUniqueId Server-provided persistent scene ID
 */
export function assertNovativaReadonlyEditorScene(scene,expectedUniqueId){
    const id=Number(scene?.id);
    const uniqueId=Number(scene?.uniqueId);
    if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(uniqueId)||uniqueId<1||
       !Number.isSafeInteger(Number(expectedUniqueId))||Number(expectedUniqueId)<1||
       id!==uniqueId||uniqueId!==Number(expectedUniqueId))throw error();
    const data=scene?.data;
    if(!record(data)||data.item_id!==uniqueId||!record(data.entities))throw error();
    const entities=data.entities;
    const keys=Object.keys(entities);
    if(keys.length<1||keys.length>513||!record(entities.scene_root))throw error();
    const root=entities.scene_root;
    if(root.resource_id!=='scene_root'||root.parent!==null||
       !Array.isArray(root.children)||root.children.length!==keys.length-1||
       new Set(root.children).size!==root.children.length)throw error();
    for(const key of keys){
        const entity=entities[key];
        if(!record(entity)||entity.resource_id!==key||
           entity.enabled!==false||!record(entity.components)||
           Object.keys(entity.components).length!==0||
           !triple(entity.position,-200,200)||!triple(entity.rotation,-180,180)||
           !triple(entity.scale,0.1,10)||typeof entity.name!=='string'||
           entity.name.length<1||entity.name.length>256)throw error();
        if(key==='scene_root')continue;
        if(!/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/.test(key)||key.length>160||
           entity.parent!=='scene_root'||!Array.isArray(entity.children)||
           entity.children.length!==0||!root.children.includes(key))throw error();
    }
    if(root.children.some(key=>!Object.hasOwn(entities,key)||key==='scene_root'))
        throw error();
    return data;
}
