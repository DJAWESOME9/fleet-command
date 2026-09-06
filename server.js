import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','css':'text/css','json':'application/json'})[file.split('.').pop()]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(3000,'127.0.0.1',()=>console.log('Fleet Command: http://localhost:3000'));
