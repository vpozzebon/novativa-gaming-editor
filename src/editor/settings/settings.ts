import { Observer } from '@playcanvas/observer';

import { ObserverSync } from '@/common/observer-sync';
import { createLog } from '@/common/sentry';
import { formatter as f } from '@/common/utils';
import { config } from '@/editor/config';
import { isSchemaRejection, settingsRejection } from '@/editor/realtime/realtime-error';
import type { OpComponent } from '@/editor/realtime/realtime-error';
import { batchRejections } from '@/editor-api/realtime/rejections';
import { isNovativaProjectSettingsDocument, projectNovativaReadOnlySettings } from '@/novativa/native-project-settings.mjs';
import { isNovativaReadOnlyRealtime } from '@/novativa/native-read-only-runtime.mjs';

const log = createLog('<PATH>');

const ENVELOPE_KEYS = new Set(['_id', 'name', 'user', 'project', 'item_id', 'branch_id', 'checkpoint_id']);

type SettingsObserver = Observer & {
    id: string;
    reload: (...args: unknown[]) => void;
    disconnect: () => void;
    whenNothingPending: (callback: () => void) => void;
};

editor.once('load', () => {
    const novativaReadOnly = isNovativaReadOnlyRealtime(config.url.realtime.http, window.location.href);
    editor.method('settings:create', (args) => {
        // settings observer
        const settings = new Observer(args.data) as SettingsObserver;
        settings.id = args.id;

        // Get settings
        editor.method(`settings:${args.name}`, () => {
            return settings;
        });

        let doc;
        let localSettingsLoaded = false;

        // a schema rejection names the refused setting; anything else is unexpected, so report it
        const onRejected = batchRejections((err, ops: OpComponent[]) => {
            if (!isSchemaRejection(err)) {
                log.error(err);
                return;
            }
            const [msg] = f.parse(settingsRejection(err, ops, args.name));
            console.warn(`${msg} (${err instanceof Error ? err.message : err}):`, ops);
            editor.emit('realtime:settings:error', err, ops, args.name);
        });

        settings.reload = function () {
            if (novativaReadOnly && args.name !== 'project') {
                if (!localSettingsLoaded) {
                    localSettingsLoaded = true;
                    editor.emit(`settings:${args.name}:load`, settings.json());
                }
                return;
            }
            const connection = editor.call('realtime:connection');

            if (novativaReadOnly) {
                const reportError = (error: unknown) => {
                    log.error(error);
                    editor.emit('settings:project:error', error);
                };
                if (!isNovativaProjectSettingsDocument(settings.id, config.self.branch.id)) {
                    reportError(new Error('NOVATIVA_PROJECT_SETTINGS_DOCUMENT_INVALID'));
                    return;
                }
                if (doc) {
                    return;
                }
                doc = connection.get('settings', settings.id);
                const projectDoc = doc;
                let loaded = false;
                const applySnapshot = () => {
                    if (doc !== projectDoc) {
                        return;
                    }
                    try {
                        const data = projectNovativaReadOnlySettings(projectDoc.data, args.defaults);
                        const historyEnabled = settings.history.enabled;
                        settings.history.enabled = false;
                        try {
                            for (const [key, value] of Object.entries(data)) {
                                if (value === undefined) {
                                    settings.unset(key);
                                } else {
                                    settings.set(key, value);
                                }
                            }
                        } finally {
                            settings.history.enabled = historyEnabled;
                        }
                        if (!loaded) {
                            loaded = true;
                            editor.emit('settings:project:load', data);
                        }
                    } catch (error) {
                        reportError(error);
                    }
                };
                projectDoc.on('error', reportError);
                projectDoc.on('load', applySnapshot);
                projectDoc.on('op batch', applySnapshot);
                projectDoc.subscribe();
                return;
            }

            const initialize = () => {
                if (doc) {
                    doc.destroy();
                }

                doc = connection.get('settings', settings.id);

                // handle errors
                doc.on('error', (err) => {
                    log.error(err);
                    editor.emit(`settings:${args.name}:error`, err);
                });

                // load settings
                doc.on('load', () => {
                    const data = { ...doc.data };

                    // remove unnecessary fields
                    delete data._id;
                    delete data.name;
                    delete data.user;
                    delete data.project;
                    delete data.item_id;
                    delete data.branch_id;
                    delete data.checkpoint_id;

                    if (!settings.sync) {
                        settings.sync = new ObserverSync({
                            item: settings,
                            paths: Object.keys(settings.json())
                        });

                        // local -> server
                        settings.sync.on('op', (op) => {
                            if (doc) {
                                doc.submitOp([op], (err: unknown) => {
                                    if (err) {
                                        onRejected(err, [op]);
                                    }
                                });
                            }
                        });
                    }

                    const history = settings.history?.enabled;
                    if (history) {
                        settings.history.enabled = false;
                    }
                    settings.sync.enabled = false;

                    const set = (key, data) => {
                        if (Array.isArray(data)) {
                            settings.set(key, data.slice(0));
                        } else if (typeof data === 'object') {
                            for (const childKey in data) {
                                set(key ? `${key}.${childKey}` : childKey, data[childKey]);
                            }
                        } else {
                            settings.set(key, data);
                        }
                    };
                    set('', data);

                    settings.sync.enabled = true;
                    if (history) {
                        settings.history.enabled = true;
                    }

                    // server -> local
                    doc.on('op', (ops, local) => {
                        if (local) {
                            return;
                        }

                        const history = settings.history?.enabled;
                        if (history) {
                            settings.history.enabled = false;
                        }
                        for (let i = 0; i < ops.length; i++) {
                            const op = ops[i];
                            if (!ENVELOPE_KEYS.has(String(op.p[0]))) settings.sync.write(op);
                        }
                        if (history) {
                            settings.history.enabled = true;
                        }
                    });

                    editor.emit(`settings:${args.name}:load`, data);
                });

                // subscribe for realtime events
                doc.subscribe();
            };

            if (connection.state === 'connected') {
                initialize();
            } else {
                connection.on('connected', initialize);
            }
        };

        if (!args.deferLoad) {
            editor.on('realtime:authenticated', () => {
                settings.reload();
            });
        }

        editor.on('realtime:disconnected', () => {
            if (doc) {
                doc.destroy();
                doc = null;
            }
        });

        // calls back once the server has every local change
        settings.whenNothingPending = (callback) => {
            if (doc) {
                doc.whenNothingPending(callback);
            } else {
                callback();
            }
        };

        settings.disconnect = function () {
            if (doc) {
                doc.destroy();
                doc = null;
            }

            if (settings.sync) {
                settings.sync.unbind();
                delete settings.sync;
            }
        };

        return settings;
    });
});
