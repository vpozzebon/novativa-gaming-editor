import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {fetchNovativaNativeHierarchy} from '../src/novativa/native-hierarchy-client.mjs';
const params={projectId:'prj_123',gameId:'game_racing',sceneId:'vale-ambar'};
const document={schema:'novativa.playcanvas.canonical-hierarchy.v1',
    game_id:'game_racing',scene_id:'vale-ambar',channel:'dev',
    coordinate_space:'placement-anchor-local',world_transforms_available:false,
    binding_revision:27,layout_revision:13,entities:[]};
describe('Novativa native Editor authenticated read client',()=>{
    it('uses only same-origin BFF with no user tokens or forged tenant context',async()=>{
        const calls=[];
        const fetcher=async(...args)=>{
            calls.push(args);
            return {ok:true,status:200,json:async()=>({ok:true,data:document})};
        };
        const result=await fetchNovativaNativeHierarchy({...params,fetcher});
        assert.equal(result.layout_revision,13);
        assert.equal(calls.length,1);
        assert.equal(calls[0][0],'/api/projects/prj_123/gaming/editor/native/scenes/vale-ambar/hierarchy?gameId=game_racing');
        assert.deepEqual(calls[0][1],{
            method:'GET',credentials:'same-origin',redirect:'error',
            cache:'no-store',signal:undefined,headers:{accept:'application/json'}
        });
        assert.equal(JSON.stringify(calls[0]).includes('Authorization'),false);
    });
    it('rejects foreign project, malformed identifiers and any unsupported response',async()=>{
        let called=false;
        const fetcher=async()=>{called=true;return{ok:true,json:async()=>({ok:true,data:document})};};
        for(const bad of [
            {...params,projectId:'../admin'},
            {...params,gameId:'../../x'},
            {...params,sceneId:'https://attacker.invalid'}
        ]){
            await assert.rejects(fetchNovativaNativeHierarchy({...bad,fetcher}),/REQUEST_INVALID/);
        }
        assert.equal(called,false);
        for(const bad of [
            {...document,channel:'prod'},
            {...document,game_id:'foreign'},
            {...document,world_transforms_available:true}
        ]){
            await assert.rejects(fetchNovativaNativeHierarchy({...params,fetcher:async()=>({
                ok:true,json:async()=>({ok:true,data:bad})
            })}),/RESPONSE_INVALID/);
        }
        await assert.rejects(fetchNovativaNativeHierarchy({...params,fetcher:async()=>({
            ok:false,status:403
        })}),error=>error.message==='NOVATIVA_NATIVE_HIERARCHY_UNAVAILABLE'&&error.status===403);
    });
});
