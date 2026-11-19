import { backend, UNSUPPORTED } from '@/common/backend';
import { isNovativaReadOnlyRealtime } from '@/novativa/native-read-only-runtime.mjs';
import { fetchNovativaUpstreamScene } from '@/novativa/native-scene-rest-adapter.mjs';

editor.once('load', () => {
    // Fetch list of scenes from the server and
    // pass them to the callback
    editor.method('scenes:list', (callback?: (result: unknown) => void, errorCallback?: (error: unknown) => void) => {
        editor.api.globals.rest.projects
            .projectScenes()
            .on('load', (_status: number, data: { result: unknown }) => callback?.(data.result))
            .on('error', (_status: number, error: unknown) => errorCallback?.(error));
    });

    // Get a specific scene from the server and pass result to callback
    editor.method('scenes:get', (sceneId: string, callback?: (err: unknown, data?: unknown) => void) => {
        // The original Editor's scene navigation must resolve the server-owned
        // native ID, not call the public PlayCanvas API for Novativa scenes.
        if (isNovativaReadOnlyRealtime(config.url.realtime.http, window.location.href)) {
            fetchNovativaUpstreamScene({
                realtimeUrl: config.url.realtime.http,
                pageUrl: window.location.href,
                requestedSceneId: sceneId
            }).then(scene => callback?.(null, scene)).catch(error => callback?.(error));
            return;
        }
        editor.api.globals.rest.scenes
            .sceneGet(Number(sceneId))
            .on('error', (_status: number, data: unknown) => {
                if (callback) {
                    callback(data);
                }
            })
            .on('load', (_status: number, data: unknown) => {
                if (callback) {
                    callback(null, data);
                }
            });
    });

    // Create a scene and pass result to callback
    editor.method(
        'scenes:new',
        (name: string, callback?: (data: unknown) => void, errorCallback?: (error: unknown) => void) => {
            const data: { projectId: number; branchId: string; name?: string } = {
                projectId: config.project.id,
                branchId: config.self.branch.id
            };

            if (name) {
                data.name = name;
            }

            const scenes = backend().sceneManagement;
            if (!scenes) {
                errorCallback?.(UNSUPPORTED);
                return;
            }

            scenes
                .sceneCreate(data)
                .on('load', (_status: number, data: unknown) => callback?.(data))
                .on('error', (_status: number, error: unknown) => errorCallback?.(error));
        }
    );

    // Duplicate scene and pass result to callback
    editor.method(
        'scenes:duplicate',
        (
            sceneId: string,
            newName: string,
            callback?: (data: unknown) => void,
            errorCallback?: (error: unknown) => void
        ) => {
            const scenes = backend().sceneManagement;
            if (!scenes) {
                errorCallback?.(UNSUPPORTED);
                return;
            }

            scenes
                .sceneCreate({
                    projectId: config.project.id,
                    duplicateFrom: parseInt(sceneId, 10),
                    branchId: config.self.branch.id,
                    name: newName
                })
                .on('load', (_status: number, data: unknown) => callback?.(data))
                .on('error', (_status: number, error: unknown) => errorCallback?.(error));
        }
    );

    // Delete a scene
    editor.method(
        'scenes:delete',
        (sceneId: string, callback?: () => void, errorCallback?: (error: unknown) => void) => {
            const scenes = backend().sceneManagement;
            if (!scenes) {
                errorCallback?.(UNSUPPORTED);
                return;
            }

            scenes
                .sceneDelete(Number(sceneId))
                .on('load', () => callback?.())
                .on('error', (_status: number, error: unknown) => errorCallback?.(error));
        }
    );
});
