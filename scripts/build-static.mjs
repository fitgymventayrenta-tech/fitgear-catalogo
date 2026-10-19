// Genera únicamente los archivos necesarios para cada proyecto de Vercel.
import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const destino=process.argv[2];
if(!['catalogo','admin'].includes(destino))throw new Error('Usa: node scripts/build-static.mjs catalogo | admin');
const salida=path.join(raiz,'dist',destino);
await rm(salida,{recursive:true,force:true});await mkdir(salida,{recursive:true});
const copiar=async archivo=>{const objetivo=path.join(salida,archivo);await mkdir(path.dirname(objetivo),{recursive:true});await cp(path.join(raiz,archivo),objetivo,{recursive:true});};
await copiar('js');await copiar('css/style.css');await copiar('Logo Fit Gear.png');
if(destino==='catalogo')await copiar('index.html');
else{
 await copiar('admin');await copiar('css/admin.css');
 // Mantiene las rutas relativas originales tanto en / como en /admin/.
 const html=await readFile(path.join(raiz,'admin/index.html'),'utf8');
 await writeFile(path.join(salida,'index.html'),html.replace('<head>','<head><base href="/admin/">'));
}
console.log(`Listo: dist/${destino}`);
