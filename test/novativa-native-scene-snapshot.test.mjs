import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {buildNovativaPlayCanvasReadOnlyScene as project} from '../src/novativa/native-scene-snapshot.mjs';

const hierarchy=()=>({
    schema:'novativa.playcanvas.canonical-hierarchy.v1',
    game_id:'game_racing',scene_id:'vale-ambar',channel:'dev',
    binding_revision:27,layout_revision:13,
    coordinate_space:'placement-anchor-local',
    world_transforms_available:false,
    root:{entity_id:'scene_root',parent_id:null,name:'vale-ambar'},
    entities:[{
        entity_id:'racing.vale-ambar.decor-08',
        binding_id:'racing.vale-ambar.decor-08',
        parent_id:'scene_root',
        anchor_ref:'racing:scene:reta-aurora:decor-08',
        editable:true,
        asset:{
            definition_id:'advertising.novativa.trackside_billboard',
            definition_version:'1.0.2',
            sha256:'5c86335c15746f09d597079e9cb1ac854f6851da779a59a59981ac9560502ead'
        },
        local_transform:{position:[-21,0,3.9],rotation:[0,-100.4,0],scale:[1,1,1]}
    }]
});
describe('PlayCanvas native read-only scene snapshot from canonical Gaming',()=>{
    it('emits exactly the upstream entity fields and retains the canonical binding ids',()=>{
        const result=project(hierarchy());
        assert.equal(result.readOnly,true);
        assert.equal(result.spatiallyLocated,false);
        assert.equal(result.revisions.bindings,27);
        assert.equal(result.revisions.layout,13);
        const ids=Object.keys(result.entities).sort();
        assert.deepEqual(ids,['racing.vale-ambar.decor-08','scene_root']);
        const node=result.entities['racing.vale-ambar.decor-08'];
        assert.deepEqual(Object.keys(node).sort(),[
            'children','components','enabled','name','parent','position','resource_id',
            'rotation','scale','tags','template','template_ent_ids','template_id'
        ].sort());
        assert.equal(node.resource_id,'racing.vale-ambar.decor-08');
        assert.equal(node.parent,'scene_root');
        assert.equal(node.enabled,false);
        assert.deepEqual(node.position,[-21,0,3.9]);
        assert.deepEqual(node.rotation,[0,-100.4,0]);
        assert.deepEqual(result.entities.scene_root.children,['racing.vale-ambar.decor-08']);
        assert.equal(result.entities.scene_root.parent,null);
        assert.equal(result.entities.scene_root.enabled,false);
        assert.equal(result.bindings[node.resource_id].authoredLocalTransform,true);
        assert.equal(result.bindings[node.resource_id].assetDigest,
            '5c86335c15746f09d597079e9cb1ac854f6851da779a59a59981ac9560502ead');
        assert.equal(JSON.stringify(result).includes('accessToken'),false);
    });
    it('preserves un-authored transform status without inventing placement',()=>{
        const h=hierarchy();
        h.entities[0].local_transform=null;
        const result=project(h);
        assert.deepEqual(result.entities[h.entities[0].entity_id].position,[0,0,0]);
        assert.equal(result.bindings[h.entities[0].entity_id].authoredLocalTransform,false);
        assert.equal(result.spatiallyLocated,false);
    });
    it('rejects false world space, PROD, foreign ID and duplicate bindings',()=>{
        for (const change of [
            h=>{h.channel='prod';},
            h=>{h.world_transforms_available=true;},
            h=>{h.coordinate_space='world';},
            h=>{h.entities[0].parent_id='world';},
            h=>{h.entities[0].asset.sha256='f'.repeat(63);},
            h=>{h.entities[0].local_transform.scale=[0,1,1];},
            h=>{h.entities.push({...h.entities[0]});},
            h=>{h.entities[0].entity_id='__proto__';},
        ]){
            const h=hierarchy();change(h);
            assert.throws(()=>project(h),/NOVATIVA_NATIVE_SCENE_INVALID/);
        }
    });
    it('will not manufacture a writable ShareDB scene or live PlayCanvas components',()=>{
        const result=project(hierarchy());
        assert.equal(Object.hasOwn(result,'item_id'),false);
        assert.equal(Object.hasOwn(result,'sharedb'),false);
        assert.deepEqual(result.entities['racing.vale-ambar.decor-08'].components,{});
    });
});
