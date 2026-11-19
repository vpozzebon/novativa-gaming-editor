import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {inspectNativeSceneDescriptor,fetchNativeSceneDescriptor} from '../src/novativa/native-scene-descriptor-client.mjs';

const descriptor=()=>({
 schema:'novativa.playcanvas.native-scene-descriptor.v1',
 game_id:'game_racing',scene_id:'vale-ambar',id:7,uniqueId:7,
 name:'vale-ambar',read_only:true,config_ready:false,
 binding_revision:27,layout_revision:13,
});
const scope={projectId:'prj_authorized',gameId:'game_racing',sceneId:'vale-ambar'};
describe('native PlayCanvas scene descriptor BFF client',()=>{
 it('accepts only real server-owned numeric persistent identity',()=>{
  const result=inspectNativeSceneDescriptor(descriptor(),scope);
  assert.deepEqual(result,{id:7,uniqueId:7,name:'vale-ambar',
   revisions:{binding:27,layout:13},readOnly:true});
  assert.equal(Object.isFrozen(result),true);
 });
 it('rejects invented identity, foreign scene, writable and future-ready claims',()=>{
  for(const modify of [
   x=>{x.id=0;},x=>{x.id='7';},x=>{x.uniqueId=8;},
   x=>{x.scene_id='foreign';},x=>{x.game_id='foreign';},
   x=>{x.read_only=false;},x=>{x.config_ready=true;},
   x=>{x.binding_revision=-1;},x=>{x.accessToken='forged';},
   x=>{x.project_numeric_id=7;},x=>{x.user_numeric_id=7;},
  ]){
   const d=descriptor();modify(d);
   assert.throws(()=>inspectNativeSceneDescriptor(d,scope),
    /NOVATIVA_NATIVE_SCENE_DESCRIPTOR_INVALID/);
  }
 });
 it('fetches only the same-origin authenticated scoped descriptor, without token',async()=>{
  const calls=[];
  const result=await fetchNativeSceneDescriptor({...scope,fetcher:async(url,init)=>{
   calls.push({url,init});return{ok:true,json:async()=>({ok:true,data:descriptor()})};
  }});
  assert.equal(result.id,7);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,
   '/api/projects/prj_authorized/gaming/editor/native/scenes/vale-ambar/descriptor?gameId=game_racing');
  assert.equal(calls[0].init.credentials,'same-origin');
  assert.equal(calls[0].init.method,'GET');
  assert.equal(calls[0].init.cache,'no-store');
  assert.equal(calls[0].init.redirect,'error');
  assert.equal('authorization' in calls[0].init.headers,false);
 });
 it('fails closed on auth, invalid scope and bogus BFF payloads',async()=>{
  await assert.rejects(()=>fetchNativeSceneDescriptor({
   ...scope,fetcher:async()=>({ok:false,status:403}),
  }),/NOVATIVA_NATIVE_SCENE_DESCRIPTOR_UNAVAILABLE/);
  await assert.rejects(()=>fetchNativeSceneDescriptor({
   ...scope,fetcher:async()=>({ok:true,json:async()=>({ok:false})}),
  }),/NOVATIVA_NATIVE_SCENE_DESCRIPTOR_INVALID/);
  await assert.rejects(()=>fetchNativeSceneDescriptor({
   ...scope,projectId:'../../evil',fetcher:async()=>{throw Error('not invoked');},
  }),/NOVATIVA_NATIVE_SCENE_DESCRIPTOR_REQUEST_INVALID/);
 });
});
