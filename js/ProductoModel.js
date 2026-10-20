import { validarSolicitudComercial, normalizarBusqueda, textoBusquedaProducto, precioProducto, disponibilidadProducto } from "./comercial.js?v=23";

import { supabaseConfig } from "./supabase.js?v=23";

export class ProductoModel {
  constructor() {
    this.productos = [];
  }

  async obtenerTodos() {
    const { url, key } = supabaseConfig;

    if (
      !url.startsWith("https://") ||
      !key ||
      key.includes("PEGA_AQUI")
    ) {
      throw new Error(
        "Configura la URL y la Publishable key de Supabase."
      );
    }

    const endpoint =
      `${url}/rest/v1/productos` +
      "?select=*" +
      "&publicado=eq.true" +
      "&order=creado_en.desc";

    const registros=[];
    for(let offset=0;;offset+=1000){
      const respuesta=await fetch(`${endpoint},id.desc&limit=1000&offset=${offset}`,{cache:'no-store',headers:{apikey:key,Accept:'application/json'}});
      if(!respuesta.ok)throw new Error('No pudimos cargar los equipos. Intenta de nuevo en unos momentos.');
      const pagina=await respuesta.json();registros.push(...pagina);if(pagina.length<1000)break;
    }

    this.productos = registros.map((producto) => ({
      ...producto,
      id: producto.id,
      nombre: producto.nombre ?? "",
      marca: producto.marca ?? "",
      categoria: producto.categoria ?? "",
      descripcion: producto.descripcion ?? "",
      precio: producto.precio,
      moneda: "GTQ",
      existencias: producto.existencias ?? 0,
      color: producto.color ?? "",
      peso_kg: producto.peso_kg,
      dimensiones: producto.dimensiones ?? "",
      imagen: producto.imagen_url ?? "",
      estado: Number(producto.existencias) <= 0 ? "vendida" : producto.estado ?? "vendida",
      oferta: Boolean(producto.oferta),
      preventa: Boolean(producto.preventa),
      imagenes: Array.isArray(producto.imagenes) ? producto.imagenes : []
    }));

    return [...this.productos];
  }

  async enviarSolicitud(datos) {
    validarSolicitudComercial(datos,this.productos);
    const {url,key}=supabaseConfig;
    const respuesta=await fetch(`${url}/rest/v1/rpc/registrar_solicitud_comercial`,{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({p_datos:datos})
    });
    if(!respuesta.ok){
      let msg='No pudimos recibir tu solicitud en este momento. Conservamos el formulario para que puedas volver a intentarlo.';
      try{const err=await respuesta.json();if(err.code==='P0001')msg=err.message;}catch{}
      throw new Error(msg);
    }
    const id=await respuesta.json();if(!id)throw new Error('El servidor no confirmó el registro.');return id;
  }

  obtenerMarcas() {
    return [...new Set(
      this.productos.map(p => p.marca).filter(Boolean)
    )].sort();
  }

  obtenerCategorias() {
    return [...new Set(
      this.productos.map(p => p.categoria).filter(Boolean)
    )].sort();
  }

  filtrar({busqueda='',marca='',categoria='',disponibilidad='',comercial='',precioMinimo='',precioMaximo='',orden='disponibilidad'}={}) {
    const palabras=normalizarBusqueda(busqueda).split(' ').filter(Boolean);
    const tieneMin=precioMinimo!==''&&precioMinimo!=null,tieneMax=precioMaximo!==''&&precioMaximo!=null;
    const resultado=this.productos.filter(p=>{
      const contenido=textoBusquedaProducto(p),precio=precioProducto(p),estado=disponibilidadProducto(p).clave;
      return palabras.every(palabra=>contenido.includes(palabra))&&(!marca||p.marca===marca)&&(!categoria||p.categoria===categoria)&&
        (!disponibilidad||estado===disponibilidad)&&(!comercial||(comercial==='preventa'?p.preventa:p.oferta))&&
        (!tieneMin||(precio!==null&&precio>=Number(precioMinimo)))&&(!tieneMax||(precio!==null&&precio<=Number(precioMaximo)));
    });
    const prioridad=p=>({disponible:0,preventa:1,reservada:2,vendida:3}[disponibilidadProducto(p).clave]??4);
    return resultado.sort((a,b)=>{
      if(orden==='nombre')return a.nombre.localeCompare(b.nombre,'es');
      if(orden==='precio-asc'||orden==='precio-desc'){
        const pa=precioProducto(a),pb=precioProducto(b);
        if(pa===null)return pb===null?0:1;if(pb===null)return -1;
        return orden==='precio-asc'?pa-pb:pb-pa;
      }
      return prioridad(a)-prioridad(b);
    });
  }
}
