import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {isNovativaReadOnlyMessenger} from '../src/novativa/native-read-only-messenger.mjs';

const page='https://dev.novativa.com.br/console/gaming/editor/native';
const url='/api/projects/prj_123/gaming/editor/native/messenger?gameId=game_racing&sceneId=vale-ambar&identity=persistent';

test('Genesis native messenger recognizes only same-origin read-only scoped websocket',()=>{
 assert.equal(isNovativaReadOnlyMessenger(url,page),true);
 assert.equal(isNovativaReadOnlyMessenger(url.replace('game_racing','game_other'),page),true);
 for(const invalid of [
  'https://evil.example'+url,
  '//evil.example'+url,
  '/api/projects/prj_123/gaming/editor/native/messenger',
  url+'&tenant_id=evil',
  url.replace('identity=persistent','identity=temporary'),
  url.replace('sceneId=vale-ambar','sceneId=..%2Fadmin'),
  url.replace('messenger','realtime'),
  url.replace('prj_123','foreign'),
  url+'#fragment',
 ]){
  assert.equal(isNovativaReadOnlyMessenger(invalid,page),false,invalid);
 }
});
test('upstream messenger delegates native authentication without browser bearer tokens',()=>{
 const wrapper=readFileSync(fileURLToPath(new URL('../src/editor-api/messenger.ts',import.meta.url)),'utf8');
 const transport=readFileSync(fileURLToPath(new URL('../src/common/messenger.ts',import.meta.url)),'utf8');
 assert.match(wrapper,/isNovativaReadOnlyMessenger\(this\._url, window\.location\.href\)/);
 assert.match(wrapper,/this\._messenger\.authenticateNovativaCookie\(\)/);
 assert.match(wrapper,/this\._messenger\.authenticate\(api\.accessToken, 'designer'\)/);
 assert.match(transport,/authenticateNovativaCookie\(\)/);
 assert.match(transport,/this\.send\(\{name: 'authenticate', type: 'designer'\}\)/);
 assert.doesNotMatch(transport,/authenticateNovativaCookie\([^)]*accessToken/);
});
