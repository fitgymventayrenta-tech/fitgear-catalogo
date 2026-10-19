// Datos ficticios, transporte Supabase simulado. Sirve solo artefactos locales.
import assert from 'node:assert/strict';
import {servirSitio} from './servidor-seguridad.mjs';
const {chromium}=await import(process.env.FITGEAR_PLAYWRIGHT||'playwright-core');
const executablePath=process.env.FITGEAR_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({executablePath,headless:true});
const sitios=await Promise.all(['catalogo','admin'].map(servirSitio));
const ctx=await browser.newContext();let adminPermitido=true,expira=3600,esperarClientes=false,resolverClientes;
const escrituras=[];const xss='<img src=x onerror="globalThis.fitgearXss=1">';
const datos={productos:[{id:1,nombre:xss,marca:'Marca QA',publicado:true,precio:100,existencias:2,estado:'disponible',imagen_url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC0sAAAAASUVORK5CYII=',imagenes:[]}],clientes:[{id:1,nombre:'Contacto privado solo prueba',telefono:'55551234',empresa:'Empresa QA',ubicacion_original:'Ubicación QA'}],solicitudes:[],seguimientos:[],cotizaciones:[],ventas:[],pagos:[],clientes_fuentes:[]};
await ctx.route('https://*.supabase.co/**',async route=>{
 const req=route.request(),u=new URL(req.url());let r;
 if(req.method()!=='GET')escrituras.push(u.pathname);
 if(u.pathname==='/auth/v1/token')r={access_token:'token-local-'+Date.now(),expires_in:expira};
 else if(u.pathname.endsWith('/es_admin'))r=adminPermitido;
 else if(u.pathname.startsWith('/auth/v1/logout')){await route.fulfill({status:204});return;}
 else{const tabla=u.pathname.split('/').pop();assert.ok(tabla in datos,tabla);if(tabla==='clientes'&&esperarClientes){esperarClientes=false;await new Promise(resolve=>resolverClientes=resolve);}r=datos[tabla];}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r)});
});
const page=await ctx.newPage();const errores=[];page.on('pageerror',e=>errores.push(e.message));
const login=async()=>{await page.locator('#email').fill('local@example.invalid');await page.locator('#password').fill('ficticia');await page.getByRole('button',{name:'Iniciar sesión'}).click();};
try{
 const respuesta=await page.goto(sitios[0].url);const cabeceras=respuesta.headers();
 assert.match(cabeceras['content-security-policy'],/script-src 'self'/);assert.equal(cabeceras['x-content-type-options'],'nosniff');assert.equal(cabeceras['x-frame-options'],'SAMEORIGIN');assert.equal(cabeceras['access-control-allow-origin'],undefined);
 await page.locator('.tarjeta-producto').waitFor();assert.equal(await page.locator('.producto-nombre').textContent(),xss);assert.equal(await page.evaluate(()=>globalThis.fitgearXss),undefined);await page.locator('.producto-imagen img').waitFor();await page.waitForFunction(()=>document.querySelector('.producto-imagen img').naturalWidth>0);
 for(const ruta of ['/datos_privados/clientes_libro2.csv','/supabase/migracion_fitgear.sql','/.env','/.git/config','/admin/'])assert.equal((await ctx.request.get(sitios[0].url+ruta)).status(),404);
 console.log('APROBADA: cabeceras locales, sin CORS comodín, XSS mostrado como texto y archivos privados ausentes del catálogo.');
 await page.goto(sitios[1].url);await page.locator('#login').waitFor();assert.equal(await page.locator('#administracion').isVisible(),false);
 adminPermitido=false;await login();await page.locator('#mensaje').getByText(/permisos ADMIN/).waitFor();assert.equal(await page.locator('#administracion').isVisible(),false);
 adminPermitido=true;await login();await page.locator('#administracion:not([hidden])').waitFor();await page.locator('#nav-clientes').click();await page.getByText('Contacto privado solo prueba',{exact:true}).waitFor();
 await page.locator('#nav-catalogo').click();await page.locator('[data-vista-catalogo=previa]').click();const frame=page.frameLocator('#vista-cliente-catalogo');await frame.locator('.tarjeta-producto').waitFor();
 await frame.getByRole('button',{name:'Ver fotos y detalles',exact:true}).click();await frame.locator('dialog[open]').waitFor();await frame.getByRole('button',{name:'Cerrar',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage),sesion:Object.keys(sessionStorage)})),{local:[],sesion:[]});
 await page.locator('#cerrar-sesion').click();await page.locator('#login:not([hidden])').waitFor();assert.equal(await page.locator('#lista-clientes').textContent(),'');await page.waitForFunction(()=>!document.querySelector('#vista-cliente-catalogo').contentDocument?.querySelector('.tarjeta-producto'));
 assert.ok(escrituras.some(p=>p==='/auth/v1/logout'));
 console.log('APROBADA: artefacto ADMIN en /, acceso inicial privado, usuario común rechazado, galería bajo CSP, logout y limpieza de CRM/iframe/tokens en memoria.');
 expira=1;await login();await page.locator('#administracion:not([hidden])').waitFor();await page.locator('#login:not([hidden])').waitFor({timeout:5000});assert.equal(await page.locator('#lista-clientes').textContent(),'');
 console.log('APROBADA: expiración automática elimina la vista de datos privados.');
 expira=3600;await login();await page.locator('#administracion:not([hidden])').waitFor();await page.locator('#nav-clientes').click();await page.getByText('Contacto privado solo prueba',{exact:true}).waitFor();
 esperarClientes=true;await page.locator('#actualizar-solicitudes').click();await page.waitForFunction(()=>document.querySelector('#actualizar-solicitudes').disabled);await page.locator('#cerrar-sesion').click();resolverClientes();await page.locator('#login:not([hidden])').waitFor();await page.waitForFunction(()=>!document.querySelector('#actualizar-solicitudes').disabled);assert.equal(await page.locator('#lista-clientes').textContent(),'');
 console.log('APROBADA: una respuesta tardía no repuebla el CRM después de salir.');
 assert.deepEqual(errores,[]);
}finally{await browser.close();await Promise.all(sitios.map(s=>s.cerrar()));}
