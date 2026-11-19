import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {inspectNovativaNativeSchemaCatalog,requireNovativaNativeSchemaPreflight}
 from '../src/novativa/native-schema-admission.mjs';

const catalog=()=>({
 version:1,
 documents:{
  scene:{type:'object',properties:{
   entities:{type:'object',additionalProperties:{
    type:'object',properties:{components:{type:'object',properties:{
     model:{type:'object',properties:{asset:{type:'number',default:0}}},
    }},name:{type:'string'}},
   }},
   settings:{type:'object',properties:{
    physics:{type:'object',properties:{gravity:{type:'number',default:-9.8}}},
    render:{type:'object',properties:{exposure:{type:'number',default:1}}},
   }},
  }},
  asset:{type:'object',properties:{type:{type:'string'},data:{type:'object'}}},
  settings:{type:'object',properties:{width:{type:'number',default:1280,'x-scope':'project'}}},
 },
 assetData:{model:{type:'object',properties:{mapping:{type:'array',items:{type:'number'}}}}},
 assetMeta:{model:{type:'object',properties:{}}},
});
test('native schema inspection accepts a structurally complete upstream-shaped catalog',()=>{
 const inspected=inspectNovativaNativeSchemaCatalog(catalog());
 assert.deepEqual(inspected,{structurallyValid:true,missing:[]});
 const result=requireNovativaNativeSchemaPreflight({
  schema:'novativa.playcanvas.native-schema.v1',environment:'dev',
  editor_config_ready:false,read_only:true,project_id:'prj_gaming',
  catalog:catalog(),
 });
 assert.equal(result.editor_config_ready,false);
 assert.equal(result.catalog.version,1);
});
test('native schema rejects missing docs and fake scene/settings/component contracts',()=>{
 const x=catalog();delete x.documents.scene;
 assert.ok(inspectNovativaNativeSchemaCatalog(x).missing.includes('documents.scene'));
 const y=catalog();delete y.documents.scene.properties.entities;
 assert.ok(inspectNovativaNativeSchemaCatalog(y).missing.includes('scene-entity-map'));
 const z=catalog();delete z.documents.scene.properties.settings;
 assert.ok(inspectNovativaNativeSchemaCatalog(z).missing.includes('scene-settings'));
 const a=catalog();delete a.documents.scene.properties.entities.additionalProperties.properties.components;
 assert.ok(inspectNovativaNativeSchemaCatalog(a).missing.includes('scene-entity-components'));
 const b=catalog();b.assetData.model=undefined;
 assert.ok(inspectNovativaNativeSchemaCatalog(b).missing.includes('assetData.model'));
 const c=catalog();c.version=2;
 assert.ok(inspectNovativaNativeSchemaCatalog(c).missing.includes('catalog-version-1'));
});
test('schema preflight remains non-launchable and denies forged scope',()=>{
 for(const change of [
  x=>x.environment='prod',
  x=>x.editor_config_ready=true,
  x=>x.read_only=false,
  x=>x.project_id='prj_other/../admin',
  x=>x.schema='playcanvas.editor.config.v1',
 ]){
  const e={schema:'novativa.playcanvas.native-schema.v1',environment:'dev',
   editor_config_ready:false,read_only:true,project_id:'prj_gaming',
   catalog:catalog()};
  change(e);
  assert.throws(()=>requireNovativaNativeSchemaPreflight(e),
   /NOVATIVA_NATIVE_SCHEMA_SCOPE_INVALID/);
 }
 assert.throws(()=>requireNovativaNativeSchemaPreflight({
  schema:'novativa.playcanvas.native-schema.v1',environment:'dev',
  editor_config_ready:false,read_only:true,project_id:'prj_gaming',catalog:{version:1},
 }),/NOVATIVA_NATIVE_SCHEMA_INCOMPLETE/);
});

test('the pinned PlayCanvas scene catalog is complete for native schema admission',async()=>{
 const bytes=await readFile(new URL('../catalogs/playcanvas/schema-v1.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  '8041b5150aab252ecc94be5ca9c50c5c307caf679baece1a3200ba522a8a2ccb');
 const snapshot=JSON.parse(bytes);
 assert.deepEqual(inspectNovativaNativeSchemaCatalog(snapshot),{structurallyValid:true,missing:[]});
 assert.equal(Object.keys(snapshot.assetData).length,14);
 assert.equal(Object.keys(snapshot.documents.scene.properties.entities.additionalProperties.properties.components.properties).length,24);
});
