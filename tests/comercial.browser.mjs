// QA local con transporte simulado: intercepta Supabase y nunca envía datos a producción.
// FITGEAR_PLAYWRIGHT=/ruta/playwright-core/index.mjs node tests/comercial.browser.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.FITGEAR_PLAYWRIGHT||'playwright-core');
const base=process.env.FITGEAR_TEST_URL||'http://127.0.0.1:8000';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const contexto=await browser.newContext();const errores=[];const escrituras=[];
const imagen='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="80"%3E%3Crect width="120" height="80" fill="%23155e59"/%3E%3C/svg%3E';
const productos=[{id:1,nombre:'Máquina de prueba local',marca:'Marca local',modelo:'Linear Leg Press',area:'Piernas',categoria:'Piernas',descripcion:'Datos exclusivos de QA local',precio:1000,existencias:3,estado:'disponible',imagen_url:imagen,imagenes:[imagen,imagen.replace('155e59','218579')],publicado:true,oferta:true},{id:2,nombre:'Segunda máquina de prueba',marca:'Otra marca',categoria:'Espalda',precio:1200,existencias:2,estado:'reservada',imagenes:[],publicado:true}];
const clientes=[{id:1,nombre:'Cliente de prueba local',telefono:'55551234',whatsapp:'55551234',correo:'',empresa:'Gimnasio local',origen:'whatsapp',tipo:'gimnasio',asesor:'Asesor local',departamento:'Guatemala'}];
const solicitudes=[{id:1,cliente_id:1,nombre:clientes[0].nombre,telefono:clientes[0].telefono,correo:'',mensaje:'Consulta de QA local',estado:'pendiente',estado_comercial:'nueva',origen:'catalogo_web',operacion:'compra',tipo:'catalogo',creado_en:'2026-10-18T12:00:00Z',solicitud_productos:[{producto_id:1,nombre_producto:productos[0].nombre,cantidad:2,marca_producto:productos[0].marca,imagen_producto:imagen}]}];
const datos={productos,clientes,solicitudes,clientes_fuentes:[],
 seguimientos:[{id:1,cliente_id:1,solicitud_id:1,fecha:'2026-10-18T12:00:00Z',medio:'llamada',responsable:'Asesor local',resumen:'Solo QA local',proxima_accion:'Contactar',siguiente_contacto:'2026-10-20T12:00:00Z',completado:false}],
 cotizaciones:[{id:1,cliente_id:1,solicitud_id:1,creado_en:'2026-10-18T12:00:00Z',estado:'aceptada',items:[{producto_id:1,nombre:productos[0].nombre,cantidad:1,precio:1000}],total:1000}],
 ventas:[{id:1,cliente_id:1,solicitud_id:1,cotizacion_id:2,creado_en:'2026-10-18T12:00:00Z',estado_entrega:'pendiente',items:[{producto_id:1,nombre:productos[0].nombre,cantidad:1,precio:1000}],total:1000}],
 pagos:[{id:1,venta_id:1,fecha:'2026-10-18T12:00:00Z',monto:200,medio:'anticipo',referencia:'QA local'}]};
