import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {projectCanonicalSceneToEditorHierarchy as project} from '../src/novativa/canonical-scene-projection.mjs';
const base=()=>({
 schema:'gaming.editor.scene-document.v1',game_id:'game_racing',scene_id:'vale-ambar',
 channel:'dev',coordinate_space:'placement-anchor-local',world_transforms_available:false,
 binding_revision:27,layout_revision:13,
 root:{node_id:'scene_root',name:'vale-ambar',parent_id:null},
 nodes:[{
  node_id:'racing.vale-ambar.decor-08',binding_id:'racing.vale-ambar.decor-08',
  parent_id:'scene_root',anchor_ref:'racing:scene:reta-aurora:decor-08',
  definition_id:'advertising.novativa.trackside_billboard',
  definition_version:'1.0.2',artifact_digest:'5c86335c15746f09d597079e9cb1ac854f6851da779a59a59981ac9560502ead',
  editable:true,local_transform:{position:[-21,0,3.9],rotation:[0,-100.4,0],scale:[1,1,1]}
 }]
});
const run=doc=>project(doc,{gameId:'game_racing',sceneId:'vale-ambar'});
describe('canonical Gaming scene => read-only native hierarchy bridge',()=>{
 it('preserves native IDs, revisions, exact local offset and immutable asset digest',()=>{
  const out=run(base());
  assert.equal(out.bindingRevision,27);
  assert.equal(out.layoutRevision,13);
  assert.equal(out.children[0].anchorRef,'racing:scene:reta-aurora:decor-08');
  assert.deepEqual(out.children[0].localTransform.position,[-21,0,3.9]);
  assert.equal(out.children[0].asset.sha256,base().nodes[0].artifact_digest);
  assert.equal(out.worldTransformsAvailable,false);
  assert.equal(Object.isFrozen(out.children[0]),true);
 });
 it('preserves absent local transforms as null (never invented world positions)',()=>{
  const doc=base();doc.nodes[0].local_transform=null;
  assert.equal(run(doc).children[0].localTransform,null);
 });
 it('refuses Project/game cross-scope and non-DEV/World coordinate claims',()=>{
  for(const change of [
   d=>d.game_id='game_other',
   d=>d.scene_id='foreign',
   d=>d.channel='prod',
   d=>d.world_transforms_available=true,
   d=>d.coordinate_space='world',
   d=>d.binding_revision=-1
  ]){const doc=base();change(doc);assert.throws(()=>run(doc),/NOVATIVA_CANONICAL_SCENE_INVALID/);}
 });
 it('rejects duplicate canonical nodes, wrong root and invented GLB digests',()=>{
  for(const change of [
   d=>d.nodes.push({...d.nodes[0]}),
   d=>d.nodes[0].parent_id='another',
   d=>d.nodes[0].artifact_digest='f'.repeat(63),
   d=>d.nodes[0].local_transform.position[1]=Infinity,
   d=>d.nodes[0].local_transform.scale[0]=0
  ]){const doc=base();change(doc);assert.throws(()=>run(doc),/NOVATIVA_CANONICAL_SCENE_INVALID/);}
 });
});
