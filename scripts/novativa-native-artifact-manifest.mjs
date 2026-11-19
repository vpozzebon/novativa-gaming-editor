// Creates a deterministic candidate inventory; does not deploy or grant runtime access.
import {createHash} from 'node:crypto';
import {readdir,readFile,lstat,writeFile} from 'node:fs/promises';
import {join,relative,sep} from 'node:path';

const root=new URL('../dist/',import.meta.url);
const output=new URL('../dist/novativa-native-manifest.json',import.meta.url);
const files=[];
async function collect(folder){
    for(const entry of await readdir(folder,{withFileTypes:true})){
        const target=join(folder,entry.name);
        const stat=await lstat(target);
        if(stat.isSymbolicLink())throw Error('Symlink forbidden in PlayCanvas artifact');
        if(stat.isDirectory()){await collect(target);continue;}
        if(!stat.isFile())throw Error('Unsupported artifact entry');
        const path=relative(root.pathname,target).split(sep).join('/');
        if(path==='novativa-native-manifest.json')continue;
        if(!path||path.startsWith('../')||path.includes('\\'))throw Error('Unsafe artifact filename');
        const data=await readFile(target);
        files.push({path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
    }
}
await collect(root.pathname);
files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
for(const name of ['js/editor.js','css/editor.css']){
    if(!files.some(item=>item.path===name&&item.bytes>0))throw Error('Missing core Editor artifact: '+name);
}
const commit=process.env.GITHUB_SHA||null;
if(commit&&!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid CI commit SHA');
const manifest={schema:'novativa.playcanvas.native-bundle.v1',source_commit:commit,
    read_only_candidate:true,deploy_enabled:false,files};
await writeFile(output,JSON.stringify(manifest,null,2)+'\n',{flag:'w'});
console.log('Native PlayCanvas candidate inventoried:',files.length,'files');
