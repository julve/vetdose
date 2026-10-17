import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT || 4173);
const host=process.env.HOST || '127.0.0.1';
http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=resolve(root,`.${pathname.endsWith('/')?`${pathname}index.html`:pathname}`);
    if(!path.startsWith(root.endsWith(sep)?root:root+sep) || pathname.split('/').some(part=>part.startsWith('.') && part.length>0)) {res.writeHead(403);res.end('Prohibido');return;}
    const body=await readFile(path);
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'}[extname(path)] || 'application/octet-stream'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
  }catch {res.writeHead(404);res.end('No encontrado');}
}).listen(port,host,()=>console.log(`VetDose iniciado en ${host}, puerto ${port}.`));
