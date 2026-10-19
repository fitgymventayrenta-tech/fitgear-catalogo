// Genera únicamente los archivos necesarios para cada proyecto de Vercel.
import {cp,mkdir,readFile,writeFile,rm,lstat,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const destino=process.argv[2];
if(!['catalogo','admin'].includes(destino))throw new Error('Usa: node scripts/build-static.mjs catalogo | admin');
const salida=path.join(raiz,'dist',destino);
await rm(salida,{recursive:true,force:true});await mkdir(salida,{recursive:true});
async function comprobarFuente(archivo){
 const estado=await lstat(archivo);if(estado.isSymbolicLink())throw new Error('No se permiten enlaces simbólicos en el despliegue.');
 if(estado.isDirectory()){for(const nombre of await readdir(archivo))await comprobarFuente(path.join(archivo,nombre));return;}
 if(!/\.(js|css|html|png)$/.test(archivo))throw new Error('Archivo inesperado dentro de los recursos públicos.');
 if(/(?:secret|credential|service.role|\.env)/i.test(path.basename(archivo)))throw new Error('Archivo sensible detectado en recursos públicos.');
 if(!archivo.endsWith('.png')){const texto=await readFile(archivo,'utf8');
 for(const jwt of texto.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){let datos;try{datos=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));}catch{continue;}if(datos.role==='service_role')throw new Error('Clave privilegiada detectada: despliegue detenido.');}
 if(/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}/.test(texto))throw new Error('Posible secreto detectado: despliegue detenido.');}
}
const copiar=async archivo=>{const objetivo=path.join(salida,archivo);await mkdir(path.dirname(objetivo),{recursive:true});await comprobarFuente(path.join(raiz,archivo));await cp(path.join(raiz,archivo),objetivo,{recursive:true});};
await copiar('js');await copiar('css/style.css');await copiar('Logo Fit Gear.png');
if(destino==='catalogo')await copiar('index.html');
else{
 await copiar('admin');await copiar('css/admin.css');await copiar('css/vista-catalogo.css');
 // Mantiene las rutas relativas originales tanto en / como en /admin/.
 const html=await readFile(path.join(raiz,'admin/index.html'),'utf8');
 await writeFile(path.join(salida,'index.html'),html.replace('<head>','<head><base href="/admin/">'));
}
await writeFile(path.join(salida,'robots.txt'),destino==='admin'?'User-agent: *\nDisallow: /\n':'User-agent: *\nAllow: /\n');
console.log(`Listo: dist/${destino}`);
