export class AdminView {
 constructor(){this.login=document.querySelector('#login');this.panel=document.querySelector('#administracion');this.formLogin=document.querySelector('#form-login');this.formProducto=document.querySelector('#form-producto');this.lista=document.querySelector('#lista-admin');this.mensaje=document.querySelector('#mensaje');this.titulo=document.querySelector('#titulo-formulario');this.salir=document.querySelector('#cerrar-sesion');this.guardar=document.querySelector('#guardar-producto');this.previa=document.querySelector('#vista-previa');this.previewUrl=null;this.imagenActual=null;}
 mostrarPanel(ok){this.login.hidden=ok;this.panel.hidden=!ok;this.salir.hidden=!ok;if(ok)this.mostrarSeccion('dashboard');else this.resumirSolicitudes(null);}
 mostrarSeccion(nombre){
   for(const seccion of ['dashboard','catalogo']){
     document.querySelector(`#seccion-${seccion}`).hidden=seccion!==nombre;
     const boton=document.querySelector(`#nav-${seccion}`);
     if(seccion===nombre)boton.setAttribute('aria-current','page');else boton.removeAttribute('aria-current');
   }
 }
 resumirSolicitudes(solicitudes){
   const valores={'total-solicitudes':solicitudes?.length,'solicitudes-pendientes':solicitudes?.filter(s=>s.estado==='pendiente').length,'solicitudes-contactadas':solicitudes?.filter(s=>s.estado==='contactado').length,'solicitudes-finalizadas':solicitudes?.filter(s=>s.estado==='finalizado').length};
   for(const [id,valor] of Object.entries(valores))document.querySelector(`#${id}`).textContent=valor??'—';
 }
 notificar(t,error=false){this.mensaje.textContent=t;this.mensaje.className=error?'error':'correcto';const aviso=document.querySelector('#mensaje-editor');aviso.textContent=t;aviso.className=error?'error':'correcto';}
 mostrarImagen() { this.previa.hidden=true; }
 limpiarFormulario(){
   for(const foto of this.fotos||[])if(foto.archivo)URL.revokeObjectURL(foto.url);
   this.mostrarEditor(false);
   this.fotos=[];this.formProducto.reset();this.formProducto.elements.id.value='';this.mostrarImagen();this.renderizarFotos();this.titulo.textContent='Registrar máquina';this.guardar.textContent='Guardar máquina';
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
   const datos={id:valor('id')?Number(valor('id')):null,existencias:Number(valor('existencias')),precio:Number(valor('precio')),oferta:f.elements.oferta.checked,fotos:[...(this.fotos||[])]};
   for(const n of ['nombre','marca','descripcion','estado'])datos[n]=valor(n);
   return datos;
 }
 editar(p){
   this.limpiarFormulario();for(const n of ['id','nombre','marca','descripcion','existencias','estado','precio'])this.formProducto.elements[n].value=p[n]??'';
   this.formProducto.elements.oferta.checked=Boolean(p.oferta);
   this.fotos=[...new Set([p.imagen_url,...(Array.isArray(p.imagenes)?p.imagenes:[])].filter(u=>typeof u==='string'&&u))].map(url=>({url}));this.renderizarFotos();
   document.querySelector('#cancelar-edicion').hidden=false;
   this.mostrarEditor(true);
   this.titulo.textContent='Editar máquina';this.guardar.textContent='Guardar cambios';this.formProducto.elements.nombre.focus();
 }
 mostrarProductos(productos,editar,eliminar){document.querySelector('#resumen-inventario').textContent=`${productos.length} máquina(s) registrada(s) · ${productos.reduce((total,p)=>total+Number(p.existencias||0),0)} unidades en inventario`;this.lista.replaceChildren();if(!productos.length){this.lista.textContent='No hay máquinas registradas.';return;}for(const p of productos){const fila=document.createElement('article');fila.className='fila-producto';const d=document.createElement('div');const nombre=document.createElement('strong');nombre.textContent=p.nombre;const info=document.createElement('p');info.textContent=`${p.marca} · ${p.existencias} unidades · ${p.estado} · ${p.precio==null?'Precio a consultar':'Q '+Number(p.precio).toLocaleString('es-GT',{minimumFractionDigits:2})} · ${p.oferta?'En oferta':'Precio regular'}`;d.append(nombre,info);const botones=document.createElement('div');botones.className='acciones';for(const [t,cb,cl] of [['Editar',editar,'secundario'],['Eliminar',eliminar,'peligro']]){const b=document.createElement('button');b.type='button';b.className=cl;b.textContent=t;b.addEventListener('click',()=>cb(p));botones.append(b);}const foto=p.imagen_url||(Array.isArray(p.imagenes)?p.imagenes[0]:'');if(foto){const img=document.createElement('img');img.src=foto;img.alt=p.nombre;img.loading='lazy';img.className='inventario-foto';img.onerror=()=>img.remove();fila.append(img);}fila.append(d,botones);this.lista.append(fila);}}
 mostrarSolicitudes(solicitudes,actualizar){this.resumirSolicitudes(solicitudes);const lista=document.querySelector('#lista-solicitudes');lista.replaceChildren();if(!solicitudes.length){lista.textContent='Todavía no hay solicitudes.';return;}for(const s of solicitudes){const art=document.createElement('details');art.className='solicitud';const titulo=document.createElement('summary');titulo.textContent=`${s.nombre} · ${s.estado}`;const fecha=document.createElement('p');fecha.textContent=new Date(s.creado_en).toLocaleString('es-GT',{timeZone:'America/Guatemala'});const detalle=document.createElement('p');detalle.textContent=`Teléfono: ${s.telefono} · Correo: ${s.correo}`;const maquinas=document.createElement('p');maquinas.textContent='Máquinas: ';for(const [i,x] of (s.solicitud_productos||[]).entries()){if(i)maquinas.append(document.createTextNode(', '));if(x.producto_id){const b=document.createElement('button');b.type='button';b.className='enlace-maquina';b.textContent=x.nombre_producto;b.onclick=()=>this.onAbrirProducto?.(x.producto_id);maquinas.append(b);}else maquinas.append(document.createTextNode(x.nombre_producto+' (eliminada del catálogo)'));}const mensaje=document.createElement('p');mensaje.textContent=s.mensaje||'Sin mensaje adicional';const enlaces=document.createElement('div');enlaces.className='acciones';const email=document.createElement('a');email.textContent='Enviar correo';email.href=`mailto:${encodeURIComponent(s.correo)}`;email.className='enlace-admin';enlaces.append(email);const telefono=s.telefono.replace(/\D/g,'');if(telefono.length>=8){const internacional=telefono.length===8?'502'+telefono:telefono;const wa=document.createElement('a');wa.href=`https://wa.me/${internacional}`;wa.target='_blank';wa.rel='noopener noreferrer';wa.textContent='WhatsApp';wa.className='enlace-admin';enlaces.append(wa);}const label=document.createElement('label');label.textContent='Seguimiento: ';const sel=document.createElement('select');for(const estado of ['pendiente','contactado','finalizado']){const opt=document.createElement('option');opt.value=estado;opt.textContent=estado;sel.append(opt);}sel.value=s.estado;sel.addEventListener('change',async()=>{sel.disabled=true;try{await actualizar(s,sel.value);titulo.textContent=`${s.nombre} · ${s.estado}`;}catch{sel.value=s.estado;}finally{sel.disabled=false;}});label.append(sel);art.append(titulo,fecha,detalle,maquinas,mensaje,enlaces,label);lista.append(art);}}
}