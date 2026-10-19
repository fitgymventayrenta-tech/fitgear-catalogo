// Transporte interceptado: no utiliza cuentas ni escrituras reales de Supabase.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.FITGEAR_PLAYWRIGHT||'playwright-core');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844}});const errores=[];const publicaciones=[];
const producto={id:99,nombre:'Máquina importada',marca:'Hammer Strength',categoria:'',descripcion:'',precio:null,existencias:0,estado:'vendida',publicado:false,oferta:false,imagenes:[]};
await ctx.route('https://*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url());let data;
 if(url.pathname==='/auth/v1/token')data={access_token:'token-local-interceptado',expires_in:3600};
 else if(url.pathname.endsWith('/es_admin'))data=true;
 else if(url.pathname==='/rest/v1/productos'){
  if(req.method()==='PATCH'){Object.assign(producto,req.postDataJSON());data=[{...producto}];}
  else {const publica=url.searchParams.get('publicado')==='eq.true';data=!publica||producto.publicado?[{...producto}]:[];if(publica)publicaciones.push({autorizacion:req.headers().authorization,datos:structuredClone(data)});}
 }else if(url.pathname.startsWith('/rest/v1/'))data=[];
 else throw Error('Ruta inesperada: '+url.pathname);
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
});
const catalogo=await ctx.newPage(),admin=await ctx.newPage();for(const p of [catalogo,admin])p.on('pageerror',e=>errores.push(e.message));
try{
 await catalogo.goto('http://127.0.0.1:8000');await catalogo.locator('#mensaje-vacio:not([hidden])').waitFor();
 await admin.goto('http://127.0.0.1:8000/admin/');await admin.locator('#email').fill('qa@example.invalid');await admin.locator('#password').fill('solo-prueba-interceptada');await admin.getByRole('button',{name:'Iniciar sesión'}).click();await admin.locator('#administracion:not([hidden])').waitFor();
 await admin.locator('#nav-catalogo').click();await admin.getByRole('button',{name:'Editar',exact:true}).click();
 await admin.locator('#form-producto [name=nombre]').fill('Prensa corregida');await admin.locator('#form-producto [name=descripcion]').fill('Descripción actualizada desde ADMIN');await admin.locator('#form-producto [name=existencias]').fill('2');
 assert.equal(await admin.locator('#form-producto [name=estado]').inputValue(),'disponible');assert.equal(await admin.locator('#form-producto [name=precio]').inputValue(),'');
 await admin.locator('#guardar-producto').click();await admin.locator('#mensaje').getByText('Máquina guardada y publicada.',{exact:false}).waitFor();assert.equal(producto.publicado,true);assert.equal(producto.precio,null);
 await catalogo.bringToFront();await catalogo.locator('.producto-nombre').getByText('Prensa corregida',{exact:true}).waitFor();assert.match(await catalogo.locator('.producto-precio').innerText(),/Precio a consultar/);assert.match(await catalogo.locator('.estado-equipo').innerText(),/Disponible/);
 await admin.bringToFront();await admin.getByRole('button',{name:'Editar',exact:true}).click();await admin.locator('#form-producto [name=precio]').fill('1300');await admin.locator('#form-producto [name=existencias]').fill('3');await admin.locator('#form-producto [name=oferta]').check();await admin.locator('#guardar-producto').click();await admin.locator('#editor-producto').waitFor({state:'hidden'});
 await catalogo.bringToFront();await catalogo.waitForFunction(()=>document.querySelector('.producto-precio')?.textContent.includes('1,300'));assert.equal(await catalogo.locator('.insignia-oferta').isVisible(),true);assert.match(await catalogo.locator('.producto-disponibilidad').innerText(),/3 unidades/);
 await admin.bringToFront();await admin.getByRole('button',{name:'Editar',exact:true}).click();await admin.locator('#guardar-borrador').click();await admin.locator('#editor-producto').waitFor({state:'hidden'});assert.equal(producto.publicado,false);
 await catalogo.bringToFront();await catalogo.locator('#mensaje-vacio:not([hidden])').waitFor();assert.equal(await catalogo.locator('.tarjeta-producto').count(),0);
 assert.ok(publicaciones.length>=3);assert.ok(publicaciones.every(p=>!p.autorizacion));assert.deepEqual(errores,[]);
 console.log('OK: editar importada, publicar sin precio, comprobar lectura anónima, cambiar precio/stock/oferta y volver a borrador. El catálogo se actualizó entre pestañas sin recargar manualmente.');
}finally{await browser.close();}
