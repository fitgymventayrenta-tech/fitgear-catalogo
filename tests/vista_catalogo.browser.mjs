import assert from 'node:assert/strict';
const {chromium}=await import(process.env.FITGEAR_PLAYWRIGHT||'playwright-core');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const ctx=await browser.newContext();const errores=[],escrituras=[];
const foto='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="green"/%3E%3C/svg%3E';
const productos=[{id:1,nombre:'Prensa publicada de prueba',marca:'Marca local',publicado:true,existencias:2,estado:'disponible',precio:1000,dimensiones:'100 × 200 cm',imagenes:[foto,foto+'#segunda'],imagen_url:foto},{id:2,nombre:'Máquina oculta de prueba',marca:'Marca local',publicado:false,existencias:0,estado:'vendida',precio:null,descripcion:'Descripción privada para comprobar antes de publicar',imagenes:[]}];
await ctx.route('https://*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url());let datos=[];
 if(req.method()!=='GET')escrituras.push(url.pathname);
 if(url.pathname==='/auth/v1/token')datos={access_token:'solo-qa-local',expires_in:3600};
 else if(url.pathname.endsWith('/es_admin'))datos=true;
 else if(url.pathname==='/rest/v1/productos')datos=productos;
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(datos)});
});
const page=await ctx.newPage();page.on('pageerror',e=>errores.push(e.message));
try{
 await page.goto('http://127.0.0.1:8000/admin/');await page.locator('#email').fill('local@example.invalid');await page.locator('#password').fill('qa-local');await page.getByRole('button',{name:'Iniciar sesión'}).click();await page.locator('#administracion:not([hidden])').waitFor();await page.locator('#nav-catalogo').click();await page.locator('#lista-admin .fila-producto').first().waitFor();
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:850});
  await page.locator('[data-vista-catalogo=previa]').click();const frame=page.frameLocator('#vista-cliente-catalogo');await frame.getByText('Máquina oculta de prueba',{exact:true}).waitFor();assert.equal(await frame.locator('.tarjeta-producto').count(),2);assert.equal(await page.locator('#inventario-productos').isVisible(),false);
  await frame.getByRole('button',{name:'Ver fotos y detalles',exact:true}).first().click();await frame.locator('dialog[open]').waitFor();await frame.getByText('100 × 200 cm',{exact:true}).waitFor();assert.equal(await frame.locator('.miniatura').count(),2);await frame.getByRole('button',{name:'Foto 2',exact:true}).click();assert.equal(await frame.getByRole('button',{name:'Solicitar información',exact:true}).count(),0);
  assert.equal(await frame.locator('dialog[open]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await frame.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.locator('[data-vista-catalogo=publicadas]').click();await frame.locator('.tarjeta-producto').first().waitFor();await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelectorAll('.tarjeta-producto').length===1);assert.equal(await frame.getByText('Máquina oculta de prueba',{exact:true}).count(),0);
  await frame.locator('#buscar-previa').fill('ninguna');await frame.getByText('No hay máquinas con esta búsqueda.',{exact:true}).waitFor();await frame.locator('#buscar-previa').fill('');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-vista-catalogo=inventario]').click();assert.equal(await page.locator('#inventario-productos').isVisible(),true);
  console.log(`OK ${width}px: inventario separado, todas en vista previa, publicadas filtradas, fotos y detalles sin escrituras.`);
 }
 assert.deepEqual(errores,[]);assert.deepEqual(escrituras,['/auth/v1/token','/rest/v1/rpc/es_admin']);
}finally{await browser.close();}
