// Todos los datos son ficticios. Ninguna llamada sale hacia Supabase.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.FITGEAR_PLAYWRIGHT||'playwright-core');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const ctx=await browser.newContext();const errors=[];const writes=[];
const cliente={id:1,nombre:'Contacto local sin teléfono',telefono:null,whatsapp:'',correo:'',empresa:'Proyecto local',ubicacion_original:'Zona de origen sin clasificar',departamento:'',municipio:'',tipo:'',origen:'whatsapp',asesor:'',observaciones:''};
const fuente={id:1,documento:'Ejemplo local.pdf',pagina:2,fila:3,estado:'importado',cliente_id:1,observaciones:'Sin teléfono en el documento',datos_originales:{nombre:cliente.nombre}};
const pendiente={id:2,documento:'Ejemplo local.pdf',pagina:4,fila:1,estado:'pendiente',cliente_id:null,observaciones:'Confirmar identidad',datos_originales:{nombre:'Contacto pendiente local',telefono:'55550000'}};
const datos={productos:[],clientes:[cliente],clientes_fuentes:[fuente,pendiente],solicitudes:[],seguimientos:[],cotizaciones:[],ventas:[],pagos:[]};
await ctx.route('https://*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url());let response;
 if(url.pathname==='/auth/v1/token')response={access_token:'qa-local',expires_in:3600};
 else if(url.pathname.endsWith('/es_admin'))response=true;
 else {const tabla=url.pathname.split('/').pop();assert.ok(tabla in datos,url.pathname);if(req.method()==='PATCH'){assert.equal(tabla,'clientes');const body=req.postDataJSON();writes.push(body);Object.assign(cliente,body,{telefono:body.telefono||null});response=[cliente];}else{assert.equal(req.method(),'GET');response=datos[tabla];}}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
});
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8000/admin/');await page.locator('#email').fill('local@example.invalid');await page.locator('#password').fill('solo-prueba');await page.getByRole('button',{name:'Iniciar sesión'}).click();await page.locator('#administracion:not([hidden])').waitFor();await page.locator('#nav-clientes').click();await page.locator('#lista-clientes strong').first().waitFor();
 for(const width of [360,768,1440]){
  await page.setViewportSize({width,height:900});await page.locator('#lista-clientes').getByText('Contacto pendiente local',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#buscar-cliente').fill('origen sin clasificar');assert.equal(await page.locator('#lista-clientes').getByRole('button',{name:'Ver ficha'}).count(),1);await page.locator('#buscar-cliente').fill('');
  await page.locator('#lista-clientes').getByRole('button',{name:'Ver ficha'}).click();await page.locator('.comercial-modal[open]').getByText(/Fuente: Ejemplo local.pdf, página 2, fila 3/).waitFor();
  await page.locator('.comercial-modal[open]').getByRole('button',{name:'Nueva solicitud',exact:true}).click();assert.match(await page.locator('#mensaje').innerText(),/teléfono real/);await page.keyboard.press('Escape');
  await page.locator('#lista-clientes').getByRole('button',{name:'Editar',exact:true}).click();const modal=page.locator('.comercial-modal[open]');
  assert.equal(await modal.locator('[name=telefono]').inputValue(),'');assert.equal(await modal.locator('[name=ubicacion_original]').inputValue(),cliente.ubicacion_original);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await modal.locator('[name=observaciones]').fill('Observación de prueba local');await modal.getByRole('button',{name:'Guardar',exact:true}).click();await modal.waitFor({state:'hidden'});
  assert.equal(writes.at(-1).telefono,'');assert.equal(writes.at(-1).ubicacion_original,cliente.ubicacion_original);
  console.log(`OK ${width}px: contacto sin teléfono editable, ubicación original, fuente y filas pendientes visibles.`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
