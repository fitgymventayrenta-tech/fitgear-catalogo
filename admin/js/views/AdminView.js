import { ESTADOS_COMERCIALES, metricasComerciales, moneda, fecha, telefonoNormalizado, precioProducto } from "../../../js/utils/comercial.js?v=14";
export class AdminView {
 constructor(){this.login=document.querySelector('#login');this.panel=document.querySelector('#administracion');this.formLogin=document.querySelector('#form-login');this.formProducto=document.querySelector('#form-producto');this.lista=document.querySelector('#lista-admin');this.mensaje=document.querySelector('#mensaje');this.titulo=document.querySelector('#titulo-formulario');this.salir=document.querySelector('#cerrar-sesion');this.guardar=document.querySelector('#guardar-producto');this.previa=document.querySelector('#vista-previa');this.previewUrl=null;this.imagenActual=null;}
 mostrarPanel(ok){this.login.hidden=ok;this.panel.hidden=!ok;this.salir.hidden=!ok;if(ok)this.mostrarSeccion('dashboard');else this.resumirSolicitudes(null);}
 mostrarSeccion(nombre){
   for(const seccion of ['dashboard','catalogo','clientes']){
     document.querySelector(`#seccion-${seccion}`).hidden=seccion!==nombre;
     const boton=document.querySelector(`#nav-${seccion}`);
     if(seccion===nombre)boton.setAttribute('aria-current','page');else boton.removeAttribute('aria-current');
   }
 }
 resumirSolicitudes(datos){
   const metricas=metricasComerciales(datos||{});
   for(const [id,valor] of Object.entries(metricas))document.querySelector(`#${id}`).textContent=datos?valor:'—';
 }
 notificar(t,error=false){this.mensaje.textContent=t;this.mensaje.className=error?'error':'correcto';const aviso=document.querySelector('#mensaje-editor');aviso.textContent=t;aviso.className=error?'error':'correcto';}
 mostrarImagen() { this.previa.hidden=true; }
 limpiarFormulario(){
   for(const foto of this.fotos||[])if(foto.archivo)URL.revokeObjectURL(foto.url);
   this.mostrarEditor(false);
   this.fotos=[];this.formProducto.reset();this.formProducto.elements.precio.required=false;this.formProducto.elements.id.value='';this.mostrarImagen();this.renderizarFotos();this.titulo.textContent='Registrar máquina';this.guardar.textContent='Guardar y publicar';this.sincronizarInventario();
 }
 mostrarEditor(visible){
   const dialogo=document.querySelector('#editor-producto');
   if(visible){
     document.querySelector('#mensaje-editor').textContent='';
     if(!dialogo.open)dialogo.showModal();
     dialogo.scrollTop=0;
   }else if(dialogo.open)dialogo.close();
   document.querySelector('#nuevo-producto').setAttribute('aria-expanded',String(visible));
 }
 nuevaMaquina(){this.limpiarFormulario();this.mostrarEditor(true);this.formProducto.elements.nombre.focus();}
 volverInventario(){this.limpiarFormulario();document.querySelector('#nuevo-producto').focus();}
 sincronizarInventario(){
   const f=this.formProducto,n=Number(f.elements.existencias.value);
   if(Number.isInteger(n)&&n>=0){
     if(n===0)f.elements.estado.value='vendida';
     else if(f.elements.estado.value==='vendida')f.elements.estado.value='disponible';
   }
   const ayuda=document.querySelector('#estado-inventario-ayuda');
   ayuda.textContent=n===0?'Con cero unidades se mostrará «Sin existencias». Al ingresar unidades, el estado cambia a disponible.':'Si vendes una unidad, reduce las existencias. Para marcar vendida toda la ficha, las existencias deben quedar en cero.';
 }
 previsualizarArchivo(){
   this.fotos ||= [];
   for(const archivo of this.formProducto.elements.imagen.files)this.fotos.push({archivo,url:URL.createObjectURL(archivo)});
   this.formProducto.elements.imagen.value='';this.renderizarFotos();
 }
 renderizarFotos(){
   const galeria=document.querySelector('#galeria-admin');galeria.replaceChildren();
   (this.fotos||[]).forEach((foto,index)=>{
     const caja=document.createElement('div');const img=document.createElement('img');img.src=foto.url;img.alt=`Fotografía ${index+1}`;
     const portada=document.createElement(index===0?'span':'button');if(index!==0)portada.type='button';portada.textContent=index===0?'Portada':'Usar de portada';
     if(index!==0)portada.onclick=()=>{this.fotos.splice(index,1);this.fotos.unshift(foto);this.renderizarFotos();};
     const quitar=document.createElement('button');quitar.type='button';quitar.className='secundario';quitar.textContent='Quitar';quitar.onclick=()=>{if(foto.archivo)URL.revokeObjectURL(foto.url);this.fotos.splice(index,1);this.renderizarFotos();};
     caja.append(img,portada,quitar);galeria.append(caja);
   });
 }
 leerFormulario(){
   const f=this.formProducto;const valor=n=>String(f.elements.namedItem(n).value||'').trim();
   const datos={id:valor('id')?Number(valor('id')):null,existencias:Number(valor('existencias')),precio:valor('precio')===''?null:Number(valor('precio')),oferta:f.elements.oferta.checked,fotos:[...(this.fotos||[])]};
   for(const n of ['nombre','marca','categoria','descripcion','estado'])datos[n]=valor(n);
   return datos;
 }
 editar(p){
   this.limpiarFormulario();for(const n of ['id','nombre','marca','categoria','descripcion','existencias','estado','precio'])this.formProducto.elements[n].value=p[n]??'';
   this.formProducto.elements.precio.value=precioProducto(p)??'';
   this.formProducto.elements.oferta.checked=Boolean(p.oferta);this.formProducto.elements.precio.required=false;
   this.fotos=[...new Set([p.imagen_url,...(Array.isArray(p.imagenes)?p.imagenes:[])].filter(u=>typeof u==='string'&&u))].map(url=>({url}));this.renderizarFotos();
   document.querySelector('#cancelar-edicion').hidden=false;
   this.mostrarEditor(true);
   this.titulo.textContent='Editar máquina';this.guardar.textContent='Guardar y publicar';this.sincronizarInventario();this.formProducto.elements.nombre.focus();
 }
  metadatos(filas,clase='datos-ficha'){
    const dl=this.elemento('dl',clase);
    for(const [etiqueta,valor] of filas){if(valor===null||valor===undefined||valor==='')continue;const grupo=this.elemento('div');grupo.append(this.elemento('dt','',etiqueta),this.elemento('dd','',String(valor)));dl.append(grupo);}return dl;
  }
 mostrarProductos(productos,editar,eliminar){
    this.productos=productos;
    document.querySelector('#resumen-inventario').textContent=`${productos.length} máquinas · ${productos.filter(p=>p.publicado).length} publicadas · ${productos.filter(p=>!p.publicado).length} sin publicar · ${productos.reduce((t,p)=>t+Number(p.existencias||0),0)} unidades`;
    this.lista.replaceChildren();if(!productos.length){this.lista.textContent='No hay máquinas registradas.';return;}
    for(const p of productos){
      const fila=this.elemento('article','fila-producto tarjeta-inventario'),info=this.elemento('div','informacion-registro');
      info.append(this.elemento('strong','nombre-registro',p.nombre),this.elemento('p','marca-registro',p.marca),this.metadatos([['Publicación',p.publicado?'Publicada':'Sin publicar'],['Existencias',`${p.existencias} unidades`],['Precio',p.precio==null?'A consultar':'Q '+Number(p.precio).toLocaleString('es-GT',{minimumFractionDigits:2})],['Estado',({disponible:'Disponible',reservada:'Reservada',vendida:'Sin existencias'})[p.estado]||p.estado],['Oferta',p.oferta?'En oferta':'Precio regular']],'datos-registro'));
      const acciones=this.elemento('div','acciones');for(const [texto,cb,clase] of [['Editar',editar,'secundario'],['Eliminar',eliminar,'peligro']])acciones.append(this.boton(texto,()=>cb(p),clase));
      const foto=p.imagen_url||(Array.isArray(p.imagenes)?p.imagenes[0]:'');if(foto){const img=this.elemento('img','inventario-foto');img.src=foto;img.alt=p.nombre;img.loading='lazy';img.onerror=()=>img.remove();fila.append(img);}
      fila.append(info,acciones);this.lista.append(fila);
    }
  }
  configurarComercial() {
    document.querySelectorAll('[data-clientes]').forEach(b=>b.addEventListener('click',()=>this.mostrarClientes(b.dataset.clientes)));
    document.querySelector('#seccion-clientes-movil').onchange=e=>this.mostrarClientes(e.target.value);
    document.querySelector('#agregar-cliente').onclick=()=>this.formCliente();
    document.querySelector('#buscar-cliente').oninput=()=>this.renderDirectorio();
    for(const id of ['tipo','origen','asesor','departamento'])document.querySelector(`#${id}-cliente`).onchange=()=>this.renderDirectorio();
    document.querySelector('#buscar-solicitud').oninput=()=>this.renderSolicitudesFiltradas();
    const estado=document.querySelector('#estado-solicitud');
    for(const [valor,texto] of Object.entries(ESTADOS_COMERCIALES)){const o=this.elemento('option','',texto);o.value=valor;estado.append(o);}
    estado.onchange=()=>this.renderSolicitudesFiltradas();
    document.querySelector('#filtro-seguimiento').onchange=()=>this.renderSeguimientos(document.querySelector('#lista-seguimientos'));
  }

