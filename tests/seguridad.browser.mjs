// Datos ficticios, transporte Supabase simulado. Sirve solo artefactos locales.
import assert from 'node:assert/strict';
import {servirSitio} from './servidor-seguridad.mjs';
const {chromium}=await import(process.env.FITGEAR_PLAYWRIGHT||'playwright-core');
const executablePath=process.env.FITGEAR_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({executablePath,headless:true});
const sitios=await Promise.all(['catalogo','admin'].map(servirSitio));
const ctx=await browser.newContext();let adminPermitido=true,expira=3600,esperarClientes=false,resolverClientes;
const escrituras=[];const xss='<img src=x onerror="globalThis.fitgearXss=1">';
const datos={productos:[{id:1,nombre:xss,marca:'Marca QA',publicado:true,precio:100,existencias:2,estado:'disponible',imagen_url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC0sAAAAASUVORK5CYII=',imagenes:[]}],clientes:[{id:1,nombre:'Contacto privado solo prueba',telefono:'55551234',empresa:'Empresa QA',ubicacion_original:'Ubicación QA',observaciones:'Notas anteriores de QA'}],solicitudes:[],seguimientos:[],cotizaciones:[],ventas:[],pagos:[],clientes_fuentes:[]};
datos.solicitudes.push({id:1,cliente_id:1,nombre:datos.clientes[0].nombre,telefono:'55551234',correo:'',mensaje:'Consulta QA',estado:'pendiente',estado_comercial:'cotizada',tipo:'catalogo',operacion:'compra',origen:'catalogo_web',creado_en:'2026-10-19T12:00:00Z',solicitud_productos:[{producto_id:1,nombre_producto:'Máquina QA',cantidad:1}]});
datos.cotizaciones.push({id:1,cliente_id:1,solicitud_id:1,estado:'aceptada',creado_en:'2026-10-19T12:00:00Z',total:100,items:[{producto_id:1,nombre:'Máquina QA',cantidad:1,precio:100}]});
await ctx.route('https://*.supabase.co/**',async route=>{
 const req=route.request(),u=new URL(req.url());let r;
 if(req.method()!=='GET')escrituras.push(u.pathname);
 if(u.pathname==='/auth/v1/token')r={access_token:'token-local-'+Date.now(),expires_in:expira};
 else if(u.pathname.endsWith('/es_admin'))r=adminPermitido;
 else if(u.pathname.endsWith('/confirmar_venta')){
  const body=req.postDataJSON();assert.equal(body.p_cotizacion,1);assert.equal(datos.ventas.length,0);
  datos.ventas.push({id:1,cliente_id:1,solicitud_id:1,cotizacion_id:1,total:100,estado_entrega:'pendiente',creado_en:'2026-10-19T13:00:00Z',items:datos.cotizaciones[0].items});datos.cotizaciones[0].estado='convertida';datos.productos[0].existencias--;r=1;
 }
 else if(u.pathname.startsWith('/auth/v1/logout')){await route.fulfill({status:204});return;}
 else{const tabla=u.pathname.split('/').pop();assert.ok(tabla in datos,tabla);if(tabla==='clientes'&&esperarClientes){esperarClientes=false;await new Promise(resolve=>resolverClientes=resolve);}if(req.method()==='PATCH'){
   const body=req.postDataJSON();if(tabla==='clientes'){assert.deepEqual(Object.keys(body),['observaciones']);Object.assign(datos.clientes[0],body);r=[datos.clientes[0]];}
   else if(tabla==='solicitudes'){assert.deepEqual(Object.keys(body),['estado']);Object.assign(datos.solicitudes[0],body);r=[datos.solicitudes[0]];}else if(tabla==='productos'){Object.assign(datos.productos[0],body);r=[datos.productos[0]];}else throw Error('PATCH inesperado');
  }else r=datos[tabla];}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r)});
});
const page=await ctx.newPage();const errores=[];page.on('pageerror',e=>errores.push(e.message));
const login=async()=>{await page.locator('#email').fill('local@example.invalid');await page.locator('#password').fill('ficticia');await page.getByRole('button',{name:'Iniciar sesión'}).click();};
try{
 const respuesta=await page.goto(sitios[0].url);const cabeceras=respuesta.headers();
 assert.match(cabeceras['content-security-policy'],/script-src 'self'/);assert.equal(cabeceras['x-content-type-options'],'nosniff');assert.equal(cabeceras['x-frame-options'],'SAMEORIGIN');assert.equal(cabeceras['access-control-allow-origin'],undefined);
 await page.locator('.tarjeta-producto').waitFor();assert.equal(await page.locator('.producto-nombre').textContent(),xss);assert.equal(await page.evaluate(()=>globalThis.fitgearXss),undefined);await page.locator('.producto-imagen img').waitFor();await page.waitForFunction(()=>document.querySelector('.producto-imagen img').naturalWidth>0);
 const preciosVista=await page.evaluate(async()=>{
  const {CatalogoView}=await import('/js/CatalogoView.js?v=22');const vista=new CatalogoView();
  const base={precio:1000,precio_especial:900,precio_oferta:800};
  return [{...base},{...base,oferta:true},{...base,preventa:true},{...base,preventa:true,oferta:true}].map(p=>{const caja=vista.mostrarPrecios(p,'');return {texto:caja.textContent,tachados:caja.querySelectorAll('del').length};});
 });
 assert.equal(preciosVista[0].tachados,0);assert.equal(preciosVista[1].tachados,1);assert.equal(preciosVista[2].tachados,0);assert.equal(preciosVista[3].tachados,2);assert.match(preciosVista[3].texto,/Oferta en preventa · Precio vigente/);
 for(const ruta of ['/datos_privados/clientes_libro2.csv','/supabase/migracion_fitgear.sql','/.env','/.git/config','/admin/'])assert.equal((await ctx.request.get(sitios[0].url+ruta)).status(),404);
 console.log('APROBADA: cabeceras locales, sin CORS comodín, XSS mostrado como texto y archivos privados ausentes del catálogo.');
 await page.goto(sitios[1].url);await page.locator('#login').waitFor();assert.equal(await page.locator('#administracion').isVisible(),false);
 adminPermitido=false;await login();await page.locator('#mensaje').getByText(/permisos ADMIN/).waitFor();assert.equal(await page.locator('#administracion').isVisible(),false);
 adminPermitido=true;await login();await page.locator('#administracion:not([hidden])').waitFor();await page.locator('#nav-clientes').click();await page.getByText('Contacto privado solo prueba',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Oportunidades',exact:true}).count(),0);
 await page.locator('#lista-clientes').getByText('Pendiente',{exact:true}).waitFor();
 await page.locator('#lista-clientes').getByRole('button',{name:'Ver ficha',exact:true}).click();const ficha=page.locator('[data-ficha-cliente="1"]');
 await ficha.locator('.solicitud>summary').first().click();await ficha.locator('[name=estado_atencion]').selectOption('contactado');await ficha.getByRole('button',{name:'Guardar atención',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#lista-clientes').textContent.includes('Atendido'));assert.equal(datos.ventas.length,0);assert.equal(datos.solicitudes[0].estado_comercial,'cotizada');
 await ficha.locator('[data-seccion=notas]>summary').click();assert.equal(await ficha.locator('[name=notas_cliente]').inputValue(),'Notas anteriores de QA');
 await ficha.locator('[name=notas_cliente]').fill('Necesita entrega coordinada. Nota editada QA.');await ficha.getByRole('button',{name:'Guardar notas',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[name=notas_cliente]').defaultValue==='Necesita entrega coordinada. Nota editada QA.');
 await ficha.locator('[data-seccion=ventas]>summary').click();await ficha.getByRole('button',{name:'Registrar venta',exact:true}).click();
 const pedido=page.getByRole('dialog',{name:'Confirmar pedido de cotización #1',exact:true});await pedido.getByRole('button',{name:'Guardar',exact:true}).click();await pedido.waitFor({state:'detached'});
 await ficha.getByText(/Cliente recurrente/).waitFor();assert.equal(datos.solicitudes[0].estado,'contactado');assert.equal(datos.ventas.length,1);
 await ficha.getByRole('button',{name:'Cerrar',exact:true}).click();
 datos.solicitudes.push({...datos.solicitudes[0],id:2,estado:'pendiente',estado_comercial:'nueva'});await page.locator('#actualizar-solicitudes').click();await page.locator('#lista-clientes').getByText('Pendiente',{exact:true}).waitFor();await page.locator('#lista-clientes').getByText(/Cliente recurrente/).waitFor();
 await page.locator('#atencion-cliente').selectOption('contactado');assert.equal(await page.locator('#lista-clientes .tarjeta-cliente').count(),0);await page.locator('#atencion-cliente').selectOption('pendiente');assert.equal(await page.locator('#lista-clientes .tarjeta-cliente').count(),1);await page.locator('#atencion-cliente').selectOption('');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#lista-clientes').getByRole('button',{name:'Ver ficha',exact:true}).click();assert.equal(await ficha.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  await ficha.locator('[data-seccion=notas]>summary').click();assert.equal(await ficha.locator('[name=notas_cliente]').inputValue(),'Necesita entrega coordinada. Nota editada QA.');
  if(width===390)await page.screenshot({path:'/tmp/fitgear-cliente-sencillo.png'});
  await ficha.getByRole('button',{name:'Cerrar',exact:true}).click();
 }
 console.log('APROBADA: sin Oportunidades, atención independiente, notas editables, venta sin duplicación, recurrencia calculada y ficha responsive.');
 await page.locator('#nav-catalogo').click();await page.locator('#lista-admin').getByRole('button',{name:'Editar',exact:true}).click();
 const editor=page.locator('#editor-producto');await editor.locator('[name=preventa]').check();await editor.locator('[name=precio_especial]').fill('90');await editor.locator('[name=oferta]').check();await editor.locator('[name=precio_oferta]').fill('80');await page.locator('#guardar-producto').click();await editor.waitFor({state:'hidden'});
 assert.equal(datos.productos[0].precio,100);assert.equal(datos.productos[0].precio_especial,90);assert.equal(datos.productos[0].precio_oferta,80);assert.equal(datos.productos[0].preventa,true);assert.equal(datos.productos[0].oferta,true);
 await page.locator('#lista-admin').getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await editor.locator('[name=precio]').inputValue(),'100');assert.equal(await editor.locator('[name=precio_especial]').inputValue(),'90');assert.equal(await editor.locator('[name=precio_oferta]').inputValue(),'80');await page.locator('#cerrar-editor').click();
 await page.locator('[data-vista-catalogo=previa]').click();const frame=page.frameLocator('#vista-cliente-catalogo');await frame.locator('.tarjeta-producto').waitFor();await frame.getByText('PREVENTA',{exact:true}).waitFor();assert.equal(await frame.locator('.tarjeta-producto del').count(),2);
 await frame.getByRole('button',{name:'Ver fotos y detalles',exact:true}).click();await frame.locator('dialog[open]').waitFor();await frame.getByRole('button',{name:'Cerrar',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage),sesion:Object.keys(sessionStorage)})),{local:['fitgear.catalogo.actualizado'],sesion:[]});
 assert.match(await page.evaluate(()=>localStorage.getItem('fitgear.catalogo.actualizado')),/^\d+$/);
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
