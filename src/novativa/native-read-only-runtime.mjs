const name=/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
/** @param {unknown} value */
const validName=value=>typeof value==='string'&&value.length<=160&&name.test(value);

/**
 * The Novativa pilot uses the normal upstream ShareDB client with the existing
 * same-origin Genesis cookie. Match only the persistent scene socket.
 * @param {string} value
 * @param {string} pageUrl
 */
export function isNovativaReadOnlyRealtime(value,pageUrl){
    try{
        const page=new URL(pageUrl);
        const url=new URL(value,page);
        const protocol=page.protocol==='https:'?'wss:':'ws:';
        if(!['https:','http:'].includes(page.protocol)||
           ![page.protocol,protocol].includes(url.protocol)||url.host!==page.host||
           url.username||url.password||url.hash||
           !/^\/api\/projects\/prj_[A-Za-z0-9_-]+\/gaming\/editor\/native\/realtime$/.test(url.pathname))return false;
        const params=url.searchParams;
        return [...params.keys()].sort().join(',')==='gameId,identity,sceneId'&&
            params.get('identity')==='persistent'&&validName(params.get('gameId'))&&validName(params.get('sceneId'));
    }catch{return false;}
}

/**
 * Validates the partial, read-only scene transport manifest before binding it
 * to the native client. Full Editor startup keeps its own readiness contract.
 * @param {any} manifest
 * @param {{projectId:string,gameId:string,sceneId:string,pageUrl:string}} scope
 */
export function inspectNovativaReadOnlyRuntime(manifest,{projectId,gameId,sceneId,pageUrl}){
    const scene=manifest?.read_only_scene;
    const pathBase='/api/projects/'+projectId+'/gaming';
    const query='gameId='+encodeURIComponent(gameId);
    const realtime=pathBase+'/editor/native/realtime?'+query+'&sceneId='+encodeURIComponent(sceneId)+'&identity=persistent';
    const assets=pathBase+'/scenes/'+encodeURIComponent(sceneId)+'/editor/assets/';
    if(!/^prj_[A-Za-z0-9_-]+$/.test(projectId)||!validName(gameId)||!validName(sceneId)||
       manifest?.schema!=='novativa.playcanvas.native-runtime.v1'||manifest.environment!=='dev'||
       manifest.project_id!==projectId||manifest.game_id!==gameId||manifest.scene_id!==sceneId||
       manifest.capabilities?.sharedb_scene_read!==true||manifest.capabilities?.sharedb_scene_write!==false||
       manifest.capabilities?.realtime_authenticated!==true||manifest.urls?.realtime!==realtime||
       !isNovativaReadOnlyRealtime(realtime,pageUrl)||
       !Number.isSafeInteger(scene?.native_scene_id)||scene.native_scene_id<1||
       !Array.isArray(scene.assets)||scene.assets.length>512||scene.assets.some(asset=>
           !/^[a-f0-9]{64}$/.test(asset?.sha256??'')||asset.url!==assets+asset.sha256+'.glb?'+query))
        throw new Error('NOVATIVA_READ_ONLY_RUNTIME_INVALID');
    const endpoint=new URL(realtime,pageUrl);
    endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
    return Object.freeze({sceneId:scene.native_scene_id,realtimeUrl:endpoint.href,
        assets:Object.freeze(scene.assets.map(asset=>Object.freeze({sha256:asset.sha256,url:asset.url})))});
}

/**
 * @param {{projectId:string,gameId:string,sceneId:string,pageUrl:string}} scope
 * @param {typeof fetch} fetcher
 */
export async function loadNovativaReadOnlyRuntime(scope,fetcher=fetch){
    const {projectId,gameId,sceneId}=scope;
    if(!/^prj_[A-Za-z0-9_-]+$/.test(projectId)||!validName(gameId)||!validName(sceneId))
        throw new Error('NOVATIVA_READ_ONLY_RUNTIME_INVALID');
    const endpoint='/api/projects/'+projectId+'/gaming/editor/native/runtime?'+new URLSearchParams({
        gameId,sceneId,mode:'read-only'
    });
    const response=await fetcher(endpoint,{
        credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{accept:'application/json'}
    });
    if(!response.ok)throw new Error('NOVATIVA_READ_ONLY_RUNTIME_UNAVAILABLE');
    const body=await response.json();
    if(body?.ok!==true)throw new Error('NOVATIVA_READ_ONLY_RUNTIME_INVALID');
    return inspectNovativaReadOnlyRuntime(body.data,scope);
}
