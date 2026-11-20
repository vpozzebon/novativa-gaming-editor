import { config } from '@/editor/config';
import { isNovativaReadOnlyRealtime } from '@/novativa/native-read-only-runtime.mjs';

editor.once('load', () => {
    const pending = new Set(['entities:load', 'realtime:authenticated']);
    if (isNovativaReadOnlyRealtime(config.url.realtime.http, window.location.href)) {
        pending.add('settings:project:load');
    } else {
        pending.add('assets:load');
    }

    const mark = (name: string) => {
        pending.delete(name);
        if (pending.size) {
            return;
        }
        document.body.classList.add('editor-ready');
        editor.method('editor:ready', () => true);
    };

    for (const name of pending) {
        editor.once(name, () => mark(name));
    }
});
