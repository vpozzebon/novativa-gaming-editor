import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {buildNovativaPlayCanvasReadOnlyScene} from '../src/novativa/native-scene-snapshot.mjs';
import {assertNovativaReadonlyEditorScene as check} from '../src/novativa/native-editor-scene-guard.mjs';

const hierarchy=()=>({
    schema:'novativa.playcanvas.canonical-hierarchy.v1',
    game_id:'game_racing',scene_id:'vale-ambar',channel:'dev',
    binding_revision:27,layout_revision:13,
    coordinate_space:'placement-anchor-local',world_transforms_available:false,
    root:{entity_id:'scene_root',parent_id:null,name:'vale-ambar'},
    entities:Array.from({length:8},(_,i)=>({
        entity_id:'racing.vale-ambar.decor-'+String(i+1).padStart(2,'0'),
        binding_id:'racing.vale-ambar.decor-'+String(i+1).padStart(2,'0'),
        parent_id:'scene_root',anchor_ref:'racing:scene:reta-aurora:decor-'+String(i+1).padStart(2,'0'),
        editable:true,asset:{definition_id:'vegetation.novativa.tree',
            definition_version:'1.0.0',sha256:'a'.repeat(64)},
        local_transform:{position:[i,0,0],rotation:[0,0,0],scale:[1,1,1]}
    }))
});
function candidate(){
    const source=buildNovativaPlayCanvasReadOnlyScene(hierarchy());
    return {id:7,uniqueId:7,data:{item_id:7,entities:source.entities}};
}
describe('original PlayCanvas Editor read-only hierarchy hydration gate',()=>{
    it('accepts 9 canonical disabled entities on the server-owned persistent scene ID',()=>{
        const scene=candidate();
        assert.equal(Object.keys(check(scene,7).entities).length,9);
        assert.equal(check({...scene,uniqueId:'7'},'7'),scene.data);
    });
    it('refuses other scene IDs and malformed document shape',()=>{
        for(const mutate of [
            s=>{s.id=8;},s=>{s.uniqueId=8;},s=>{s.data.item_id=8;},
            s=>{s.data.entities.scene_root.children.pop();},
            s=>{s.data.entities.scene_root.children.push('foreign');},
            s=>{s.data.entities.scene_root.enabled=true;},
            s=>{s.data.entities.scene_root.components={script:{enabled:true}};},
            s=>{s.data.entities['racing.vale-ambar.decor-01'].parent='foreign';},
            s=>{s.data.entities['racing.vale-ambar.decor-02'].enabled=true;},
            s=>{s.data.entities['racing.vale-ambar.decor-03'].position=[Infinity,0,0];},
            s=>{s.data.entities['racing.vale-ambar.decor-04'].components={model:{}};},
            s=>{s.data.entities['racing.vale-ambar.decor-05'].resource_id='__proto__';}
        ]){
            const scene=candidate();mutate(scene);
            assert.throws(()=>check(scene,7),/NOVATIVA_NATIVE_EDITOR_SCENE_INVALID/);
        }
        assert.throws(()=>check(candidate(),8),/NOVATIVA_NATIVE_EDITOR_SCENE_INVALID/);
        assert.throws(()=>check(candidate(),null),/NOVATIVA_NATIVE_EDITOR_SCENE_INVALID/);
    });
    it('does not mutate or synthesize any entity, scene, token or EditorConfig',()=>{
        const s=candidate(),bytes=JSON.stringify(s);
        assert.equal(check(s,7),s.data);
        assert.equal(JSON.stringify(s),bytes);
        assert.equal(Object.hasOwn(s.data,'config'),false);
        assert.equal(Object.hasOwn(s.data,'accessToken'),false);
    });
});
