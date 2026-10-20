import { moneda, precioProducto, telefonoNormalizado } from './comercial.js?v=20';
import { contactoConfig } from './contacto.js?v=20';
export class CatalogoController {
  constructor(modelo,vista){
    this.modelo=modelo;this.vista=vista;this.seleccion=new Map();this.enviando=false;
  }
  async iniciar(){
    this.vista.mostrarCargando();this.vista.escucharFiltros(()=>this.actualizarCatalogo());
    this.vista.onSeleccion=id=>{
      if(this.seleccion.has(id))this.seleccion.delete(id);
      else if(this.seleccion.size<20)this.seleccion.set(id,1);
      else {alert('Puedes incluir hasta veinte equipos distintos en una solicitud.');return;}
      this.actualizarCatalogo();this.guardarSeleccion();
    };
    this.vista.onSolicitud=producto=>this.abrirFormulario(producto);
    document.querySelector('#abrir-solicitud').onclick=()=>this.abrirFormulario();
    document.querySelector('#solicitud-personalizada').onclick=()=>this.abrirFormulario(null,true);
    document.querySelector('#seguir-explorando').onclick=()=>this.dialogo.close();
    this.vista.onReintentar=()=>this.cargarCatalogo();
    this.configurarContacto();
    document.querySelector('#form-solicitud').onsubmit=e=>this.enviar(e);
    document.querySelector('#cerrar-formulario').onclick=()=>{if(!this.enviando)this.dialogo.close();};
    this.dialogo=document.querySelector('#solicitud-dialogo');
    this.dialogo.addEventListener('cancel',e=>{if(this.enviando)e.preventDefault();});
    document.querySelector('#form-solicitud').addEventListener('invalid',e=>{const opcionales=e.target.closest('details');if(opcionales)opcionales.open=true;},true);
    const refrescar=()=>{
      if(document.visibilityState==='hidden')return;
      if(this.dialogo.open){this.refrescoPendiente=true;return;}
      this.cargarCatalogo();
    };
    window.addEventListener('focus',refrescar);
    document.addEventListener('visibilitychange',refrescar);
    window.addEventListener('storage',e=>{if(e.key==='fitgear.catalogo.actualizado')refrescar();});
    this.dialogo.addEventListener('close',()=>{if(this.refrescoPendiente){this.refrescoPendiente=false;refrescar();}});
    setInterval(refrescar,30000);
    await this.cargarCatalogo();
  }
  async cargarCatalogo(){
    if(this.cargando)return;this.cargando=true;
    if(!this.iniciado)this.vista.mostrarCargando();
    try{
      const antes=JSON.stringify(this.modelo.productos);
      await this.modelo.obtenerTodos();
      const cambio=!this.iniciado||antes!==JSON.stringify(this.modelo.productos);
      if(cambio){this.vista.configurarFiltros(this.modelo.obtenerMarcas(),this.modelo.obtenerCategorias());this.restaurarSeleccion();this.actualizarCatalogo();}
      this.iniciado=true;
    }catch(error){if(!this.iniciado)this.vista.mostrarError(error);}
    finally{this.cargando=false;}
  }
  configurarContacto(){
    const caja=document.querySelector('#contactos-oficiales');caja.replaceChildren();
    const telefono=telefonoNormalizado(contactoConfig.whatsapp);
    if(/^[0-9]{8,15}$/.test(telefono)){const a=document.createElement('a');a.textContent='WhatsApp de FitGear';a.href=`https://wa.me/${telefono}`;a.target='_blank';a.rel='noopener noreferrer';caja.append(a);}
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactoConfig.correo)){const a=document.createElement('a');a.textContent=contactoConfig.correo;a.href=`mailto:${contactoConfig.correo}`;caja.append(a);}
    const horario=document.querySelector('#horario-contacto');horario.hidden=!contactoConfig.horario;horario.textContent=contactoConfig.horario;
  }
  guardarSeleccion(){
    try{sessionStorage.setItem('fitgear.cotizacion',JSON.stringify({fecha:Date.now(),items:[...this.seleccion]}));}catch{}
  }
  restaurarSeleccion(){
    try{
      const datos=JSON.parse(sessionStorage.getItem('fitgear.cotizacion')||'null');
      if(!datos||Date.now()-datos.fecha>86400000||!Array.isArray(datos.items))return;
      this.seleccion.clear();
      for(const [id,cantidad] of datos.items.slice(0,20)){
        const p=this.modelo.productos.find(p=>String(p.id)===String(id));
        if(p&&Number.isInteger(cantidad)&&cantidad>=1&&cantidad<=999)this.seleccion.set(p.id,cantidad);
      }
    }catch{}
  }
  actualizarCatalogo(){
    this.vista.seleccion=this.seleccion;
    this.vista.mostrarProductos(this.modelo.filtrar(this.vista.obtenerFiltros()));this.actualizarSeleccion();
  }
  actualizarSeleccion(){
    document.querySelector('#cantidad-seleccion').textContent=`${this.seleccion.size} equipo(s) · ${[...this.seleccion.values()].reduce((a,b)=>a+Number(b),0)} unidades solicitadas`;
    document.querySelector('.barra-interes').hidden=this.seleccion.size===0;
    document.querySelector('#abrir-solicitud').disabled=this.seleccion.size===0;
  }
  abrirFormulario(producto=null,personalizada=false){
    this.personalizada=personalizada;this.multiple=!producto&&!personalizada;
    this.itemsActuales=producto?new Map([[producto.id,1]]):new Map(this.seleccion);
    const form=document.querySelector('#form-solicitud');form.hidden=false;
    document.querySelector('#resultado-solicitud').textContent='';document.querySelector('#resultado-solicitud').className='';document.querySelector('#seguir-explorando').hidden=true;
    document.querySelector('#titulo-solicitud').textContent=personalizada?'Solicitar un equipo':producto?'Solicitar información':'Mi cotización de equipos';
    const campos=document.querySelector('#campos-personalizados');campos.hidden=!personalizada;campos.disabled=!personalizada;
    form.elements.operacion.value=producto?.preventa?'preventa':'compra';
    for(const n of ['maquina_buscada','cantidad_personalizada'])form.elements[n].required=personalizada;
    this.renderEquipos();this.actualizarResumen();
    if(!this.dialogo.open)this.dialogo.showModal();this.dialogo.scrollTop=0;
  }
  renderEquipos(){
    const lista=document.querySelector('#solicitud-maquinas');lista.replaceChildren();lista.hidden=this.personalizada;document.querySelector('#form-solicitud [type=submit]').disabled=!this.personalizada&&!this.itemsActuales.size;
    if(this.personalizada)return;
    for(const [id,cantidad] of this.itemsActuales){
      const p=this.modelo.productos.find(p=>String(p.id)===String(id));if(!p)continue;
      const fila=document.createElement('article');fila.className='equipo-solicitud';
      if(p.imagen||p.imagenes?.[0]){const img=document.createElement('img');img.src=p.imagen||p.imagenes[0];img.alt=p.nombre;fila.append(img);}else{const espacio=document.createElement('div');espacio.className='equipo-sin-foto';espacio.textContent='Sin foto';fila.append(espacio);}
      const info=document.createElement('div');const nombre=document.createElement('strong');nombre.textContent=p.nombre;
      const marca=document.createElement('p');marca.textContent=[p.marca,p.modelo].filter(Boolean).join(' · ');info.append(nombre,marca);
      const label=document.createElement('label');label.textContent='Cantidad';const input=document.createElement('input');input.type='number';input.min=1;input.max=999;input.step=1;input.value=cantidad;input.required=true;input.setAttribute('aria-label','Cantidad de '+p.nombre);
      input.oninput=()=>{this.itemsActuales.set(id,Number(input.value));if(this.multiple){this.seleccion.set(id,Number(input.value));this.actualizarSeleccion();this.guardarSeleccion();}this.actualizarResumen();};
      label.append(input);fila.append(info,label);
      if(this.multiple){const quitar=document.createElement('button');quitar.type='button';quitar.className='boton boton-neutral';quitar.textContent='Quitar';quitar.onclick=()=>{this.itemsActuales.delete(id);this.seleccion.delete(id);this.actualizarCatalogo();this.renderEquipos();this.actualizarResumen();this.guardarSeleccion();};fila.append(quitar);}
      lista.append(fila);
    }
    if(!this.itemsActuales.size)lista.textContent='No hay equipos seleccionados. Cierra esta ventana y agrega máquinas desde el catálogo.';
  }
  actualizarResumen(){
    const resumen=document.querySelector('#resumen-precio-solicitud');resumen.hidden=this.personalizada||!this.itemsActuales.size;if(resumen.hidden)return;
    let total=0,pendientes=0;
    for(const [id,cantidad] of this.itemsActuales){const p=this.modelo.productos.find(p=>String(p.id)===String(id)),precio=p?precioProducto(p):null;if(precio===null)pendientes++;else total+=Math.round(precio*100)*cantidad;}
    resumen.textContent=pendientes?`${pendientes} equipo(s) con precio a consultar.${total?' Subtotal de los equipos con precio: '+moneda(total/100)+'.':''} FitGear confirmará la cotización completa.`:`Referencia de los equipos seleccionados: ${moneda(total/100)}. FitGear confirmará el precio final y la disponibilidad.`;
  }
  async enviar(e){
    e.preventDefault();if(this.enviando)return;
    const f=e.currentTarget;const valor=n=>f.elements[n].value.trim();
    const datos={nombre:valor('nombre'),telefono:valor('telefono'),correo:valor('correo'),mensaje:valor('mensaje'),operacion:valor('operacion'),website:valor('website'),tipo:this.personalizada?'personalizada':'catalogo',
      productos:[...this.itemsActuales].map(([producto_id,cantidad])=>({producto_id,cantidad}))};
    if(this.personalizada)datos.personalizada={marca:valor('marca_buscada'),maquina:valor('maquina_buscada'),cantidad:Number(valor('cantidad_personalizada')),presupuesto:valor('presupuesto')};
    const aviso=document.querySelector('#resultado-solicitud');const controles=[...this.dialogo.querySelectorAll('button,input,select,textarea,fieldset')];const estados=controles.map(c=>c.disabled);
    this.enviando=true;controles.forEach(c=>c.disabled=true);aviso.textContent='Enviando solicitud...';
    try{
      const numero=await this.modelo.enviarSolicitud(datos);
      if(this.multiple){this.seleccion.clear();this.actualizarCatalogo();this.guardarSeleccion();}
      f.reset();f.hidden=true;aviso.className='';aviso.textContent=`¡Solicitud recibida! Referencia #${numero}. FitGear revisará los equipos y cantidades y te contactará por el teléfono que indicaste para confirmar disponibilidad, precios y condiciones.`;document.querySelector('#seguir-explorando').hidden=false;aviso.focus();
    }catch(error){aviso.className='error-solicitud';aviso.textContent='No se pudo enviar: '+error.message;}
    finally{this.enviando=false;controles.forEach((c,i)=>c.disabled=estados[i]);}
  }
}
