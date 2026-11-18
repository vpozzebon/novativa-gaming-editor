import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {loadNovativaNativeSceneReadOnly} from '../src/novativa/native-scene-read-client.mjs';
const scene={
    schema:'novativa.playcanvas.canonical-hierarchy.v1',
    game_id:'game_racing',scene_id:'vale-ambar',channel:'dev',
    binding_revision:27,layout_revision:13,
    coordinate_space:'placement-anchor-local',world_transforms_available:false,
    root:{entity_id:'scene_root',parent_id:null,name:'vale-ambar'},
    entities:[]
};
describe('end-to-end Novativa BFF to PlayCanvas entity snapshot adapter',()=>{
    it('converts a BFF response without exposing network credentials or attempting writes',async()=>{
        const requests=[];
        const result=await loadNovativaNativeSceneReadOnly({
            projectId:'prj_authorized',gameId:'game_racing',sceneId:'vale-ambar',
            fetcher:async(url,options)=>{
                requests.push({url,options});
                return{ok:true,status:200,json:async()=>({ok:true,data:scene})};
            }
        });
        assert.equal(result.schema,'novativa.playcanvas.read-only-scene-snapshot.v1');
        assert.equal(result.revisions.bindings,27);
        assert.equal(result.entities.scene_root.enabled,false);
        assert.deepEqual(result.entities.scene_root.children,[]);
        assert.equal(requests.length,1);
        assert.match(requests[0].url,/^\/api\/projects\/prj_authorized\/gaming\/editor\/native\/scenes\//);
        assert.equal(requests[0].options.method,'GET');
        assert.equal(requests[0].options.credentials,'same-origin');
        assert.equal(requests[0].options.cache,'no-store');
    });
    it('propagates authentication failures without creating a local fallback scene',async()=>{
        await assert.rejects(loadNovativaNativeSceneReadOnly({
            projectId:'prj_authorized',gameId:'game_racing',sceneId:'vale-ambar',
            fetcher:async()=>({ok:false,status:401})
        }),e=>e.status===401);
    });
});
