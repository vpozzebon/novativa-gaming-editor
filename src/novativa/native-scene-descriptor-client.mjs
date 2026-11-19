/**
 * Authenticated BFF scene descriptor reader for native Editor REST adoption.
 * It accepts ONLY the persistent numeric scene identity returned by Gaming,
 * never a browser-synthesized PlayCanvas Project or User ID.
 */
const name=value=>typeof value==='string'&&value.length<=160&&
 /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/.test(value);
export function inspectNativeSceneDescriptor(data,{gameId,sceneId}={}){
 if(data?.schema!=='novativa.playcanvas.native-scene-descriptor.v1'||
    !name(gameId)||!name(sceneId)||
    data.game_id!==gameId||data.scene_id!==sceneId||
    !Number.isSafeInteger(data.id)||data.id<1||
    !Number.isSafeInteger(data.uniqueId)||data.uniqueId!==data.id||
    typeof data.name!=='string'||!data.name||data.name.length>256||
    !Number.isSafeInteger(data.binding_revision)||data.binding_revision<1||
    !Number.isSafeInteger(data.layout_revision)||data.layout_revision<0||
    data.read_only!==true||data.config_ready!==false||
    Object.hasOwn(data,'accessToken')||Object.hasOwn(data,'project_numeric_id')||
    Object.hasOwn(data,'user_numeric_id'))
  throw new TypeError('NOVATIVA_NATIVE_SCENE_DESCRIPTOR_INVALID');
 return Object.freeze({
  id:data.id,uniqueId:data.uniqueId,name:data.name,
  revisions:Object.freeze({binding:data.binding_revision,layout:data.layout_revision}),
  readOnly:true,
 });
}
export async function fetchNativeSceneDescriptor({projectId,gameId,sceneId,fetcher=fetch,signal}={}){
 if(typeof projectId!=='string'||!/^prj_[A-Za-z0-9_-]+$/.test(projectId)||
    !name(gameId)||!name(sceneId)||typeof fetcher!=='function')
  throw new TypeError('NOVATIVA_NATIVE_SCENE_DESCRIPTOR_REQUEST_INVALID');
 const path='/api/projects/'+encodeURIComponent(projectId)+'/gaming/editor/native/scenes/'+
  encodeURIComponent(sceneId)+'/descriptor?gameId='+encodeURIComponent(gameId);
 const response=await fetcher(path,{
  method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
  headers:{accept:'application/json'},
 });
 if(response?.ok!==true){
  const error=new Error('NOVATIVA_NATIVE_SCENE_DESCRIPTOR_UNAVAILABLE');
  error.status=Number(response?.status)||0;
  throw error;
 }
 const json=await response.json();
 if(json?.ok!==true)throw new TypeError('NOVATIVA_NATIVE_SCENE_DESCRIPTOR_INVALID');
 return inspectNativeSceneDescriptor(json.data,{gameId,sceneId});
}
