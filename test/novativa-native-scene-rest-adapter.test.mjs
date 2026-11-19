import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {fetchNovativaUpstreamScene} from '../src/novativa/native-scene-rest-adapter.mjs';

const pageUrl='https://console.dev.example.test/console/gaming/editor/native';
const realtimeUrl='/api/projects/prj_123/gaming/editor/native/realtime?gameId=game_racing&sceneId=vale-ambar&identity=persistent';
const response=(data,ok=true,status=200)=>({ok,status,json:async()=>({ok:true,data})});
const descriptor=()=>({
 schema:'novativa.playcanvas.native-scene-descriptor.v1',
 game_id:'game_racing',scene_id:'vale-ambar',
 id:7,uniqueId:7,name:'vale-ambar',
 binding_revision:27,layout_revision:13,read_only:true,config_ready:false,
});
test('upstream sceneGet consumes only real authorized descriptor and returns string scene IDs',async()=>{
 const calls=[];
 const scene=await fetchNovativaUpstreamScene({
  realtimeUrl,pageUrl,requestedSceneId:'7',
  fetcher:async(...args)=>{calls.push(args);return response(descriptor());},
 });
 assert.deepEqual(scene,{id:'7',uniqueId:'7',name:'vale-ambar'});
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],'/api/projects/prj_123/gaming/editor/native/scenes/vale-ambar/descriptor?gameId=game_racing');
 assert.equal(calls[0][1].method,'GET');
 assert.equal(calls[0][1].credentials,'same-origin');
 assert.equal(calls[0][1].redirect,'error');
 assert.equal(calls[0][1].cache,'no-store');
});
test('upstream sceneGet rejects foreign numeric identities, origins and forged descriptor',async()=>{
 let called=0;
 const fetcher=async()=>{called++;return response(descriptor());};
 for(const requestedSceneId of ['8','0','7.0','abc']){
  await assert.rejects(()=>fetchNovativaUpstreamScene({
   realtimeUrl,pageUrl,requestedSceneId,fetcher,
  }));
 }
 assert.equal(called,1); // only the legitimate but mismatched ID reaches the BFF
 await assert.rejects(()=>fetchNovativaUpstreamScene({
  realtimeUrl:'https://evil.invalid/api/projects/prj_123/gaming/editor/native/realtime?gameId=game_racing&sceneId=vale-ambar&identity=persistent',
  pageUrl,requestedSceneId:'7',fetcher,
 }));
 assert.equal(called,1);
 await assert.rejects(()=>fetchNovativaUpstreamScene({
  realtimeUrl,pageUrl,requestedSceneId:'7',
  fetcher:async()=>response({...descriptor(),uniqueId:9}),
 }),/NOVATIVA_NATIVE_SCENE_DESCRIPTOR_INVALID/);
 await assert.rejects(()=>fetchNovativaUpstreamScene({
  realtimeUrl,pageUrl,requestedSceneId:'7',
  fetcher:async()=>response(descriptor(),false,403),
 }),/NOVATIVA_NATIVE_SCENE_DESCRIPTOR_UNAVAILABLE/);
});
test('original Editor only delegates sceneGet to BFF on authenticated native mode',()=>{
 const path=fileURLToPath(new URL('../src/editor/scenes/scenes.ts',import.meta.url));
 const src=readFileSync(path,'utf8');
 assert.match(src,/isNovativaReadOnlyRealtime\(config\.url\.realtime\.http, window\.location\.href\)/);
 assert.match(src,/fetchNovativaUpstreamScene\(/);
 assert.match(src,/requestedSceneId: sceneId/);
 assert.match(src,/\.then\(scene => callback\?\.\(null, scene\)\)/);
 assert.match(src,/editor\.api\.globals\.rest\.scenes/); // normal upstream remains unchanged
});
