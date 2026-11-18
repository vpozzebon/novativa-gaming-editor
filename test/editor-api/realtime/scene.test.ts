import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as share from 'sharedb/lib/client/index';

import { RealtimeScene } from '../../../src/editor-api/realtime/scene';

const LIMIT = 1048576;
const JSON0 = 'http://sharejs.org/types/JSONv0';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

// a loaded scene on a real sharedb connection whose server never answers unless told to
const setup = async (novativaReadOnly = false) => {
    const sent: string[] = [];
    const socket: any = { readyState: 1, send: (data: string) => sent.push(data), close: () => undefined };
    const sharedb = new share.Connection(socket);
    const feed = (msg: object) => socket.onmessage({ data: JSON.stringify(msg) });
    feed({ a: 'hs', id: 'client', protocol: 1, protocolMinor: 1, type: JSON0 });

    let onDisconnect: (reason: { code: number }) => void;
    const realtime: any = {
        on: (event: string, callback: typeof onDisconnect) => {
            if (event === 'disconnect') onDisconnect = callback;
            return { unbind: () => undefined };
        },
        emit: () => undefined
    };
    const connection: any = { novativaReadOnly, getDocument: () => sharedb.get('scenes', '1'), send: () => undefined };
    const scene = new RealtimeScene(1, realtime, connection);
    scene.load();
    await tick();
    feed({ a: 's', c: 'scenes', d: '1', data: { v: 1, type: JSON0, data: { entities: {} } } });
    await tick();

    // acknowledges each op as it is sent, in order, until nothing is pending
    const drain = async () => {
        let done = false;
        scene.whenNothingPending(() => {
            done = true;
        });
        const acked = new Set<number>();
        for (let i = 0; i < 500 && !done; i++) {
            await tick();
            const next = sent.map((s) => JSON.parse(s)).find((m) => m.a === 'op' && !acked.has(m.seq));
            if (next) {
                acked.add(next.seq);
                feed({ a: 'op', c: 'scenes', d: '1', v: next.v, src: 'client', seq: next.seq });
            }
        }
        expect(done).to.equal(true);
    };
    const ops = () => sent.filter((s) => s.startsWith('{"a":"op"'));
    const disconnect = (code: number) => {
        socket.onclose({ code });
        onDisconnect({ code });
    };
    const reconnect = async () => {
        sharedb.bindToSocket(socket);
        feed({ a: 'hs', id: 'client', protocol: 1, protocolMinor: 1, type: JSON0 });
        await tick();
        return JSON.parse(sent.at(-1));
    };
    return { scene, drain, ops, disconnect, reconnect, feed };
};

const entity = (i: number) => ({
    name: `Entity ${i}`,
    resource_id: `${i}`,
    parent: 'root',
    children: [],
    position: [i, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    components: { render: { type: 'box', castShadows: true, receiveShadows: true, layers: [0], materialAssets: [null] } }
});

describe('RealtimeScene', function () {
    this.timeout(10000);

    it('preserves the Novativa read-only document for replay and unloads on policy revocation', async () => {
        const { scene, ops, disconnect, reconnect, feed } = await setup(true);
        scene.submitOp({ p: ['entities', 'forbidden'], oi: entity(1) });
        await tick();
        expect(ops()).to.have.lengthOf(0);
        disconnect(1006);
        expect(scene.loaded).to.equal(true);
        expect(scene.data.entities).to.deep.equal({});
        expect(await reconnect()).to.deep.equal({ a: 's', c: 'scenes', d: '1', v: 1 });
        feed({ a: 'op', c: 'scenes', d: '1', v: 1, op: [{ p: ['entities', 'confirmed'], oi: entity(1) }] });
        feed({ a: 's', c: 'scenes', d: '1' });
        expect(scene.data.entities.confirmed.name).to.equal('Entity 1');
        disconnect(1008);
        expect(scene.loaded).to.equal(false);
    });

    it('keeps every message under the server limit when many edits compose', async () => {
        const { scene, drain, ops } = await setup();

        // one edit goes out first, so the rest compose behind it like a large paste
        scene.submitOp({ p: ['entities', 'first'], oi: entity(-1) });
        await tick();
        for (let i = 0; i < 3500; i++) {
            scene.submitOp({ p: ['entities', `${i}`], oi: entity(i) });
        }
        await drain();

        const sizes = ops().map((s) => new TextEncoder().encode(s).length);
        expect(sizes.length).to.be.greaterThan(2);
        expect(Math.max(...sizes)).to.be.at.most(LIMIT);
        expect(Object.keys(scene.data.entities)).to.have.lengthOf(3501);
    });

    it('still composes ordinary edits into one message', async () => {
        const { scene, drain, ops } = await setup();

        scene.submitOp({ p: ['entities', 'first'], oi: entity(-1) });
        await tick();
        for (let i = 0; i < 20; i++) {
            scene.submitOp({ p: ['entities', `${i}`], oi: entity(i) });
        }
        await drain();

        expect(ops()).to.have.lengthOf(2);
    });
});
