import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {inspectNativePlayCanvasRuntime,requireNativePlayCanvasRuntime} from '../src/novativa/native-runtime-contract.mjs';
const fixture=()=>({
 schema:'novativa.playcanvas.native-runtime.v1',environment:'dev',
 project_id:'prj_d93c172b1f38458cff3982b9',user_id:'usr_101',scene_id:'vale-ambar',
 native_ids:{project:22,user:13,scene:17},
 capabilities:Object.fromEntries([
  'native_project_persistence','native_scene_persistence','sharedb_scene_read',
  'sharedb_scene_write','realtime_authenticated','messenger_authenticated',
  'approved_asset_delivery','editor_schema_available','runtime_preview_available',
  'authorized_editor_shell'].map(k=>[k,true])),
 urls:{
  api:'/api/projects/prj_d93c172b1f38458cff3982b9/gaming/editor/native/rest',
  realtime:'/api/projects/prj_d93c172b1f38458cff3982b9/gaming/editor/native/realtime',
  messenger:'/api/projects/prj_d93c172b1f38458cff3982b9/gaming/editor/native/messenger',
  assets:'/api/projects/prj_d93c172b1f38458cff3982b9/gaming/editor/native/assets'
 },
 scene_document_schema:'playcanvas.sharedb.scene.v1'
});
describe('Novativa native runtime admission for original PlayCanvas Editor',()=>{
 it('rejects the current canonical binding/layout-only model as a complete native Editor',()=>{
  const m=fixture();
  delete m.native_ids;
  m.capabilities.sharedb_scene_read=false;
  m.capabilities.sharedb_scene_write=false;
  m.capabilities.native_scene_persistence=false;
  m.scene_document_schema='gaming.editor.scene-document.v1';
  const state=inspectNativePlayCanvasRuntime(m);
  assert.equal(state.ready,false);
  assert.ok(state.missing.includes('canonical-native-id-aliases'));
  assert.ok(state.missing.includes('native-sharedb-scene-document'));
  assert.ok(state.missing.includes('native_scene_persistence'));
  assert.throws(()=>requireNativePlayCanvasRuntime(m),e=>
   e.code==='NOVATIVA_PLAYCANVAS_NATIVE_BACKEND_PENDING' &&
   e.missing.includes('sharedb_scene_write'));
 });
 it('never hashes arbitrary Genesis string IDs into numeric PlayCanvas IDs',()=>{
  const m=fixture();m.native_ids={project:'prj_real',user:'usr_real',scene:'scene_real'};
  assert.ok(inspectNativePlayCanvasRuntime(m).missing.includes('canonical-native-id-aliases'));
  m.native_ids={project:1.5,user:2,scene:3};
  assert.ok(inspectNativePlayCanvasRuntime(m).missing.includes('canonical-native-id-aliases'));
 });
 it('requires authenticated native REST/realtime/messenger/asset routes on same origin',()=>{
  for(const evil of [
   'https://playcanvas.com/api',
   '//evil.example/api',
   '/api/projects/prj_123/x\\y',
   '/api/projects/prj_123/x%2fadmin',
  ]){
   const m=fixture();m.urls.realtime=evil;
   assert.ok(inspectNativePlayCanvasRuntime(m).missing.includes('same-origin-realtime'));
  }
 });
 it('rejects PROD and wrong manifest version outright',()=>{
  const m=fixture();m.environment='prod';
  assert.throws(()=>inspectNativePlayCanvasRuntime(m),/MANIFEST_INVALID/);
  m.environment='dev';m.schema='gaming.editor.scene-document.v1';
  assert.throws(()=>inspectNativePlayCanvasRuntime(m),/MANIFEST_INVALID/);
 });
 it('admits only complete, server-asserted contract, never launches by itself',()=>{
  const m=fixture();const value=requireNativePlayCanvasRuntime(m);
  assert.equal(value.ready,true);
  assert.deepEqual(value.missing,[]);
  assert.equal(value.canonicalSceneId,'vale-ambar');
 });
});
