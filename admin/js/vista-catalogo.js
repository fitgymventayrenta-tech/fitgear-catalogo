import {CatalogoView} from '../../js/CatalogoView.js?v=22';
import {normalizarBusqueda} from '../../js/comercial.js?v=22';
const vista=new CatalogoView({soloLectura:true});let productos=[],modo='previa';
const lista=document.querySelector('#equipos-previa'),busqueda=document.querySelector('#buscar-previa');
function renderizar(){
 const texto=normalizarBusqueda(busqueda.value);
 const filas=productos.filter(p=>normalizarBusqueda([p.nombre,p.marca,p.categoria,p.modelo,p.area].join(' ')).includes(texto));
 lista.replaceChildren();document.querySelector('#resumen-previa').textContent=`${filas.length} máquinas${modo==='publicadas'?' publicadas':''} · Solo consulta`;
 for(const registro of filas){
  const p={...registro,imagen:registro.imagen_url||'',imagenes:Array.isArray(registro.imagenes)?registro.imagenes:[]};
  const bloque=vista.crear('div','equipo-previa');
  if(modo==='previa')bloque.append(vista.crear('p','marca-publicacion',p.publicado?'Publicada':'Sin publicar · Solo ADMIN'));
  bloque.append(vista.crearTarjeta(p));lista.append(bloque);
 }
 if(!filas.length)lista.append(vista.crear('p','estado-catalogo',productos.length?'No hay máquinas con esta búsqueda.':modo==='publicadas'?'Todavía no hay máquinas publicadas.':'Todavía no hay máquinas registradas.'));
}
busqueda.oninput=renderizar;
window.addEventListener('message',e=>{
 if(e.source!==parent||e.origin!==location.origin||e.data?.tipo!=='fitgear-vista-catalogo'||!Array.isArray(e.data.productos))return;
 productos=e.data.productos;modo=e.data.modo;renderizar();
});
if(parent!==window)parent.postMessage({tipo:'fitgear-vista-lista'},location.origin);
