import {fetchNovativaNativeHierarchy} from './native-hierarchy-client.mjs';
import {buildNovativaPlayCanvasReadOnlyScene} from './native-scene-snapshot.mjs';

/**
 * End-to-end read-only DEV data adapter for the original PlayCanvas Editor.
 *
 * Uses Genesis/Platform HttpOnly session through same-origin BFF and projects
 * authorized Gaming bindings to the exact upstream data.entities shape.
 * Does NOT emit scene:raw by itself: native realtime must authenticate first
 * and must enforce read-only semantics on the SERVER, not only the UI.
 */
export async function loadNovativaNativeSceneReadOnly(args) {
    const hierarchy=await fetchNovativaNativeHierarchy(args);
    return buildNovativaPlayCanvasReadOnlyScene(hierarchy);
}
