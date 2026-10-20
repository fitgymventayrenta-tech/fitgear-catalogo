import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function importar(ruta) {
  let codigo = await readFile(new URL('../' + ruta, import.meta.url), 'utf8');
  codigo = codigo.replace(/import \{ supabaseConfig \} from [^;]+;/, 'const supabaseConfig={url:"https://test.supabase.co",key:"sb_publishable_test"};');
  const helper=Buffer.from(await readFile(new URL('../js/comercial.js',import.meta.url),'utf8')).toString('base64');
  codigo=codigo.replace(/from "[^"]*comercial\.js(?:\?[^"]*)?"/,`from "data:text/javascript;base64,${helper}"`);
  return import('data:text/javascript;base64,' + Buffer.from(codigo).toString('base64'));
}
const { AdminModel } = await importar('admin/js/AdminModel.js');
const { ProductoModel } = await importar('js/ProductoModel.js');
const { AdminController } = await importar('admin/js/AdminController.js');
const producto = () => ({nombre:'Prensa',marca:'FitGear',descripcion:'Equipo profesional',precio:1500,existencias:2,estado:'disponible',oferta:false});
const modeloAdmin = () => { const m=new AdminModel();m.token='token';m.expira=Date.now()+60000;return m; };

test('inventario: cero unidades fuerza vendida; vender una conserva unidades disponibles', () => {
  const m=modeloAdmin();const p=producto();p.existencias=0;m.validarProducto(p);assert.equal(p.estado,'vendida');
  const parcial=producto();parcial.existencias=1;m.validarProducto(parcial);assert.equal(parcial.estado,'disponible');
  assert.throws(()=>m.validarProducto({...producto(),estado:'vendida'}),/quedan|establece/);
  m.validarProducto({...producto(),estado:'reservada'});
});

test('valida campos sin aceptar precios inválidos ni existencias fraccionarias', () => {
  const m=modeloAdmin();
  for(const cambio of [{precio:NaN},{precio:-1},{existencias:1.5},{existencias:-1},{marca:''},{nombre:' '},{estado:'otro'}])assert.throws(()=>m.validarProducto({...producto(),...cambio}));
});

test('rechaza código disfrazado de imagen y archivos fuera de tamaño/tipo', async () => {
  const m=modeloAdmin();
  assert.throws(()=>m.validarImagen(new Blob(['<svg/>'],{type:'image/svg+xml'})));
  assert.throws(()=>m.validarImagen({type:'image/png',size:5242881}));
  await assert.rejects(()=>m.validarContenidoImagen(new Blob(['<script>alert(1)</script>'],{type:'image/png'})),/contenido/);
  await m.validarContenidoImagen(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}));
});

test('sin sesión no hay escritura de productos ni subida', async () => {
  const m=new AdminModel();await assert.rejects(()=>m.guardarProducto(producto()),/sesión/);
  await assert.rejects(()=>m.subirImagen(new Blob()),/sesión/);
});

test('PATCH y DELETE vacíos nunca se reportan como guardados', async () => {
  const m=modeloAdmin();m.solicitar=async()=>[];
  await assert.rejects(()=>m.guardarProducto({...producto(),id:5}),/no existe/);
  await assert.rejects(()=>m.eliminarProducto(5),/no existe/);
  await assert.rejects(()=>m.actualizarSolicitud(1,{estado_comercial:'contactada'}),/no existe/);
});

test('guarda galería persistente y conserva campos antiguos al editar', async () => {
  const m=modeloAdmin();let llamada;m.solicitar=async(ruta,opciones)=>{llamada={ruta,...opciones};return [{...JSON.parse(opciones.body),id:5}];};
  await m.guardarProducto({...producto(),id:5,moneda:'GTQ',imagen_url:'https://test.supabase.co/foto.png',imagenes:['https://test.supabase.co/foto.png']});
  assert.match(llamada.ruta,/id=eq.5/);assert.equal(llamada.method,'PATCH');
  const body=JSON.parse(llamada.body);assert.equal('categoria' in body,false);assert.equal('area' in body,false);assert.equal(body.imagenes.length,1);
});

