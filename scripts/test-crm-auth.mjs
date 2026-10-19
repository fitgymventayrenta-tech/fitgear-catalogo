// SOLO PostgreSQL local de pruebas, después de tests/seguridad.setup.sql.
// Reutiliza el flujo comercial con auth.uid/membresía, sin sustituir es_admin().
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
if(process.env.FITGEAR_TEST_DATABASE!=='1')throw new Error('Requiere FITGEAR_TEST_DATABASE=1 y una base local de pruebas.');
if(!['/tmp','127.0.0.1','localhost'].includes(process.env.PGHOST||'localhost'))throw new Error('Solo se permite PostgreSQL local.');
const admin='00000000-0000-4000-8000-000000000001',comun='00000000-0000-4000-8000-000000000002';
let sql=readFileSync(new URL('../tests/comercial.integration.sql',import.meta.url),'utf8');
sql=sql.replace('BEGIN;',`BEGIN;\nINSERT INTO auth.users VALUES('${admin}'),('${comun}');\nINSERT INTO public.administradores(user_id) VALUES('${admin}');`);
sql=sql.replaceAll("SET fitgear.test_admin='true';",`SET request.jwt.claim.sub='${admin}';`).replaceAll("SET fitgear.test_admin='false';",`SET request.jwt.claim.sub='${comun}';`);
execFileSync('psql',['-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','inherit','inherit']});
