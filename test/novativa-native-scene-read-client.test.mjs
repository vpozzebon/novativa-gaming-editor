import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {loadNovativaNativeSceneReadOnly} from '../src/novativa/native-scene-read-client.mjs';

const snapshot=()=>({
    schema:'novativa.playcanvas.server-scene-snapshot.v1',
    game_id:'game_racing',scene_id:'vale-ambar',channel:'dev',
    binding_revision:27,layout_revision:13,
    coordinate_space:'placement-anchor-local',world_transforms_available:false,
    read_only:true,share_db_document_available:false,
    scene_data:{entities:{
        scene_root:{
            resource_id:'scene_root',name:'vale-ambar',parent:null,children:['racing.vale-ambar.decor-08'],
            enabled:false,tags:[],position:[0,0,0],rotation:[0,0,0],
            scale:[1,1,1],components:{},template:null,template_id:null,template_ent_ids:null
        },
        'racing.vale-ambar.decor-08':{
            resource_id:'racing.vale-ambar.decor-08',name:'racing.vale-ambar.decor-08',
            parent:'scene_root',children:[],enabled:false,tags:[],
            position:[-21,0,3.9],rotation:[0,-100.4,0],scale:[1,1,1],
            components:{},template:null,template_id:null,template_ent_ids:null
        }
    }},
    bindings:{'racing.vale-ambar.decor-08':{
        anchor_ref:'racing:scene:reta-aurora:decor-08',
        definition_id:'advertising.novativa.trackside_billboard',
        definition_version:'1.0.2',
        sha256:'5c86335c15746f09d597079e9cb1ac854f6851da779a59a59981ac9560502ead',
        authored_local_transform:true,canonical_editable:true
    }}
});
const args={
    projectId:'prj_authorized',gameId:'game_racing',sceneId:'vale-ambar'
};
describe('Native Editor reads only authoritative, server-owned PlayCanvas scene snapshot',()=>{
    it('uses same-origin BFF and preserves actual native shape without browser projection',async()=>{
        const calls=[];
        const result=await loadNovativaNativeSceneReadOnly({...args,fetcher:async(url,options)=>{
            calls.push({url,options});
            return {ok:true,status:200,json:async()=>({ok:true,data:snapshot()})};
        }});
        assert.equal(result.schema,'novativa.playcanvas.server-scene-snapshot.v1');
        assert.equal(result.read_only,true);
        assert.equal(result.share_db_document_available,false);
        assert.equal(result.scene_data.entities.scene_root.enabled,false);
        assert.equal(result.scene_data.entities['racing.vale-ambar.decor-08'].position[0],-21);
        assert.equal(calls.length,1);
        assert.equal(calls[0].url,'/api/projects/prj_authorized/gaming/editor/native/scenes/vale-ambar/snapshot?gameId=game_racing');
        assert.equal(calls[0].options.credentials,'same-origin');
        assert.equal(calls[0].options.method,'GET');
        assert.equal(calls[0].options.cache,'no-store');
    });
    it('fails closed without auth and does not fabricate a local scene',async()=>{
        await assert.rejects(loadNovativaNativeSceneReadOnly({...args,
            fetcher:async()=>({ok:false,status:401})}),e=>e.status===401);
    });
    it('rejects PROD, ShareDB readiness forgery, invalid data and phantom world-space placement',async()=>{
        for(const change of [
            x=>{x.channel='prod';},
            x=>{x.share_db_document_available=true;},
            x=>{x.world_transforms_available=true;},
            x=>{x.scene_data.entities['racing.vale-ambar.decor-08'].enabled=true;},
            x=>{x.scene_data.entities.scene_root.children=[];},
            x=>{x.bindings['racing.vale-ambar.decor-08'].sha256='a'.repeat(63);},
            x=>{x.scene_data.entities['racing.vale-ambar.decor-08'].scale=[0,1,1];},
            x=>{x.scene_data.entities['racing.vale-ambar.decor-08'].components.script={enabled:true};}
        ]){
            const data=snapshot();change(data);
            await assert.rejects(loadNovativaNativeSceneReadOnly({...args,
                fetcher:async()=>({ok:true,json:async()=>({ok:true,data})})
            }),/NOVATIVA_NATIVE_SCENE_SNAPSHOT_INVALID/);
        }
    });
});
