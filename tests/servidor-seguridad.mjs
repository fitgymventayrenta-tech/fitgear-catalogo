// Servidor EXCLUSIVAMENTE local para probar los artefactos y cabeceras de vercel.json.
import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(await readFile(path.join(raiz,'vercel.json'),'utf8'));
export async function servirSitio(tipo){
 const carpeta=path.join(raiz,'dist',tipo);
 const servidor=http.createServer(async(req,res)=>{
  try{
   const nombre=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(nombre.includes('\0')||nombre.includes('\\')||nombre.split('/').includes('..')){res.writeHead(400);res.end();return;}
   let archivo=path.join(carpeta,nombre);
   if(!(archivo===carpeta||archivo.startsWith(carpeta+path.sep)))throw Error('Ruta inválida');
   if((await stat(archivo)).isDirectory())archivo=path.join(archivo,'index.html');
   const contenido=await readFile(archivo);
   for(const regla of config.headers){const coincide=regla.source==='/(.*)'||regla.source==='/'&&nombre==='/'||regla.source==='/(.*).html'&&nombre.endsWith('.html')||regla.source==='/admin/(.*)'&&nombre.startsWith('/admin/');if(coincide)for(const h of regla.headers)res.setHeader(h.key,h.value);}
   res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.txt':'text/plain; charset=utf-8'})[path.extname(archivo)]||'application/octet-stream');
   res.end(contenido);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('No encontrado');}
 });
 await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${servidor.address().port}`,cerrar:()=>new Promise(resolve=>servidor.close(resolve))};
}