  elemento(tag,clase='',texto) {
    const e=document.createElement(tag);if(clase)e.className=clase;if(texto!==undefined)e.textContent=texto;return e;
  }
  boton(texto,accion,clase='secundario') {
    const b=this.elemento('button',clase,texto);b.type='button';
    b.onclick=async()=>{b.disabled=true;try{await accion();}catch(e){this.notificar(e.message,true);}finally{b.disabled=false;}};return b;
  }
  mostrarClientes(nombre) {
    document.querySelector('#seccion-clientes-movil').value=nombre;
    for(const boton of document.querySelectorAll('[data-clientes]')){
      const activo=boton.dataset.clientes===nombre;
      document.querySelector(`#clientes-${boton.dataset.clientes}`).hidden=!activo;
      if(activo)boton.setAttribute('aria-current','page');else boton.removeAttribute('aria-current');
    }
  }
  mostrarComercial(datos) {
    this.comercial=datos;
    this.resumirSolicitudes(datos);
    for(const campo of ['tipo','origen','asesor','departamento']){
      const select=document.querySelector(`#${campo}-cliente`),previo=select.value;
      select.replaceChildren();const todos=this.elemento('option','','Todos');todos.value='';select.append(todos);
      for(const valor of [...new Set(datos.clientes.map(c=>c[campo]).filter(Boolean))].sort()){
        const opcion=this.elemento('option','',valor);opcion.value=valor;select.append(opcion);
      }
      select.value=previo;
    }
    this.renderDirectorio();this.renderSolicitudesFiltradas();
    this.renderSolicitudes(document.querySelector('#lista-oportunidades'),datos.solicitudes.filter(s=>!['nueva','ganada','perdida'].includes(s.estado_comercial)));
    this.renderSeguimientos(document.querySelector('#lista-seguimientos'));
    this.renderCotizaciones(document.querySelector('#lista-cotizaciones'),datos.cotizaciones);
    this.renderVentas(document.querySelector('#lista-ventas'),datos.ventas);
    for(const ficha of this.panel.querySelectorAll('[data-ficha-cliente]')){const cliente=this.cliente(ficha.dataset.fichaCliente);if(cliente)this.fichaCliente(cliente,ficha.querySelector('.contenido-comercial'));}
  }
  cliente(id){return this.comercial?.clientes.find(c=>String(c.id)===String(id));}
  solicitud(id){return this.comercial?.solicitudes.find(s=>String(s.id)===String(id));}
  renderDirectorio() {
    if(!this.comercial)return;
    const lista=document.querySelector('#lista-clientes');lista.replaceChildren();
    const texto=document.querySelector('#buscar-cliente').value.trim().toLocaleLowerCase('es');
    const clientes=this.comercial.clientes.filter(c=>[c.nombre,c.empresa,c.telefono,c.correo,c.ubicacion_original].join(' ').toLocaleLowerCase('es').includes(texto)&&['tipo','origen','asesor','departamento'].every(k=>!document.querySelector(`#${k}-cliente`).value||c[k]===document.querySelector(`#${k}-cliente`).value));
    if(!clientes.length)lista.append(this.elemento('p','','No hay clientes con estos filtros.'));
    for(const c of clientes){
      const fila=this.elemento('article','fila-producto tarjeta-cliente');const info=this.elemento('div','informacion-registro');
      info.append(this.elemento('strong','nombre-registro',c.nombre),this.metadatos([['Gimnasio / empresa',c.empresa],['Teléfono',c.telefono||'Sin teléfono registrado'],['Ubicación',c.ubicacion_original||[c.departamento,c.municipio].filter(Boolean).join(', ')],['Origen',c.origen],['Tipo',c.tipo]],'datos-registro'));
      const acciones=this.elemento('div','acciones');acciones.append(this.boton('Ver ficha',()=>this.fichaCliente(c)),this.boton('Editar',()=>this.formCliente(c)));
      fila.append(info,acciones);lista.append(fila);
    }
    const pendientes=(this.comercial.clientes_fuentes||[]).filter(f=>f.estado==='pendiente');
    if(pendientes.length){
      lista.append(this.elemento('h3','',`Importación: ${pendientes.length} filas pendientes de revisión`),this.elemento('p','','Estas filas se conservaron sin fusionar contactos. Confirma a quién pertenece cada teléfono antes de crear o vincular una ficha.'));
      for(const f of pendientes){const r=f.datos_originales||{};const fila=this.elemento('article','fila-producto');const contenido=this.elemento('div');contenido.append(this.elemento('strong','',r.nombre||'Nombre no indicado'),this.elemento('p','',[r.telefono,r.gym_proyecto,r.ubicacion].filter(Boolean).join(' · ')),this.elemento('p','',`${f.documento}, página ${f.pagina}, fila ${f.fila}. ${f.observaciones}`));fila.append(contenido);lista.append(fila);}
    }
  }
  renderSolicitudesFiltradas(){
    if(!this.comercial)return;
    const texto=document.querySelector('#buscar-solicitud').value.trim().toLocaleLowerCase('es'),estado=document.querySelector('#estado-solicitud').value;
    this.renderSolicitudes(document.querySelector('#lista-solicitudes'),this.comercial.solicitudes.filter(s=>(!estado||s.estado_comercial===estado)&&[s.id,s.nombre,...(s.solicitud_productos||[]).map(p=>p.nombre_producto),s.personalizada?.maquina].join(' ').toLocaleLowerCase('es').includes(texto)));
  }
  renderSolicitudes(lista,solicitudes){
    lista.replaceChildren();if(!solicitudes.length){lista.textContent='No hay solicitudes en esta sección.';return;}
    for(const s of solicitudes){
      const art=this.elemento('details','solicitud');art.append(this.elemento('summary','',`#${s.id} · ${s.nombre} · ${ESTADOS_COMERCIALES[s.estado_comercial]||s.estado}`));
      art.append(this.elemento('p','',`${fecha(s.creado_en)} · ${s.origen} · ${s.operacion}`),this.elemento('p','',`${s.telefono}${s.correo?' · '+s.correo:''}`));
      for(const p of s.solicitud_productos||[]){
        const fila=this.elemento('div','solicitud-equipo');
        if(p.imagen_producto){const img=this.elemento('img');img.src=p.imagen_producto;img.alt='';img.loading='lazy';fila.append(img);}
        fila.append(this.elemento('p','',`${p.cantidad} × ${p.nombre_producto} · ${p.marca_producto||''} ${p.modelo_producto||''}`));
        if(p.producto_id)fila.append(this.boton('Ver máquina',()=>this.onAbrirProducto(p.producto_id)));art.append(fila);
      }
      if(s.tipo==='personalizada'){const d=s.personalizada||{};art.append(this.elemento('p','',`Solicitud personalizada: ${d.cantidad} × ${d.marca||''} ${d.maquina||''}${d.presupuesto!==''&&d.presupuesto!=null?' · Presupuesto '+moneda(d.presupuesto):''}`));}
      art.append(this.elemento('p','',s.mensaje||'Sin comentarios adicionales'));
      const cambios=this.elemento('div','campos');
      const estado=this.campo(cambios,'estado','Estado','select',s.estado_comercial,Object.entries(ESTADOS_COMERCIALES));
      const asesor=this.campo(cambios,'asesor','Asesor asignado','text',s.asesor);asesor.maxLength=120;
      art.append(cambios);
      const acciones=this.elemento('div','acciones');
      acciones.append(this.boton('Guardar estado y asesor',()=>this.onComercial('solicitud',{id:s.id,campos:{estado_comercial:estado.value,asesor:asesor.value.trim()}})),this.boton('Ver ficha del cliente',()=>this.fichaCliente(this.cliente(s.cliente_id))),this.boton('Registrar seguimiento',()=>this.formSeguimiento(s)),this.boton('Crear cotización',()=>this.formCotizacion(s)));
      this.contactos(acciones,s.telefono,s.correo);art.append(acciones);
      const historial=this.elemento('div');art.append(this.elemento('h3','','Historial de seguimiento'),historial);
      this.renderSeguimientos(historial,this.comercial.seguimientos.filter(f=>String(f.solicitud_id)===String(s.id)),false);lista.append(art);
    }
  }
  contactos(caja,telefono,correo){
    if(telefono){const a=this.elemento('a','enlace-admin','WhatsApp');a.href=`https://wa.me/${telefonoNormalizado(telefono)}`;a.target='_blank';a.rel='noopener noreferrer';caja.append(a);}
    if(correo){const a=this.elemento('a','enlace-admin','Enviar correo');a.href=`mailto:${encodeURIComponent(correo)}`;caja.append(a);}
  }
  abrirDialogo(titulo){
    const dialogo=this.elemento('dialog','panel comercial-modal');dialogo.dataset.comercialDialogo='';
    dialogo.setAttribute('aria-label',titulo);const cabecera=this.elemento('div','encabezado-panel cabecera-modal');cabecera.append(this.elemento('h2','',titulo),this.boton('Cerrar',()=>dialogo.close()));
    const contenido=this.elemento('div','contenido-comercial');dialogo.append(cabecera,contenido);
    dialogo.addEventListener('cancel',e=>{if(dialogo.dataset.guardando)e.preventDefault();});
    dialogo.addEventListener('close',()=>dialogo.remove());this.panel.append(dialogo);dialogo.showModal();return {dialogo,contenido};
  }
  campo(caja,nombre,etiqueta,tipo='text',valor='',opciones=[]){
    const label=this.elemento('label','',etiqueta);const input=this.elemento(tipo==='textarea'?'textarea':tipo==='select'?'select':'input');
    if(!['select','textarea'].includes(tipo))input.type=tipo;input.name=nombre;
    for(const [v,t] of opciones){const o=this.elemento('option','',t);o.value=v;input.append(o);}
    input.value=valor??'';if(tipo==='textarea'){input.rows=3;input.maxLength=5000;}else if(tipo==='text')input.maxLength=160;
    label.append(input);caja.append(label);return input;
  }
  formulario(titulo,construir,guardar){
    const {dialogo,contenido}=this.abrirDialogo(titulo);const form=this.elemento('form');const campos=this.elemento('div','campos');
    const leer=construir(campos,form);const boton=this.elemento('button','guardar-formulario','Guardar');boton.type='submit';const aviso=this.elemento('p');aviso.setAttribute('role','status');
    form.append(campos,boton,aviso);contenido.append(form);
    form.onsubmit=async e=>{e.preventDefault();if(dialogo.dataset.guardando)return;dialogo.dataset.guardando='true';
      const controles=[...dialogo.querySelectorAll('button,input,select,textarea')];const estados=controles.map(c=>c.disabled);
      try{const datos=leer();controles.forEach(c=>c.disabled=true);aviso.textContent='Guardando...';await guardar(datos);dialogo.close();}
      catch(error){aviso.textContent=error.message;aviso.className='error';}
      finally{delete dialogo.dataset.guardando;controles.forEach((c,i)=>c.disabled=estados[i]);}
    };return dialogo;
  }
  formCliente(cliente={}){
    this.formulario(cliente.id?'Editar cliente':'Agregar cliente',caja=>{
      const datos={};for(const [n,e] of [['nombre','Nombre completo *'],['empresa','Empresa o gimnasio'],['telefono','Teléfono (si está disponible)'],['whatsapp','WhatsApp'],['correo','Correo electrónico'],['ubicacion_original','Ubicación original (sin interpretar)'],['departamento','Departamento'],['municipio','Municipio'],['tipo','Tipo de cliente'],['origen','Origen del contacto'],['asesor','Asesor responsable'],['observaciones','Observaciones']]){
        datos[n]=this.campo(caja,n,e,n==='observaciones'?'textarea':n==='correo'?'email':n==='telefono'||n==='whatsapp'?'tel':'text',cliente[n]??({tipo:'particular',origen:'manual'}[n]||''));
      }
      datos.nombre.required=true;datos.nombre.minLength=3;datos.nombre.maxLength=120;datos.telefono.required=false;datos.telefono.pattern='[+0-9 ()-]{8,22}';datos.telefono.maxLength=22;
      datos.empresa.maxLength=160;datos.observaciones.maxLength=5000;datos.ubicacion_original.maxLength=500;datos.correo.maxLength=254;datos.whatsapp.maxLength=22;for(const n of ['departamento','municipio'])datos[n].maxLength=100;for(const n of ['tipo','origen'])datos[n].maxLength=80;datos.asesor.maxLength=120;
      for(const [titulo,nombres] of [['Datos de contacto',['nombre','empresa','telefono','whatsapp','correo']],['Ubicación',['ubicacion_original','departamento','municipio']],['Información comercial',['tipo','origen','asesor','observaciones']]]){
        const grupo=this.elemento('fieldset','grupo-formulario ancho-completo');grupo.append(this.elemento('legend','',titulo));for(const n of nombres)grupo.append(datos[n].closest('label'));caja.append(grupo);
      }
      return()=>({id:cliente.id,...Object.fromEntries(Object.entries(datos).map(([k,v])=>[k,v.value.trim()]))});
    },datos=>this.onComercial('cliente',datos));
  }
  fichaCliente(cliente,existente=null){
    if(!cliente)throw new Error('La solicitud no tiene una ficha vinculada. Revisa la migración de clientes.');
    const modal=existente?{contenido:existente}:this.abrirDialogo(cliente.nombre);const {contenido}=modal;contenido.replaceChildren();if(modal.dialogo)modal.dialogo.dataset.fichaCliente=cliente.id;const datos=this.comercial;const esCliente=x=>String(x.cliente_id)===String(cliente.id);
    contenido.append(this.metadatos([['Empresa',cliente.empresa],['Teléfono',cliente.telefono],['Correo',cliente.correo],['Ubicación original',cliente.ubicacion_original],['Ubicación',[cliente.departamento,cliente.municipio].filter(Boolean).join(', ')],['Tipo',cliente.tipo],['Origen',cliente.origen],['Asesor',cliente.asesor],['Observaciones',cliente.observaciones]]));
    for(const fuente of datos.clientes_fuentes||[]){if(String(fuente.cliente_id)!==String(cliente.id))continue;contenido.append(this.elemento('p','',`Fuente: ${fuente.documento}, página ${fuente.pagina}, fila ${fuente.fila}. ${fuente.observaciones||''}`));}
    const acciones=this.elemento('div','acciones');acciones.append(this.boton('Editar cliente',()=>this.formCliente(cliente)),this.boton('Nueva solicitud',()=>this.formSolicitudCliente(cliente)),this.boton('Registrar seguimiento',()=>this.formSeguimiento(null,cliente)));this.contactos(acciones,cliente.whatsapp||cliente.telefono,cliente.correo);contenido.append(acciones);
    const seccion=(titulo)=>{const bloque=this.elemento('details','seccion-ficha');bloque.append(this.elemento('summary','',titulo));const caja=this.elemento('div','seccion-ficha-contenido');bloque.append(caja);contenido.append(bloque);return caja;};
    const propias=datos.solicitudes.filter(esCliente);
    const maquinas=seccion('Máquinas solicitadas');for(const s of propias){for(const p of s.solicitud_productos||[])maquinas.append(this.elemento('p','',`Solicitud #${s.id}: ${p.cantidad} × ${p.nombre_producto}`));if(s.personalizada)maquinas.append(this.elemento('p','',`Solicitud #${s.id}: ${s.personalizada.cantidad} × ${s.personalizada.maquina} (personalizada)`));}
    this.renderSolicitudes(seccion('Solicitudes anteriores'),propias);
    this.renderCotizaciones(seccion('Cotizaciones'),datos.cotizaciones.filter(esCliente));
    this.renderSeguimientos(seccion('Historial de seguimientos'),datos.seguimientos.filter(esCliente),false);
    this.renderSeguimientos(seccion('Próximas actividades'),datos.seguimientos.filter(f=>esCliente(f)&&!f.completado&&f.siguiente_contacto),false);
    this.renderVentas(seccion('Compras realizadas'),datos.ventas.filter(esCliente));
  }
  formSolicitudCliente(cliente){
    if(!cliente.telefono){this.notificar('Agrega un teléfono real en la ficha antes de crear una solicitud.',true);return;}
    this.formulario(`Nueva solicitud de ${cliente.nombre}`,caja=>{
      const tipo=this.campo(caja,'tipo','Solicitud','select','catalogo',[['catalogo','Equipos del catálogo'],['personalizada','Equipo personalizado']]);
      const operacion=this.campo(caja,'operacion','Tipo de operación','select','compra',['compra','preventa','renta'].map(v=>[v,v]));
      const catalogo=this.elemento('div','ancho-completo selector-equipos');const opciones=[];
      for(const p of this.productos||[]){if(!p.publicado)continue;const fila=this.elemento('div','selector-equipo');const label=this.elemento('label');const check=this.elemento('input');check.type='checkbox';label.append(check,document.createTextNode(p.nombre+' · '+p.marca));
        const cantidad=this.elemento('input');cantidad.type='number';cantidad.min=1;cantidad.max=999;cantidad.step=1;cantidad.value=1;cantidad.setAttribute('aria-label','Cantidad de '+p.nombre);fila.append(label,cantidad);catalogo.append(fila);opciones.push({p,check,cantidad});
      }
      caja.append(catalogo);const personal=this.elemento('div','ancho-completo campos');personal.hidden=true;
      const marca=this.campo(personal,'marca','Marca buscada');marca.maxLength=100;
      const maquina=this.campo(personal,'maquina','Máquina o modelo');maquina.maxLength=160;
      const cantidad=this.campo(personal,'cantidad','Cantidad','number',1);cantidad.min=1;cantidad.max=999;cantidad.step=1;
      caja.append(personal);tipo.onchange=()=>{personal.hidden=tipo.value!=='personalizada';catalogo.hidden=tipo.value!=='catalogo';};
      const mensaje=this.campo(caja,'mensaje','Comentarios','textarea');mensaje.maxLength=2000;
      return()=>({cliente_id:cliente.id,solicitud:{tipo:tipo.value,operacion:operacion.value,mensaje:mensaje.value,productos:opciones.filter(x=>x.check.checked).map(x=>({producto_id:x.p.id,cantidad:Number(x.cantidad.value)})),personalizada:{marca:marca.value,maquina:maquina.value,cantidad:Number(cantidad.value),presupuesto:''}}});
    },datos=>this.onComercial('solicitud-interna',datos));
  }
  formSeguimiento(solicitud,cliente){
    cliente ||= this.cliente(solicitud?.cliente_id);
    if(!cliente)throw new Error('Selecciona un cliente.');
    this.formulario('Registrar seguimiento',caja=>{
      const datos={};datos.fecha=this.campo(caja,'fecha','Fecha de contacto','datetime-local');
      datos.medio=this.campo(caja,'medio','Medio de contacto','select','whatsapp',['whatsapp','llamada','correo','visita','instagram','facebook','otro'].map(v=>[v,v]));
      for(const [n,e] of [['responsable','Responsable *'],['resumen','Resumen de conversación *'],['respuesta','Respuesta del cliente'],['acuerdos','Acuerdos'],['proxima_accion','Próxima acción']])datos[n]=this.campo(caja,n,e,n==='responsable'?'text':'textarea',n==='responsable'?(solicitud?.asesor||cliente.asesor):'');
      datos.responsable.required=true;datos.resumen.required=true;datos.responsable.maxLength=120;datos.proxima_accion.maxLength=2000;
      datos.siguiente_contacto=this.campo(caja,'siguiente_contacto','Fecha del siguiente contacto','datetime-local');
      return()=>{const d=Object.fromEntries(Object.entries(datos).map(([k,v])=>[k,v.value]));for(const k of ['fecha','siguiente_contacto'])d[k]=d[k]?new Date(d[k]).toISOString():null;return {...d,cliente_id:cliente.id,solicitud_id:solicitud?.id||null};};
    },datos=>this.onComercial('seguimiento',datos));
  }
  renderSeguimientos(lista,seguimientos=this.comercial?.seguimientos||[],filtrar=true){
    lista.replaceChildren();const filtro=filtrar?document.querySelector('#filtro-seguimiento').value:'todos';const ahora=Date.now();
    const filas=seguimientos.filter(s=>filtro==='todos'||filtro==='completados'&&s.completado||filtro==='pendientes'&&!s.completado&&s.siguiente_contacto&&new Date(s.siguiente_contacto)>=ahora||filtro==='vencidos'&&!s.completado&&s.siguiente_contacto&&new Date(s.siguiente_contacto)<ahora).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    if(!filas.length)lista.textContent='No hay seguimientos en esta sección.';
    for(const f of filas){const art=this.elemento('article','registro-comercial');
      art.append(this.elemento('strong','',`${this.cliente(f.cliente_id)?.nombre||'Cliente'} · ${f.medio} · ${fecha(f.fecha)}`),this.elemento('p','',`${f.responsable}: ${f.resumen}`));
      for(const [etiqueta,valor] of [['Respuesta',f.respuesta],['Acuerdos',f.acuerdos],['Próxima acción',f.proxima_accion]])if(valor)art.append(this.elemento('p','',`${etiqueta}: ${valor}`));
      if(f.siguiente_contacto)art.append(this.elemento('p',!f.completado&&new Date(f.siguiente_contacto)<ahora?'alerta-comercial':'',`Próximo contacto: ${fecha(f.siguiente_contacto)}`));
      art.append(this.elemento('p','',f.completado?'Completado: '+fecha(f.completado_en):'Pendiente'));
      if(!f.completado)art.append(this.boton('Completar tarea',()=>this.onComercial('completar',{id:f.id})));lista.append(art);
    }
  }
  formCotizacion(solicitud){
    this.formulario(`Cotizar solicitud #${solicitud.id}`,(caja,form)=>{
      const fuentes=solicitud.tipo==='personalizada'?[{producto_id:null,nombre_producto:solicitud.personalizada.maquina,cantidad:solicitud.personalizada.cantidad}]:(solicitud.solicitud_productos||[]);
      const lineas=[];
      for(const p of fuentes){const grupo=this.elemento('fieldset','ancho-completo');grupo.append(this.elemento('legend','',p.nombre_producto));
        const cantidad=this.campo(grupo,'cantidad','Cantidad','number',p.cantidad);cantidad.min=1;cantidad.max=999;cantidad.step=1;cantidad.required=true;
        const actual=this.productos?.find(x=>String(x.id)===String(p.producto_id));
        const precio=this.campo(grupo,'precio','Precio unitario Q','number',actual?precioProducto(actual)??'':'');precio.min=0;precio.max=9999999999;precio.step='.01';precio.required=true;
        lineas.push({p,cantidad,precio});caja.append(grupo);
      }
      const vence=this.campo(caja,'vence_en','Válida hasta','date');const notas=this.campo(caja,'notas','Notas y condiciones','textarea');
      const total=this.elemento('p','ancho-completo');const calcular=()=>total.textContent='Total: '+moneda(lineas.reduce((s,l)=>s+Number(l.cantidad.value)*Number(l.precio.value),0));calcular();form.oninput=calcular;caja.append(total);
      return()=>({solicitud_id:solicitud.id,vence_en:vence.value,notas:notas.value,items:lineas.map(l=>({producto_id:l.p.producto_id,nombre:l.p.nombre_producto,cantidad:Number(l.cantidad.value),precio:Number(l.precio.value)}))});
    },datos=>this.onComercial('cotizacion',datos));
  }
  renderCotizaciones(lista,cotizaciones){
    lista.replaceChildren();if(!cotizaciones.length)lista.textContent='No hay cotizaciones.';
    for(const c of cotizaciones){const art=this.elemento('details','solicitud');art.append(this.elemento('summary','',`Cotización #${c.id} · ${this.cliente(c.cliente_id)?.nombre||''} · ${moneda(c.total)} · ${c.estado}`));
      art.append(this.elemento('p','',`Solicitud #${c.solicitud_id} · ${fecha(c.creado_en)}${c.vence_en?' · Válida hasta '+c.vence_en:''}`));this.partidas(art,c.items);
      if(c.notas)art.append(this.elemento('p','',c.notas));
      if(c.estado!=='convertida'){
        const estado=this.campo(art,'estado','Estado','select',c.estado,['borrador','enviada','aceptada','rechazada','vencida'].map(x=>[x,x]));
        art.append(this.boton('Guardar estado',()=>this.onComercial('estado-cotizacion',{id:c.id,estado:estado.value})));
        if(c.estado==='aceptada')art.append(this.boton('Convertir en pedido',()=>this.formPedido(c)));
      }lista.append(art);
    }
  }
  partidas(caja,items){for(const item of items||[])caja.append(this.elemento('p','',`${item.cantidad} × ${item.nombre} · ${moneda(item.precio)} c/u · ${moneda(item.cantidad*item.precio)}`));}
  formPedido(cotizacion){
    this.formulario(`Confirmar pedido de cotización #${cotizacion.id}`,caja=>{
      caja.append(this.elemento('p','ancho-completo',`Total ${moneda(cotizacion.total)}. Al confirmar se descuentan las cantidades de las máquinas del inventario. Los equipos personalizados sin producto asociado se registran sin descuento de inventario.`));
      const anticipo=this.campo(caja,'anticipo','Anticipo Q','number',0);anticipo.min=0;anticipo.max=cotizacion.total;anticipo.step='.01';anticipo.required=true;
      return()=>({cotizacion:cotizacion.id,anticipo:Number(anticipo.value)});
    },datos=>this.onComercial('pedido',datos));
  }
  renderVentas(lista,ventas){
    lista.replaceChildren();if(!ventas.length)lista.textContent='No hay ventas ni pedidos.';
    for(const v of ventas){const pagos=this.comercial.pagos.filter(p=>String(p.venta_id)===String(v.id));const pagado=pagos.reduce((s,p)=>s+Math.round(Number(p.monto)*100),0)/100;
      const saldo=Math.round((Number(v.total)-pagado)*100)/100;const art=this.elemento('details','solicitud');
      art.append(this.elemento('summary','',`Pedido #${v.id} · ${this.cliente(v.cliente_id)?.nombre||''} · ${moneda(v.total)}`),this.elemento('p','',`${fecha(v.creado_en)} · Cotización #${v.cotizacion_id} · Solicitud #${v.solicitud_id}`));
      this.partidas(art,v.items);art.append(this.elemento('strong','',`Pagado ${moneda(pagado)} · Saldo ${moneda(saldo)}`));
      const estado=this.campo(art,'entrega','Estado de entrega','select',v.estado_entrega,['pendiente','en_preparacion','enviada','entregada'].map(x=>[x,x]));
      art.append(this.boton('Actualizar entrega',()=>this.onComercial('entrega',{id:v.id,estado:estado.value})));
      if(saldo>0)art.append(this.boton('Registrar pago',()=>this.formulario(`Pago del pedido #${v.id}`,caja=>{
        const monto=this.campo(caja,'monto','Monto Q','number');monto.min='.01';monto.max=saldo;monto.step='.01';monto.required=true;
        const medio=this.campo(caja,'medio','Medio de pago','select','transferencia',['transferencia','efectivo','tarjeta','otro'].map(x=>[x,x]));
        const referencia=this.campo(caja,'referencia','Referencia');referencia.maxLength=200;
        return()=>({venta:v.id,monto:Number(monto.value),medio:medio.value,referencia:referencia.value});
      },datos=>this.onComercial('pago',datos))));
      art.append(this.elemento('h3','','Historial de pagos'));for(const p of pagos)art.append(this.elemento('p','',`${fecha(p.fecha)} · ${moneda(p.monto)} · ${p.medio} · ${p.referencia}`));lista.append(art);
    }
  }

}
