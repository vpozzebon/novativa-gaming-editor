/**
 * Browser-side, same-origin BFF reader for the native Editor's read-only hierarchy.
 * Never receives Genesis bearer tokens, tenant/workspace hints, internal Gaming URLs,
 * public S3 endpoints or a writable PlayCanvas scene.
 */
const ID=/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
const id=v=>typeof v==='string'&&v.length<=160&&ID.test(v);
export async function fetchNovativaNativeHierarchy({projectId,gameId,sceneId,fetcher=fetch,signal}={}){
    if(typeof projectId!=='string'||!/^prj_[A-Za-z0-9_-]+$/.test(projectId)||
        !id(gameId)||!id(sceneId)||typeof fetcher!=='function'){
        throw new TypeError('NOVATIVA_NATIVE_HIERARCHY_REQUEST_INVALID');
    }
    const path='/api/projects/'+encodeURIComponent(projectId)+'/gaming/editor/native/scenes/'+
        encodeURIComponent(sceneId)+'/hierarchy?gameId='+encodeURIComponent(gameId);
    const response=await fetcher(path,{
        method:'GET',credentials:'same-origin',
        redirect:'error',cache:'no-store',signal,
        headers:{accept:'application/json'}
    });
    if(!response||response.ok!==true){
        const error=new Error('NOVATIVA_NATIVE_HIERARCHY_UNAVAILABLE');
        error.status=Number(response?.status)||0;
        throw error;
    }
    const result=await response.json();
    const data=result?.data;
    if(result?.ok!==true||data?.schema!=='novativa.playcanvas.canonical-hierarchy.v1'||
       data.game_id!==gameId||data.scene_id!==sceneId||data.channel!=='dev'||
       data.coordinate_space!=='placement-anchor-local'||
       data.world_transforms_available!==false||
       !Number.isSafeInteger(data.binding_revision)||data.binding_revision<1||
       !Number.isSafeInteger(data.layout_revision)||data.layout_revision<0||
       !Array.isArray(data.entities)||data.entities.length>512){
        throw new TypeError('NOVATIVA_NATIVE_HIERARCHY_RESPONSE_INVALID');
    }
    return data;
}
