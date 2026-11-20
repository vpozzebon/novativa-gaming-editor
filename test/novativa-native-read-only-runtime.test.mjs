import test from 'node:test';
import assert from 'node:assert/strict';
import {isNovativaProjectSettingsDocument,projectNovativaReadOnlySettings}
    from '../src/novativa/native-project-settings.mjs';
import {inspectNovativaReadOnlyRuntime,isNovativaReadOnlyRealtime,loadNovativaReadOnlyRuntime}
    from '../src/novativa/native-read-only-runtime.mjs';

const scope={projectId:'prj_dev',gameId:'racing',sceneId:'vale-ambar',
    pageUrl:'https://dev.novativa.com.br/console/gaming/editor'};
const realtime='/api/projects/prj_dev/gaming/editor/native/realtime?gameId=racing&sceneId=vale-ambar&identity=persistent';
const asset='a'.repeat(64);
const fixture=()=>({
    schema:'novativa.playcanvas.native-runtime.v1',environment:'dev',
    project_id:'prj_dev',game_id:'racing',scene_id:'vale-ambar',can_open:false,
    capabilities:{sharedb_scene_read:true,sharedb_scene_write:false,realtime_authenticated:true},
    urls:{realtime},
    read_only_scene:{native_scene_id:1,assets:[{sha256:asset,
        url:'/api/projects/prj_dev/gaming/scenes/vale-ambar/editor/assets/'+asset+'.glb?gameId=racing'}]}
});

test('uses the native alias and the same-origin authenticated WebSocket',async()=>{
    const runtime=await loadNovativaReadOnlyRuntime(scope,async(endpoint,options)=>{
        assert.match(endpoint,/mode=read-only/);
        assert.equal(options.credentials,'same-origin');
        return new Response(JSON.stringify({ok:true,data:fixture()}));
    });
    assert.equal(runtime.sceneId,1);
    assert.equal(runtime.realtimeUrl,'wss://dev.novativa.com.br'+realtime);
    assert.equal(runtime.assets.length,1);
    assert.equal(isNovativaReadOnlyRealtime(runtime.realtimeUrl,scope.pageUrl),true);
    assert.equal(isNovativaReadOnlyRealtime('wss://other.example'+realtime,scope.pageUrl),false);
    assert.equal(isNovativaReadOnlyRealtime(realtime+'&gameId=other',scope.pageUrl),false);
});

test('fails closed for cross-project, write-enabled or external asset manifests',()=>{
    const wrongProject=fixture();
    wrongProject.project_id='prj_other';
    assert.throws(()=>inspectNovativaReadOnlyRuntime(wrongProject,scope));
    const writable=fixture();
    writable.capabilities.sharedb_scene_write=true;
    assert.throws(()=>inspectNovativaReadOnlyRuntime(writable,scope));
    const external=fixture();
    external.read_only_scene.assets[0].url='https://external.example/model.glb';
    assert.throws(()=>inspectNovativaReadOnlyRuntime(external,scope));
});

const branchId = 'racing-settings-smoke-20261119';
const documentId = `nps_${'a'.repeat(64)}.${branchId}`;
const defaults = { antiAlias: true, height: 720, useDevicePixelRatio: false, width: 1280 };

test('only admits a native Project settings document for the current branch', () => {
    assert.equal(isNovativaProjectSettingsDocument(documentId, branchId), true);
    assert.equal(isNovativaProjectSettingsDocument(documentId, 'other-branch'), false);
    assert.equal(isNovativaProjectSettingsDocument('project_7_12', branchId), false);
});

test('replaces overrides and restores attested defaults even after a missed revision', () => {
    assert.deepEqual(projectNovativaReadOnlySettings({ antiAlias: false, width: 1600 }, defaults), {
        ...defaults, antiAlias: false, width: 1600
    });
    assert.deepEqual(projectNovativaReadOnlySettings({ height: 1080, useDevicePixelRatio: true }, defaults), {
        ...defaults, height: 1080, useDevicePixelRatio: true
    });
    assert.equal(defaults.width, 1280);
});

test('rejects malformed snapshots without applying partial settings', () => {
    for (const snapshot of [null, [], {}, { width: 0 }, { width: 8193 }, { height: '720' },
        { antiAlias: 'false' }, { width: 1280, engineV2: true }, { ['__proto__']: true }]) {
        assert.throws(() => projectNovativaReadOnlySettings(snapshot, defaults), /NOVATIVA_PROJECT_SETTINGS_INVALID/);
    }
});