await contexto.route('https://*.supabase.co/**',async route=>{
 const req=route.request();const url=new URL(req.url());
 if(req.method()!=='GET')escrituras.push({ruta:url.pathname,datos:req.postDataJSON()});
 let respuesta;
 if(url.pathname==='/auth/v1/token')respuesta={access_token:'token-solo-qa-local',expires_in:3600};
 else if(url.pathname.endsWith('/es_admin'))respuesta=true;
 else if(url.pathname.endsWith('/registrar_solicitud_comercial'))respuesta=123;
 else if(url.pathname.startsWith('/rest/v1/rpc/'))respuesta=1;
 else {const nombre=url.pathname.split('/').pop();if(!(nombre in datos))throw Error('Ruta inesperada '+url.pathname);respuesta=req.method()==='GET'?datos[nombre]:[req.postDataJSON()];}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(respuesta)});
});
const pagina=await contexto.newPage();pagina.on('pageerror',e=>errores.push(e.message));
const sinDesborde=async()=>{assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Desborde horizontal');for(const d of await pagina.locator('dialog[open]').all())assert.equal(await d.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'Desborde en ventana emergente');};
const cambiarClientes=async(nombre)=>{if(await pagina.locator('#seccion-clientes-movil').isVisible())await pagina.locator('#seccion-clientes-movil').selectOption(nombre);else await pagina.locator(`[data-clientes=${nombre}]`).click();};
try {
 for(const width of [320,360,390,430,768,844,1024,1440]){
  await pagina.setViewportSize({width,height:width===844?390:900});await pagina.goto(base);await pagina.locator('.tarjeta-producto').first().waitFor();await sinDesborde();if(width===360)await pagina.screenshot({path:'/tmp/fitgear-publico-movil.png',fullPage:true});
  await pagina.locator('#abrir-filtros').click();await sinDesborde();await pagina.locator('#abrir-filtros').click();
  await pagina.locator('#buscar-producto').fill('prensa');assert.equal(await pagina.locator('.tarjeta-producto').count(),1);await pagina.locator('#buscar-producto').fill('');
  await pagina.getByRole('button',{name:/^Ver detalles y fotos de/}).first().click();await sinDesborde();assert.equal(await pagina.locator('.detalle-miniaturas button').count(),2);await pagina.getByRole('button',{name:'Foto 2',exact:true}).click();await pagina.getByRole('button',{name:'Ampliar fotografía',exact:true}).click();await pagina.locator('.foto-ampliada[open]').waitFor();await pagina.keyboard.press('Escape');await pagina.keyboard.press('Escape');
  await pagina.locator('#solicitud-personalizada').click();await pagina.locator('[name=cantidad_personalizada]').fill('0');await pagina.locator('#cerrar-formulario').click();
  await pagina.getByRole('button',{name:'Solicitar información',exact:true}).first().click();await pagina.locator('#solicitud-dialogo[open]').waitFor();
  assert.equal(await pagina.locator('.equipo-solicitud').count(),1);await pagina.locator('#form-solicitud [name=nombre]').fill('QA sin enviar');await pagina.locator('#form-solicitud [name=telefono]').fill('55551234');assert.equal(await pagina.locator('#form-solicitud').evaluate(f=>f.checkValidity()),true);await sinDesborde();await pagina.getByRole('button',{name:'Cerrar',exact:true}).click();
  await pagina.getByRole('button',{name:'Agregar a cotización',exact:true}).first().click();await pagina.getByRole('button',{name:'Agregar a cotización',exact:true}).first().click();
  await pagina.locator('#abrir-solicitud').click();assert.equal(await pagina.locator('.equipo-solicitud').count(),2);await pagina.locator('.equipo-solicitud input').first().fill('3');await pagina.locator('#cerrar-formulario').click();await pagina.reload();await pagina.locator('.tarjeta-producto').first().waitFor();await pagina.locator('#abrir-solicitud').click();assert.equal(await pagina.locator('.equipo-solicitud input').first().inputValue(),'3');
  await pagina.locator('#form-solicitud input[name=nombre]').fill('Cliente solo QA');await pagina.locator('#form-solicitud input[name=telefono]').fill('55551234');
  await pagina.getByRole('button',{name:'Enviar solicitud',exact:true}).click();await pagina.getByText('¡Solicitud recibida!',{exact:false}).waitFor();
  const envio=escrituras.filter(e=>e.ruta.endsWith('registrar_solicitud_comercial')).at(-1);assert.equal(envio.datos.p_datos.productos[0].cantidad,3);assert.equal(envio.datos.p_datos.correo,'');
  await pagina.locator('#cerrar-formulario').click();await pagina.locator('#solicitud-personalizada').click();
  await pagina.locator('[name=maquina_buscada]').fill('Equipo fuera de inventario');await pagina.locator('#form-solicitud [name=nombre]').fill('Cliente personalizado QA');await pagina.locator('#form-solicitud [name=telefono]').fill('55551234');
  await pagina.getByRole('button',{name:'Enviar solicitud',exact:true}).click();await pagina.getByText('¡Solicitud recibida!',{exact:false}).waitFor();
  assert.equal(escrituras.at(-1).datos.p_datos.tipo,'personalizada');await pagina.locator('#cerrar-formulario').click();
  await pagina.goto(base+'/admin/');await pagina.locator('#email').fill('qa-local@example.invalid');await pagina.locator('#password').fill('clave-ficticia-solo-interceptada');await pagina.getByRole('button',{name:'Iniciar sesión'}).click();
  await pagina.locator('#administracion:not([hidden])').waitFor();await pagina.locator('#total-solicitudes').getByText('1',{exact:true}).waitFor();await sinDesborde();
  assert.deepEqual(await pagina.locator('.admin-navegacion button').allTextContents(),['Dashboard','Catálogo','Clientes']);
  await pagina.locator('#nav-clientes').click();if(width===360)await pagina.screenshot({path:'/tmp/fitgear-clientes-movil.png',fullPage:true});await pagina.locator('.filtros-adicionales summary').click();await sinDesborde();await pagina.locator('.filtros-adicionales summary').click();await pagina.getByRole('button',{name:'Ver ficha',exact:true}).click();await pagina.locator('.comercial-modal[open]').waitFor();await sinDesborde();await pagina.locator('.comercial-modal').getByRole('button',{name:'Nueva solicitud',exact:true}).click();await sinDesborde();await pagina.keyboard.press('Escape');await pagina.locator('.comercial-modal').getByRole('button',{name:'Cerrar',exact:true}).click();
  await pagina.locator('#agregar-cliente').click();await pagina.locator('.comercial-modal[open]').waitFor();await sinDesborde();if(width===360)await pagina.screenshot({path:'/tmp/fitgear-formulario-movil.png'});await pagina.keyboard.press('Escape');
  await cambiarClientes('solicitudes');await pagina.locator('#lista-solicitudes summary').click();await pagina.getByRole('button',{name:'Registrar seguimiento',exact:true}).click();await pagina.locator('.comercial-modal[open]').waitFor();await sinDesborde();await pagina.keyboard.press('Escape');
  await pagina.getByRole('button',{name:'Crear cotización',exact:true}).click();await pagina.locator('.comercial-modal[open]').waitFor();await sinDesborde();await pagina.keyboard.press('Escape');
  await cambiarClientes('cotizaciones');await pagina.locator('#lista-cotizaciones summary').click();await pagina.getByRole('button',{name:'Convertir en pedido',exact:true}).click();await pagina.locator('.comercial-modal[open]').waitFor();await sinDesborde();await pagina.keyboard.press('Escape');
  await cambiarClientes('ventas');await pagina.locator('#lista-ventas summary').click();await pagina.getByRole('button',{name:'Registrar pago',exact:true}).click();await pagina.locator('.comercial-modal[open]').waitFor();await sinDesborde();await pagina.keyboard.press('Escape');
  await pagina.locator('#nav-catalogo').click();await pagina.locator('#nuevo-producto').click();await pagina.locator('#editor-producto[open]').waitFor();await sinDesborde();await pagina.keyboard.press('Escape');
  await pagina.getByRole('button',{name:'Editar',exact:true}).first().click();await pagina.locator('#editor-producto[open]').waitFor();assert.equal(await pagina.locator('#form-producto [name=categoria]').inputValue(),'Piernas');await pagina.keyboard.press('Escape');
  console.log(`OK navegador a ${width}px: catálogo, solicitudes simple/múltiple/personalizada, dashboard, clientes, ficha y modales.`);
 }
 assert.deepEqual(errores,[]);console.log('Sin errores JavaScript. Todas las llamadas a Supabase fueron interceptadas; ninguna escritura remota.');
} finally {await browser.close();}