test('catálogo transforma inventario agotado y conserva fotos', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify([{id:1,existencias:0,estado:'disponible',imagenes:['foto1','foto2']}]),{status:200});
    const m=new ProductoModel();const [p]=await m.obtenerTodos();assert.equal(p.estado,'vendida');assert.deepEqual(p.imagenes,['foto1','foto2']);
  } finally {globalThis.fetch=original;}
});

test('solicitudes rechazan datos y máquinas inválidas antes de llamar a Supabase', async () => {
  const m=new ProductoModel();m.productos=[{id:1},{id:2}];
  const base={nombre:'Cliente de prueba',telefono:'5555 5555',correo:'cliente@example.com',mensaje:'',productos:[{producto_id:1,cantidad:2},{producto_id:2,cantidad:1}]};
  for(const cambio of [{correo:'incorrecto'},{telefono:'abc'},{productos:[]},{productos:[{producto_id:1,cantidad:1},{producto_id:1,cantidad:2}]},{productos:[{producto_id:999,cantidad:1}]}])await assert.rejects(()=>m.enviarSolicitud({...base,...cambio}),/Revisa|Selecciona/);
});

test('una solicitud con varias máquinas usa únicamente la RPC pública', async () => {
  const original=globalThis.fetch;let llamada;
  try {
    globalThis.fetch=async(url,opciones)=>{llamada={url,...opciones};return new Response('123',{status:200});};
    const m=new ProductoModel();m.productos=[{id:1},{id:2}];
    const id=await m.enviarSolicitud({nombre:'Cliente prueba',telefono:'5555 5555',correo:'cliente@example.com',mensaje:'Consulta',productos:[{producto_id:1,cantidad:2},{producto_id:2,cantidad:1}]});
    assert.equal(id,123);assert.match(llamada.url,/rpc\/registrar_solicitud_comercial$/);assert.deepEqual(JSON.parse(llamada.body).p_datos.productos,[{producto_id:1,cantidad:2},{producto_id:2,cantidad:1}]);
  } finally {globalThis.fetch=original;}
});

async function probarGuardado({fallaSubida=false,fallaGuardado=false}={}) {
  let guardado;const eliminadas=[];let contador=0;let limpio=false;
  const control={disabled:false};
  const vista={panel:{querySelectorAll:()=>[control]},leerFormulario:()=>({...producto(),fotos:[{url:'foto-anterior'},{archivo:'a'},{archivo:'b'}]}),notificar(){},limpiarFormulario(){limpio=true;}};
  const modelo={validarProducto(){},async validarContenidoImagen(){},async subirImagen(){contador++;if(fallaSubida&&contador===2)throw Error('fallo');return 'foto-'+contador;},async guardarProducto(p){if(fallaGuardado){const e=Error('fallo DB');e.respuestaHttp=400;throw e;}guardado=p;},async eliminarImagen(url){eliminadas.push(url);}};
  const c=new AdminController(modelo,vista);c.cargarProductos=async()=>{};await c.guardarProducto({preventDefault(){}});
  assert.equal(control.disabled,false);assert.equal(c.guardando,false);return {guardado,eliminadas,limpio};
}

test('controlador conserva portada y todas las imágenes al guardar', async () => {
  const {guardado,limpio}=await probarGuardado();assert.deepEqual(guardado.imagenes,['foto-anterior','foto-1','foto-2']);assert.equal(guardado.imagen_url,'foto-anterior');assert.equal(guardado.moneda,'GTQ');assert.equal(limpio,true);
});

test('fallo de subida limpia nuevas fotos sin tocar ficha ni fotos anteriores', async () => {
  const {guardado,eliminadas,limpio}=await probarGuardado({fallaSubida:true});assert.equal(guardado,undefined);assert.deepEqual(eliminadas,['foto-1']);assert.equal(limpio,false);
});

test('fallo al persistir limpia las nuevas subidas y conserva el formulario', async () => {
  const {eliminadas,limpio}=await probarGuardado({fallaGuardado:true});assert.deepEqual(eliminadas,['foto-1','foto-2']);assert.equal(limpio,false);
});

test('una caída de red con resultado incierto no borra fotos posiblemente confirmadas', async () => {
  const eliminadas=[];const vista={panel:{querySelectorAll:()=>[]},leerFormulario:()=>({...producto(),fotos:[{archivo:'a'}]}),notificar(){},limpiarFormulario(){throw Error('No debe limpiar');}};
  const modelo={validarProducto(){},async validarContenidoImagen(){},async subirImagen(){return 'nueva';},async guardarProducto(){throw Error('Network error');},async eliminarImagen(url){eliminadas.push(url);}};
  const c=new AdminController(modelo,vista);await c.guardarProducto({preventDefault(){}});assert.deepEqual(eliminadas,[]);
});

