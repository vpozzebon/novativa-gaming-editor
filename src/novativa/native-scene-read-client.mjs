/**
 * Original PlayCanvas Editor, native scene read-only boundary.
 *
 * The Platform BFF owns the projection and authorization; the browser
 * only validates the resulting snapshot. No ShareDB/session/config is
 * synthesized, no browser-held Genesis bearer credential is required.
 */
const name=v=>typeof v==='string'&&v.length<=160&&
    /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/.test(v);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const triple=(values,min,max)=>Array.isArray(values)&&values.length===3&&
    values.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max);
const digest=/^[a-f0-9]{64}$/;

function assertNativeSceneSnapshot(data,{gameId,sceneId}) {
    if(!record(data)||data.schema!=='novativa.playcanvas.server-scene-snapshot.v1'||
       data.game_id!==gameId||data.scene_id!==sceneId||data.channel!=='dev'||
       data.coordinate_space!=='placement-anchor-local'||data.world_transforms_available!==false||
       data.read_only!==true||data.share_db_document_available!==false||
       !Number.isSafeInteger(data.binding_revision)||data.binding_revision<1||
       !Number.isSafeInteger(data.layout_revision)||data.layout_revision<0||
       !record(data.scene_data)||!record(data.scene_data.entities)||!record(data.bindings))
        throw new TypeError('NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID');
    const entities=data.scene_data.entities;
    const ids=Object.keys(entities);
    if(ids.length<1||ids.length>513||!record(entities.scene_root)||
       entities.scene_root.resource_id!=='scene_root'||
       entities.scene_root.parent!==null||entities.scene_root.enabled!==false)
        throw new TypeError('NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID');
    const children=entities.scene_root.children;
    if(!Array.isArray(children)||children.length!==ids.length-1||
       new Set(children).size!==children.length)
        throw new TypeError('NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID');
    for(const id of ids) {
        const e=entities[id];
        if(!record(e)||e.resource_id!==id||e.enabled!==false||
           !record(e.components)||Object.keys(e.components).length!==0||
           !triple(e.position,-200,200)||!triple(e.rotation,-180,180)||
           !triple(e.scale,0.1,10))throw new TypeError('NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID');
        if(id==='scene_root')continue;
        if(!name(id)||e.parent!=='scene_root'||!Array.isArray(e.children)||e.children.length!==0||
           !children.includes(id)||!record(data.bindings[id])||
           !digest.test(data.bindings[id].sha256))
            throw new TypeError('NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID');
    }
    if(Object.keys(data.bindings).length!==children.length)
        throw new TypeError('NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID');
    return data;
}

/**
 * Fetches the server-owned PlayCanvas entity snapshot.
 * This must be coupled to an authenticated, server-authorized ShareDB
 * transport BEFORE the full native Editor starts.
 */
export async function loadNovativaNativeSceneReadOnly({projectId,gameId,sceneId,fetcher=fetch,signal}={}) {
    if(typeof projectId!=='string'||!/^prj_[A-Za-z0-9_-]+$/.test(projectId)||
       !name(gameId)||!name(sceneId)||typeof fetcher!=='function')
        throw new TypeError('NOVATIVA_NATIVE_SCENE_REQUEST_INVALID');
    const endpoint='/api/projects/'+encodeURIComponent(projectId)+'/gaming/editor/native/scenes/'+
        encodeURIComponent(sceneId)+'/snapshot?gameId='+encodeURIComponent(gameId);
    const response=await fetcher(endpoint,{
        method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal,
        headers:{accept:'application/json'}
    });
    if(response?.ok!==true){
        const error=new Error('NOVATIVA_NATIVE_SCENE_UNAVAILABLE');
        error.status=Number(response?.status)||0;
        throw error;
    }
    const json=await response.json();
    if(json?.ok!==true)throw new TypeError('NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID');
    return assertNativeSceneSnapshot(json.data,{gameId,sceneId});
}
