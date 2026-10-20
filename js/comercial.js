export const ESTADOS_ATENCION = {pendiente:'Pendiente',contactado:'Atendido'};
export const estadoAtencion = solicitud => ['contactado','finalizado'].includes(solicitud.estado)?'contactado':'pendiente';
export function resumenCliente(cliente,datos={}){
 const pertenece=fila=>String(fila.cliente_id)===String(cliente.id);
 const solicitudes=(datos.solicitudes||[]).filter(pertenece),ventas=(datos.ventas||[]).filter(pertenece);
 const pendientes=solicitudes.filter(s=>estadoAtencion(s)==='pendiente').length;
 return {solicitudes,ventas,pendientes,atencion:!solicitudes.length?'sin_solicitudes':pendientes?'pendiente':'contactado',recurrente:ventas.length>0};
}
export const moneda = valor => `Q ${Number(valor || 0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fecha = valor => valor ? new Date(valor).toLocaleString('es-GT',{timeZone:'America/Guatemala'}) : 'Sin programar';
export const telefonoNormalizado = valor => {
  const digitos=String(valor||'').replace(/\D/g,'');return digitos.length===8?'502'+digitos:digitos;
};
export function metricasComerciales(datos,ahora=Date.now()) {
  const {clientes=[],solicitudes=[],seguimientos=[],cotizaciones=[],ventas=[]}=datos;
  const contactados=new Set(solicitudes.filter(s=>estadoAtencion(s)==='contactado').map(s=>s.cliente_id).filter(id=>id!=null).map(String));
  return {
    'total-solicitudes':solicitudes.length,
    'solicitudes-pendientes':solicitudes.filter(s=>estadoAtencion(s)==='pendiente').length,
    'solicitudes-contactadas':contactados.size,
    'total-clientes':clientes.length,
    'seguimientos-pendientes':seguimientos.filter(s=>!s.completado).length,
    'seguimientos-programados':seguimientos.filter(s=>!s.completado&&s.siguiente_contacto&&new Date(s.siguiente_contacto).getTime()>=ahora).length,
    'seguimientos-vencidos':seguimientos.filter(s=>!s.completado&&s.siguiente_contacto&&new Date(s.siguiente_contacto).getTime()<ahora).length,
    'solicitudes-finalizadas':seguimientos.filter(s=>s.completado).length,
    'cotizaciones-pendientes':cotizaciones.filter(c=>['borrador','enviada'].includes(c.estado)).length,
    'ventas-concretadas':ventas.length
  };
}
export function validarSolicitudComercial(datos,productos=[]) {
  const normal=telefonoNormalizado(datos.telefono);
  if(typeof datos.nombre!=='string'||datos.nombre.trim().length<3||datos.nombre.trim().length>120||
    !/^\+?[0-9 ()-]{8,22}$/.test(datos.telefono||'')||normal.length<8||normal.length>15)
    throw new Error('Revisa el nombre y el teléfono o WhatsApp.');
  if(datos.correo && (datos.correo.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)))throw new Error('Revisa el correo electrónico.');
  if((datos.mensaje||'').length>2000||!['compra','preventa','renta'].includes(datos.operacion||'compra')||datos.website)throw new Error('Revisa los datos de la solicitud.');
  const cantidadValida=n=>Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=999;
  if(datos.tipo==='personalizada') {
    const d=datos.personalizada||{};
    if(!d.maquina?.trim()||d.maquina.length>160||(d.marca||'').length>100||!cantidadValida(d.cantidad)||
      (d.presupuesto!==''&&d.presupuesto!=null&&(!Number.isFinite(Number(d.presupuesto))||Number(d.presupuesto)<0||!/^\d{1,10}(\.\d{1,2})?$/.test(String(d.presupuesto)))))
      throw new Error('Indica la máquina, una cantidad válida y revisa el presupuesto.');
  } else {
    const items=datos.productos;
    if(!Array.isArray(items)||items.length<1||items.length>20||new Set(items.map(i=>String(i.producto_id))).size!==items.length||
      !items.every(i=>cantidadValida(i.cantidad)&&productos.some(p=>String(p.id)===String(i.producto_id))))
      throw new Error('Selecciona entre una y veinte máquinas, con cantidades entre 1 y 999.');
  }
}

export const normalizarBusqueda = valor => String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function textoBusquedaProducto(p) {
  let texto=normalizarBusqueda([p.nombre,p.marca,p.modelo,p.categoria,p.area,p.musculos,p.grupo_muscular,p.descripcion].join(' '));
  const grupos=[['leg press','prensa','prensa de piernas'],['piernas','legs','leg press','leg extension','leg curl'],['chest','pecho','pectoral','pectorales'],['back','espalda'],['row','rowing','remo'],['shoulder','hombro','hombros'],['leg extension','extension de piernas','cuadriceps'],['leg curl','curl de piernas','femoral','femorales'],['treadmill','caminadora','cinta de correr'],['bike','bicicleta'],['elliptical','eliptica']];
  const original=' '+texto+' ';
  for(const grupo of grupos)if(grupo.some(alias=>original.includes(' '+alias+' ')))texto+=' '+grupo.join(' ');
  return texto;
}
export function precioProducto(p) {
  // El precio especial solo corresponde a preventa cuando existe y es válido.
  const especial=p.precio_especial;
  const bruto=p.preventa&&especial!==null&&especial!==undefined&&especial!==''&&Number.isFinite(Number(especial))&&Number(especial)>=0?especial:p.precio;
  return bruto!==null&&bruto!==undefined&&bruto!==''&&Number.isFinite(Number(bruto))&&Number(bruto)>=0?Number(bruto):null;
}
export function disponibilidadProducto(p) {
  if(p.preventa)return {clave:'preventa',texto:'En preventa',detalle:'Consulta plazo de entrega y condiciones de reserva.'};
  if(Number(p.existencias)>0&&p.estado==='disponible')return {clave:'disponible',texto:'Disponible',detalle:`${p.existencias} ${Number(p.existencias)===1?'unidad disponible':'unidades disponibles'}`};
  if(Number(p.existencias)>0&&p.estado==='reservada')return {clave:'reservada',texto:'Reservada',detalle:'Consulta la próxima disponibilidad o equipos similares.'};
  return {clave:'vendida',texto:'Sin existencias',detalle:'Consulta opciones de reposición o equipos similares.'};
}