const {metricasComerciales,validarSolicitudComercial}=await importar('js/comercial.js');
test('dashboard distingue solicitudes de clientes únicos y tareas pendientes de vencidas',()=>{
  const m=metricasComerciales({clientes:[{id:1},{id:2}],solicitudes:[{cliente_id:1,estado_comercial:'contactada'},{cliente_id:1,estado_comercial:'cotizada'},{cliente_id:2,estado_comercial:'nueva'}],seguimientos:[{cliente_id:1,siguiente_contacto:'2026-01-02',completado:false},{cliente_id:1,siguiente_contacto:'2025-12-30',completado:false},{cliente_id:1,completado:true}],cotizaciones:[{estado:'borrador'},{estado:'convertida'}],ventas:[{id:1}]},Date.parse('2026-01-01'));
  assert.equal(m['total-solicitudes'],3);assert.equal(m['total-clientes'],2);assert.equal(m['solicitudes-contactadas'],1);assert.equal(m['seguimientos-pendientes'],2);assert.equal(m['seguimientos-programados'],1);assert.equal(m['seguimientos-vencidos'],1);assert.equal(m['solicitudes-finalizadas'],1);assert.equal(m['ventas-concretadas'],1);
});
test('consulta personalizada y de catálogo permiten correo opcional y validan cantidades',()=>{
  const base={nombre:'Cliente local',telefono:'55551234',correo:'',operacion:'renta',mensaje:''};
  validarSolicitudComercial({...base,tipo:'personalizada',personalizada:{maquina:'Equipo solicitado',cantidad:2,presupuesto:''}});
  validarSolicitudComercial({...base,productos:[{producto_id:1,cantidad:3}]},[{id:1}]);
  for(const cantidad of [0,-1,1.5,1000])assert.throws(()=>validarSolicitudComercial({...base,productos:[{producto_id:1,cantidad}]},[{id:1}]));
  assert.throws(()=>validarSolicitudComercial({...base,website:'spam',productos:[{producto_id:1,cantidad:1}]},[{id:1}]));
});

test('se puede guardar y publicar con precio a consultar sin inventar un valor',()=>{
  const m=modeloAdmin();m.validarProducto({...producto(),precio:null,publicado:false});
  m.validarProducto({...producto(),precio:null,publicado:true});
});
test('búsqueda por uso, idioma, modelo y acentos; filtros y precio desconocido',()=>{
  const m=new ProductoModel();m.productos=[{id:1,nombre:'Linear Leg Press',marca:'Hammer Strength',modelo:'HS-01',area:'Piernas',categoria:'Palanca',precio:1000,existencias:1,estado:'disponible'},{id:2,nombre:'Bíceps',marca:'Life Fitness',precio:null,existencias:0,estado:'vendida'},{id:3,nombre:'Otra prensa',marca:'Otra',precio:2000,preventa:true,precio_especial:1500,existencias:0}];
  assert.equal(m.filtrar({busqueda:'prensa hammer'})[0].id,1);assert.equal(m.filtrar({busqueda:'piernas'})[0].id,1);assert.equal(m.filtrar({busqueda:'HS 01'})[0].id,1);assert.equal(m.filtrar({busqueda:'biceps'})[0].id,2);
  assert.deepEqual(m.filtrar({precioMinimo:1100,precioMaximo:1800}).map(p=>p.id),[3]);assert.deepEqual(m.filtrar({comercial:'preventa'}).map(p=>p.id),[3]);assert.deepEqual(m.filtrar({disponibilidad:'disponible'}).map(p=>p.id),[1]);assert.equal(m.filtrar({orden:'precio-desc'}).at(-1).id,2);
});

test('no confirma éxito si la respuesta del servidor conserva la máquina oculta',async()=>{
 const m=modeloAdmin();m.solicitar=async()=>[{...producto(),id:5,publicado:false}];
 await assert.rejects(()=>m.guardarProducto({...producto(),id:5,publicado:true}),error=>error.datosGuardados===true&&error.message.includes('publicado'));
});
