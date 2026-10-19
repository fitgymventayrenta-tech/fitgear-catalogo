import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const archivos=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const textoSensible=texto=>{
 if(/sb_secret_[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(texto))return true;
 for(const jwt of texto.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){try{if(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url')).role==='service_role')return true;}catch{}}
 return false;
};
let errores=0,revision=0;
for(const archivo of archivos){
 if(/(^|\/)(datos_privados|backups|respaldos|node_modules|dist)(\/|$)|(^|\/)\.env(?:\.|$)(?!example)|\.(pem|key|p12|pfx|dump|backup)$/.test(archivo)){console.error(`Archivo privado versionado: ${archivo}`);errores++;}
 if(!existsSync(archivo)||! /\.(js|mjs|html|css|json|sql|md|yml|yaml|txt)$/.test(archivo))continue;
 const texto=readFileSync(archivo,'utf8');revision++;
 if(textoSensible(texto)){console.error(`Posible secreto en ${archivo}; contenido omitido.`);errores++;}
 if(/\.(js|mjs)$/.test(archivo)){
  try{execFileSync(process.execPath,['--check',archivo],{stdio:'pipe'});}catch{console.error(`Sintaxis inválida: ${archivo}`);errores++;}
  if(/^(admin\/js|js)\//.test(archivo)&&/\.innerHTML\s*=|\.outerHTML\s*=|\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(texto)){console.error(`Sumidero de ejecución/HTML inseguro: ${archivo}`);errores++;}
 }
}
if(process.argv.includes('--history')){
 const revisiones=execFileSync('git',['rev-list','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 for(const commit of revisiones){
  const nombres=execFileSync('git',['ls-tree','-r','--name-only',commit],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  for(const archivo of nombres){if(!/\.(js|mjs|html|json|sql|md|yml|yaml|txt|env)$/.test(archivo))continue;
   const texto=execFileSync('git',['show',`${commit}:${archivo}`],{encoding:'utf8',maxBuffer:5*1024*1024});
   if(textoSensible(texto)){console.error(`Posible secreto histórico: ${commit.slice(0,8)}:${archivo}; contenido omitido.`);errores++;}
  }
 }
 console.log(`Historial revisado: ${revisiones.length} commits (patrones y JWT service_role; no prueba ausencia universal de secretos).`);
}
console.log(`Archivos de texto versionados revisados: ${revision}. Hallazgos bloqueantes: ${errores}.`);
process.exitCode=errores?1:0;
