// Fotografías extremas ficticias; sin conexiones ni escrituras en Supabase real.
import assert from 'node:assert/strict';
import {servirSitio} from './servidor-seguridad.mjs';
const {chromium}=await import(process.env.FITGEAR_PLAYWRIGHT||'playwright-core');
const browser=await chromium.launch({executablePath:process.env.FITGEAR_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const sitios=await Promise.all(['catalogo','admin'].map(servirSitio));
const ctx=await browser.newContext();
const foto=(w,h)=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#218579"/></svg>`).toString('base64');
const fotos=[foto(12000,300),foto(300,12000),foto(6000,6000)];
const productos=fotos.map((imagen_url,i)=>({id:i+1,nombre:'Máquina '+i,marca:'QA',descripcion:'Foto extrema',precio:100,existencias:1,estado:'disponible',publicado:true,imagen_url,imagenes:fotos}));
await ctx.route('https://*.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(productos)}));
const page=await ctx.newPage();const errores=[];page.on('pageerror',e=>errores.push(e.message));
async function comprobar(raiz,selector){
 await raiz.locator(selector).first().waitFor();
 await raiz.locator(selector).evaluateAll(async imgs=>{await Promise.all(imgs.map(img=>{img.loading="eager";return img.decode();}));});
 const fallos=await raiz.locator(selector).evaluateAll(imgs=>imgs.flatMap(img=>{
  const r=img.getBoundingClientRect(),p=img.parentElement.getBoundingClientRect(),c=getComputedStyle(img);
  return r.width>0&&r.height>0&&r.left>=p.left-1&&r.top>=p.top-1&&r.right<=p.right+1&&r.bottom<=p.bottom+1&&c.objectFit==='contain'?[]:[img.className||img.parentElement.className];
 }));assert.deepEqual(fallos,[],'Imágenes fuera del contenedor o sin contain');
}
try{
 for(const [width,height] of [[320,480],[390,850],[768,850],[1440,850],[844,390]]){
  await page.setViewportSize({width,height});await page.goto(sitios[0].url);await comprobar(page,'.imagen-interior img');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const alturas=await page.locator('.producto-imagen').evaluateAll(n=>n.map(e=>e.getBoundingClientRect().height));assert.ok(alturas.every(n=>n===alturas[0]));
  await page.locator('.producto-imagen').first().click();await comprobar(page,'.detalle-marco img');await comprobar(page,'.miniatura img');
  await page.getByRole('button',{name:'Foto 2',exact:true}).click();await comprobar(page,'.detalle-marco img');
  await page.getByRole('button',{name:'Ampliar fotografía',exact:true}).click();await comprobar(page,'.imagen-ampliada img');
  const visor=await page.locator('.foto-ampliada').boundingBox();assert.ok(visor.x>=0&&visor.y>=0&&visor.x+visor.width<=width+1&&visor.y+visor.height<=height+1);
  const cerrar=page.getByRole('button',{name:'Cerrar fotografía',exact:true});assert.ok(await cerrar.isVisible());await cerrar.click();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('button',{name:'Solicitar información',exact:true}).first().click();await comprobar(page,'.equipo-solicitud img');await page.keyboard.press('Escape');
  await page.goto(sitios[1].url);
  await page.evaluate(async productos=>{const {AdminView}=await import('/admin/js/AdminView.js?v=23');const v=new AdminView();v.configurarComercial();v.mostrarPanel(true);v.mostrarSeccion('catalogo');v.mostrarProductos(productos,p=>v.editar(p),()=>{});window.vistaQA=v;},productos);
  await comprobar(page,'.inventario-foto');await page.locator('#lista-admin').getByRole('button',{name:'Editar',exact:true}).first().click();await comprobar(page,'.galeria-admin img');
  assert.equal(await page.locator('#editor-producto').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await page.locator('#cerrar-editor').click();
  await page.evaluate(productos=>{const lista=document.querySelector('#lista-solicitudes');window.vistaQA.comercial={seguimientos:[],clientes:[],ventas:[]};window.vistaQA.renderSolicitudes(lista,[{id:1,nombre:'QA',estado:'pendiente',solicitud_productos:productos.map(p=>({producto_id:p.id,nombre_producto:p.nombre,imagen_producto:p.imagen_url,cantidad:1}))}]);window.vistaQA.mostrarSeccion('clientes');window.vistaQA.mostrarClientes('solicitudes');},productos);
  await page.locator('.solicitud>summary').first().click();await comprobar(page,'.solicitud-equipo img');
  await page.locator('#nav-catalogo').click();await page.locator('[data-vista-catalogo=previa]').click();const frame=page.frameLocator('#vista-cliente-catalogo');await comprobar(frame,'.imagen-interior img');
  await frame.getByRole('button',{name:'Ver fotos y detalles',exact:true}).first().click();await comprobar(frame,'.detalle-marco img');await frame.getByRole('button',{name:'Ampliar fotografía',exact:true}).click();await comprobar(frame,'.imagen-ampliada img');await frame.getByRole('button',{name:'Cerrar fotografía',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(`APROBADA ${width}×${height}: tarjetas, detalle, miniaturas, ampliación, solicitud, inventario, editor, clientes y vista previa.`);
 }
 assert.deepEqual(errores,[]);
}finally{await browser.close();for(const sitio of sitios)await sitio.cerrar();}
