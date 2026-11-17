import {describe,it} from 'mocha';
import {strict as assert} from 'node:assert';
import {
    inspectNovativaNativeEditorBootstrap,
    requireNovativaNativeEditorBootstrap
} from '../src/novativa/native-editor-bootstrap.mjs';

const valid = () => ({
    ok:true, data:{
        schema:'novativa.gaming.editor.bootstrap.v1',
        project_id:'prj_authorized',
        environment:'dev',
        status:'backend_pending',
        can_open:false,
        entrypoint:null,
        permissions:{
            can_view:true, can_edit:false,
            role_can_manage:true,
            can_edit_local_transforms:true,
            can_remove_decorative_bindings:true
        },
        requirements:{
            canonical_context:true,
            backend_adapter:false,
            authorized_asset_delivery:true,
            scene_persistence:false,
            preview_runtime:false
        }
    }
});
describe('Novativa native PlayCanvas Editor backend admission',()=>{
    it('recognizes the CURRENT BFF bootstrap as pending, not a ready native Editor',()=>{
        const result=inspectNovativaNativeEditorBootstrap(valid(),'prj_authorized');
        assert.equal(result.canOpen,false);
        assert.equal(result.entrypoint,null);
        assert.deepEqual(result.missing,['backend_adapter','scene_persistence','preview_runtime']);
        assert.throws(()=>requireNovativaNativeEditorBootstrap(valid(),'prj_authorized'),
            error=>error.code==='NOVATIVA_NATIVE_BACKEND_PENDING');
    });
    it('rejects mismatched project and environment',()=>{
        assert.throws(()=>inspectNovativaNativeEditorBootstrap(valid(),'prj_other'),
            error=>error.code==='NOVATIVA_EDITOR_BOOTSTRAP_INVALID');
        const bad=valid();bad.data.environment='prod';
        assert.throws(()=>inspectNovativaNativeEditorBootstrap(bad,'prj_authorized'),
            error=>error.code==='NOVATIVA_EDITOR_BOOTSTRAP_INVALID');
    });
    it('does not interpret local transform write as native Editor permission',()=>{
        const pending=valid();
        pending.data.permissions.can_edit_local_transforms=true;
        assert.equal(inspectNovativaNativeEditorBootstrap(pending,'prj_authorized').canOpen,false);
    });
    it('requires explicit management authorization, not only read',()=>{
        const bad=valid();bad.data.permissions.role_can_manage=false;
        assert.throws(()=>inspectNovativaNativeEditorBootstrap(bad,'prj_authorized'),
            error=>error.code==='NOVATIVA_EDITOR_NOT_AUTHORIZED');
    });
    it('refuses external and scheme-relative editor entrypoints',()=>{
        for(const url of ['https://playcanvas.com/editor','//external.invalid/editor','\\\\external.invalid','/x\\nheader']){
            const bad=valid();bad.data.can_open=true;bad.data.permissions.can_edit=true;
            Object.keys(bad.data.requirements).forEach(key=>bad.data.requirements[key]=true);
            bad.data.entrypoint=url;
            assert.equal(inspectNovativaNativeEditorBootstrap(bad,'prj_authorized').canOpen,false);
        }
    });
    it('only admits explicit DEV capabilities and same-origin native launch',()=>{
        const ready=valid();
        ready.data.can_open=true;ready.data.permissions.can_edit=true;
        Object.keys(ready.data.requirements).forEach(key=>ready.data.requirements[key]=true);
        ready.data.entrypoint='/console/gaming/editor/native/prj_authorized';
        assert.deepEqual(requireNovativaNativeEditorBootstrap(ready,'prj_authorized'),{
            canOpen:true,reason:null,missing:[],projectId:'prj_authorized',
            entrypoint:'/console/gaming/editor/native/prj_authorized'
        });
    });
});
