/**
 * Original PlayCanvas Editor sceneGet bridge for the authenticated Novativa
 * read-only ShareDB pilot. The only authority is the same-origin Genesis BFF.
 * This returns the upstream scene object with string IDs (EditorConfig.Scene).
 */
import {isNovativaReadOnlyRealtime} from './native-read-only-runtime.mjs';
import {fetchNativeSceneDescriptor} from './native-scene-descriptor-client.mjs';

const ID=/^\/api\/projects\/(prj_[A-Za-z0-9_-]+)\/gaming\/editor\/native\/realtime$/;

export async function fetchNovativaUpstreamScene({
 realtimeUrl,pageUrl,requestedSceneId,fetcher=fetch,
}={}){
 if(!isNovativaReadOnlyRealtime(realtimeUrl,pageUrl)||
    !Number.isSafeInteger(Number(requestedSceneId))||
    Number(requestedSceneId)<1||
    String(Number(requestedSceneId))!==String(requestedSceneId))
  throw new TypeError('NOVATIVA_NATIVE_SCENE_GET_SCOPE_INVALID');
 const address=new URL(realtimeUrl,pageUrl);
 const match=ID.exec(address.pathname);
 if(!match)throw new TypeError('NOVATIVA_NATIVE_SCENE_GET_SCOPE_INVALID');
 const descriptor=await fetchNativeSceneDescriptor({
  projectId:match[1],
  gameId:address.searchParams.get('gameId'),
  sceneId:address.searchParams.get('sceneId'),
  fetcher,
 });
 if(descriptor.id!==Number(requestedSceneId)||
    descriptor.uniqueId!==descriptor.id||descriptor.readOnly!==true)
  throw new TypeError('NOVATIVA_NATIVE_SCENE_GET_ID_MISMATCH');
 return Object.freeze({
  id:String(descriptor.id),
  uniqueId:String(descriptor.uniqueId),
  name:descriptor.name,
 });
}
