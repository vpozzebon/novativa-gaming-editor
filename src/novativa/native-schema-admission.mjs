/**
 * Original PlayCanvas schema catalog admission. No schema is fabricated or
 * bundled as a substitute for a canonical server-backed settings authority.
 *
 * This guard validates the structural contract that src/editor-api/schema.ts
 * and its scene, asset, settings and components consumers actually read.
 * It is a necessary preflight, NOT a complete editor-launch approval.
 */
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const field=value=>object(value)&&(
    typeof value.type==='string'||object(value.properties)||
    object(value.additionalProperties)||Array.isArray(value.anyOf)
);
const properties=value=>object(value)&&object(value.properties);
const stableMissing=(keys)=>Object.freeze([...new Set(keys)]);

export function inspectNovativaNativeSchemaCatalog(value){
    const missing=[];
    if(!object(value)||value.version!==1){
        missing.push('catalog-version-1');
        return Object.freeze({structurallyValid:false,missing:stableMissing(missing)});
    }
    if(!object(value.documents)){
        missing.push('documents');
    }else{
        if(!properties(value.documents.scene))
            missing.push('documents.scene');
        else{
            const scene=value.documents.scene.properties;
            if(!object(scene.entities)||!field(scene.entities)||
               !object(scene.entities.additionalProperties))
                missing.push('scene-entity-map');
            if(!properties(scene.settings))
                missing.push('scene-settings');
        }
        if(!properties(value.documents.asset))
            missing.push('documents.asset');
        if(!properties(value.documents.settings))
            missing.push('documents.settings');
    }
    if(!object(value.assetData))missing.push('assetData');
    else for(const [name,asset] of Object.entries(value.assetData)){
        if(!/^[a-z][a-z0-9_]{0,63}$/.test(name)||!properties(asset))
            missing.push('assetData.'+name);
    }
    if(value.assetMeta!==undefined&&!object(value.assetMeta))
        missing.push('assetMeta');
    if(missing.length===0){
        const entities=value.documents.scene.properties.entities;
        const entity=entities.additionalProperties;
        const components=entity?.properties?.components;
        if(!object(entity)||!properties(entity)||!object(components)||
           !object(components.properties))
            missing.push('scene-entity-components');
    }
    return Object.freeze({
        structurallyValid:missing.length===0,
        missing:stableMissing(missing),
    });
}

/**
 * The native schema is only accepted for read-only diagnostics when the
 * server explicitly declares its scope and non-readiness of the full Editor.
 * Schema validity alone never makes a native EditorConfig launchable.
 */
export function requireNovativaNativeSchemaPreflight(envelope){
    if(!object(envelope)||
       envelope.schema!=='novativa.playcanvas.native-schema.v1'||
       envelope.environment!=='dev'||envelope.editor_config_ready!==false||
       envelope.read_only!==true||
       !/^prj_[A-Za-z0-9_-]+$/.test(envelope.project_id||''))
        throw new TypeError('NOVATIVA_NATIVE_SCHEMA_SCOPE_INVALID');
    const inspected=inspectNovativaNativeSchemaCatalog(envelope.catalog);
    if(!inspected.structurallyValid)
        throw Object.assign(new TypeError('NOVATIVA_NATIVE_SCHEMA_INCOMPLETE'),{
            missing:inspected.missing,
        });
    return Object.freeze({catalog:envelope.catalog,editor_config_ready:false});
}
