import { moneda, precioProducto, disponibilidadProducto } from './comercial.js?v=21';
import { contactoConfig } from './contacto.js?v=21';

export class CatalogoView {
  constructor({soloLectura=false}={}){
    this.soloLectura=soloLectura;
    this.lista=document.querySelector('#lista-productos');this.contador=document.querySelector('#contador-productos');
    this.mensaje=document.querySelector('#mensaje-vacio');this.busqueda=document.querySelector('#buscar-producto');
    this.marca=document.querySelector('#filtro-marca');this.categoria=document.querySelector('#filtro-categoria');
    this.seleccion=new Map();this.onSeleccion=()=>{};
  }
  crear(tag,clase='',texto){const e=document.createElement(tag);if(clase)e.className=clase;if(texto!==undefined)e.textContent=texto;return e;}
  boton(texto,clase,accion){const b=this.crear('button',clase,texto);b.type='button';b.onclick=accion;return b;}
  configurarFiltros(marcas,categorias){this.llenarSelect(this.marca,marcas,'Todas las marcas');this.llenarSelect(this.categoria,categorias,'Todas las categorías');}
  llenarSelect(elemento,valores,etiqueta){const previo=elemento.value;elemento.replaceChildren();for(const [valor,texto] of [['',etiqueta],...valores.map(v=>[v,v])]){const o=this.crear('option','',texto);o.value=valor;elemento.append(o);}if(valores.includes(previo))elemento.value=previo;}
  obtenerFiltros(){return {busqueda:this.busqueda.value,marca:this.marca.value,categoria:this.categoria.value,
    disponibilidad:document.querySelector('#filtro-disponibilidad').value,comercial:document.querySelector('#filtro-comercial').value,
    precioMinimo:document.querySelector('#precio-minimo').value,precioMaximo:document.querySelector('#precio-maximo').value,orden:document.querySelector('#orden-productos').value};}
  escucharFiltros(callback){
    this.busqueda.oninput=callback;
    for(const id of ['filtro-marca','filtro-categoria','filtro-disponibilidad','filtro-comercial','orden-productos'])document.querySelector('#'+id).onchange=callback;
    for(const id of ['precio-minimo','precio-maximo'])document.querySelector('#'+id).oninput=callback;
    document.querySelector('#abrir-filtros').onclick=()=>{
      const panel=document.querySelector('#filtros-avanzados'),boton=document.querySelector('#abrir-filtros');panel.hidden=!panel.hidden;boton.setAttribute('aria-expanded',String(!panel.hidden));
    };
    for(const id of ['limpiar-filtros','restablecer-busqueda'])document.querySelector('#'+id).onclick=()=>{
      for(const campo of document.querySelectorAll('#filtros-avanzados input,#filtros-avanzados select'))campo.value='';
      this.busqueda.value='';document.querySelector('#orden-productos').value='disponibilidad';callback();this.busqueda.focus();
    };
    document.querySelector('#precio-minimo').addEventListener('invalid',()=>{document.querySelector('#filtros-avanzados').hidden=false;});
  }
  actualizarIndicadoresFiltros(){
    const filtros=this.obtenerFiltros(),activos=Object.entries(filtros).filter(([k,v])=>k!=='orden'&&k!=='busqueda'&&v!=='').length;
    document.querySelector('#abrir-filtros').textContent=activos?`Filtros (${activos})`:'Filtros';
    document.querySelector('#limpiar-filtros').hidden=!activos&&!filtros.busqueda;
    const min=document.querySelector('#precio-minimo'),max=document.querySelector('#precio-maximo');
    const invalido=!min.validity.valid||!max.validity.valid||(min.value!==''&&max.value!==''&&Number(min.value)>Number(max.value));
    const aviso=document.querySelector('#aviso-catalogo');aviso.hidden=!invalido;
    if(invalido)aviso.textContent='Revisa el rango: usa precios desde Q 0 y un máximo mayor o igual al mínimo.';
  }
  mostrarCargando(){this.lista.replaceChildren(this.crear('p','estado-catalogo','Cargando equipos…'));this.contador.textContent='';this.mensaje.hidden=true;}
  mostrarError(){
    const caja=this.crear('div','estado-catalogo');caja.append(this.crear('h3','','No pudimos cargar los equipos'),this.crear('p','','Intenta de nuevo para consultar disponibilidad y precios.'),this.boton('Volver a intentar','boton boton-principal',()=>this.onReintentar?.()));
    this.lista.replaceChildren(caja);this.contador.textContent='';this.mensaje.hidden=true;
  }
  mostrarProductos(productos){
    this.lista.replaceChildren();this.contador.textContent=`${productos.length} ${productos.length===1?'equipo encontrado':'equipos encontrados'}`;this.mensaje.hidden=productos.length>0;
    productos.forEach(p=>this.lista.append(this.crearTarjeta(p)));this.actualizarIndicadoresFiltros();
  }
  imagen(src,alt,clase=''){
    const caja=this.crear('div',clase);
    if(src){const img=this.crear('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.onerror=()=>caja.replaceChildren(this.crear('span','imagen-vacia','Fotografía no disponible'));caja.append(img);}
    else caja.append(this.crear('span','imagen-vacia','Consulta fotografías del equipo'));
    return caja;
  }
  crearTarjeta(p){
    const tarjeta=this.crear('article','tarjeta-producto');const abrir=()=>this.mostrarDetalle(p,tarjeta.querySelector('.producto-nombre'));
    const imagen=this.boton('','producto-imagen',abrir);imagen.setAttribute('aria-label',`Ver detalles y fotos de ${p.nombre}`);imagen.append(this.imagen(p.imagen||p.imagenes?.[0],p.nombre,'imagen-interior'),this.crear('span','foto-indicacion','Ver fotos y detalles'));
    const contenido=this.crear('div','producto-contenido');const encabezado=this.crear('div','producto-identidad');
    encabezado.append(this.crear('span','producto-marca',p.marca));const h3=this.crear('h3');h3.append(this.boton(p.nombre,'producto-nombre',abrir));encabezado.append(h3);
    const categoria=[p.area||p.categoria,p.modelo].filter(Boolean).join(' · ');if(categoria)encabezado.append(this.crear('p','producto-categoria',categoria));
    contenido.append(encabezado);
    const etiquetas=this.crear('div','producto-etiquetas');const estado=disponibilidadProducto(p);
    etiquetas.append(this.crear('span','estado-equipo estado-'+estado.clave,estado.texto));if(p.oferta)etiquetas.append(this.crear('span','insignia-oferta','En oferta'));contenido.append(etiquetas);
    if(p.descripcion)contenido.append(this.crear('p','producto-descripcion',p.descripcion));
    const precio=precioProducto(p);contenido.append(this.crear('p','producto-precio',precio===null?'Precio a consultar':moneda(precio)),this.crear('p','producto-disponibilidad',estado.detalle));
    const acciones=this.crear('div','producto-acciones');const seleccionado=this.seleccion.has(p.id);
    acciones.append(this.boton('Solicitar información','boton boton-principal',()=>this.onSolicitud(p)));
    const agregar=this.boton(seleccionado?'✓ En mi cotización':'Agregar a cotización','boton boton-contorno',()=>{this.onSeleccion(p.id);});agregar.setAttribute('aria-pressed',String(seleccionado));acciones.append(agregar);contenido.append(acciones);
    if(this.soloLectura)acciones.replaceChildren(this.boton('Ver fotos y detalles','boton boton-contorno',abrir));
    tarjeta.append(imagen,contenido);return tarjeta;
  }
  mostrarDetalle(p,origen){
    const d=this.crear('dialog','detalle-dialogo');d.setAttribute('aria-label',`Detalles de ${p.nombre}`);
    const cerrar=()=>d.close();const cabecera=this.crear('div','detalle-cabecera');cabecera.append(this.crear('span','producto-marca',p.marca),this.boton('Cerrar','boton boton-neutral',cerrar));
    const grid=this.crear('div','detalle-grid'),galeria=this.crear('section','detalle-galeria'),info=this.crear('section','detalle-info');
    const fotos=[...new Set([p.imagen,...(p.imagenes||[])].filter(Boolean))];let actual=0;
    const marco=this.imagen(fotos[0],p.nombre,'detalle-marco');const miniaturas=this.crear('div','detalle-miniaturas');miniaturas.setAttribute('aria-label','Fotografías del equipo');
    const seleccionar=i=>{actual=i;const img=marco.querySelector('img');if(img){img.src=fotos[i];img.alt=`${p.nombre}, foto ${i+1}`;}else marco.replaceChildren(...this.imagen(fotos[i],p.nombre).childNodes);[...miniaturas.children].forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));};
    galeria.append(marco);
    if(fotos.length>1){fotos.forEach((foto,i)=>{const b=this.boton(`Foto ${i+1}`,'miniatura',()=>seleccionar(i));b.prepend(this.imagen(foto,'','miniatura-imagen'));b.setAttribute('aria-pressed',String(i===0));miniaturas.append(b);});galeria.append(miniaturas);}
    if(fotos.length)galeria.append(this.boton('Ampliar fotografía','enlace-texto',()=>{
      const a=this.crear('dialog','foto-ampliada');a.setAttribute('aria-label',`Fotografía ampliada de ${p.nombre}`);const cerrarFoto=this.boton('Cerrar fotografía','boton boton-neutral',()=>a.close());
      a.append(cerrarFoto,this.imagen(fotos[actual],p.nombre,'imagen-ampliada'));a.onclose=()=>a.remove();document.body.append(a);a.showModal();
    }));
    const estado=disponibilidadProducto(p),precio=precioProducto(p);
    info.append(this.crear('h2','',p.nombre));if(p.modelo)info.append(this.crear('p','producto-categoria',`Modelo: ${p.modelo}`));
    const etiquetas=this.crear('div','producto-etiquetas');etiquetas.append(this.crear('span','estado-equipo estado-'+estado.clave,estado.texto));if(p.oferta)etiquetas.append(this.crear('span','insignia-oferta','En oferta'));info.append(etiquetas);
    info.append(this.crear('p','detalle-precio',precio===null?'Precio a consultar':moneda(precio)),this.crear('p','',estado.detalle));
    if(p.preventa)info.append(this.crear('p','nota-preventa',contactoConfig.condicionesPreventa||'Consulta con FitGear el plazo de entrega, el anticipo y las condiciones de reserva antes de confirmar.'));
    const acciones=this.crear('div','detalle-acciones');acciones.append(this.boton('Solicitar información','boton boton-principal',()=>{cerrar();this.onSolicitud(p);}));
    const agregar=this.boton(this.seleccion.has(p.id)?'✓ En mi cotización':'Agregar a cotización','boton boton-contorno',()=>{this.onSeleccion(p.id);agregar.textContent=this.seleccion.has(p.id)?'✓ En mi cotización':'Agregar a cotización';agregar.setAttribute('aria-pressed',String(this.seleccion.has(p.id)));});agregar.setAttribute('aria-pressed',String(this.seleccion.has(p.id)));acciones.append(agregar);info.append(acciones);
    if(this.soloLectura)acciones.remove();
    if(p.descripcion){info.append(this.crear('h3','','Sobre este equipo'),this.crear('p','detalle-descripcion',p.descripcion));}
    const especificaciones=this.crear('dl','detalle-fichas');
    for(const [etiqueta,valor] of [['Área de entrenamiento',p.area],['Categoría',p.categoria],['Características',p.caracteristicas],['Grupo muscular',p.grupo_muscular||p.musculos],['Características técnicas',p.caracteristicas_tecnicas],['Dimensiones',p.dimensiones],['Peso',p.peso_kg==null?null:`${p.peso_kg} kg`],['Colores',p.color],['Materiales',p.materiales],['Capacidad de carga',p.capacidad_carga]]){
      if(valor===null||valor===undefined||valor==='')continue;const grupo=this.crear('div');grupo.append(this.crear('dt','',etiqueta),this.crear('dd','',valor));especificaciones.append(grupo);
    }
    if(especificaciones.children.length)info.append(this.crear('h3','','Especificaciones'),especificaciones);
    if(!this.soloLectura)info.append(this.crear('p','ayuda','Tu solicitud no reserva unidades. FitGear confirmará disponibilidad, precio y condiciones.'));
    grid.append(galeria,info);d.append(cabecera,grid);d.onclose=()=>{d.remove();if(origen?.isConnected)origen.focus();};document.body.append(d);d.showModal();
  }
}
