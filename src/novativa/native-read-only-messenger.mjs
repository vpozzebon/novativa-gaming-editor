/**
 * Strict same-origin native messenger recognition. This is NOT a readiness
 * claim for the full upstream event bus, and never supplies a browser token.
 */
const NAME=/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
const named=v=>typeof v==='string'&&v.length<=160&&NAME.test(v);
export function isNovativaReadOnlyMessenger(endpoint,pageUrl){
    try{
        const page=new URL(pageUrl);
        const uri=new URL(endpoint,page);
        if(!['https:','http:'].includes(page.protocol)||
           uri.host!==page.host||
           ![page.protocol,page.protocol==='https:'?'wss:':'ws:'].includes(uri.protocol)||
           uri.username||uri.password||uri.hash||
           !/^\/api\/projects\/prj_[A-Za-z0-9_-]+\/gaming\/editor\/native\/messenger$/.test(uri.pathname))
            return false;
        const params=uri.searchParams;
        return [...params.keys()].sort().join(',')==='gameId,identity,sceneId'&&
            params.get('identity')==='persistent'&&
            named(params.get('gameId'))&&named(params.get('sceneId'));
    }catch{return false;}
}
