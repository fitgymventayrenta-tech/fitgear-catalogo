
import { supabaseConfig } from "../../../js/config/supabase.js?v=18";

export class AdminModel {
  constructor() {
    this.url = String(supabaseConfig.url || "")
      .trim()
      .replace(/\/+$/, "");

    this.key = String(supabaseConfig.key || "").trim();

    this.token = null;
    this.expira = 0;

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(this.url)) {
      throw new Error(
        "La Project URL de Supabase es incorrecta. " +
        "Revisa js/config/supabase.js."
      );
    }

    if (!this.key.startsWith("sb_publishable_") &&
        !this.key.startsWith("eyJ")) {
      throw new Error(
        "La Publishable key de Supabase no es válida."
      );
    }
  }

  async solicitar(ruta, opciones = {}, autenticado = true) {
    if (autenticado && !this.token) {
      throw new Error("Debes iniciar sesión.");
    }

    const headers = {
      apikey: this.key,
      Accept: "application/json",
      ...(opciones.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(autenticado
        ? { Authorization: `Bearer ${this.token}` }
        : {}),
      ...opciones.headers
    };

    if(!ruta.startsWith('/')||ruta.startsWith('//')||ruta.includes(String.fromCharCode(92))||/[\r\n]/.test(ruta)||ruta.split('?')[0].split('/').includes('..'))throw new Error('Ruta de solicitud inválida.');
    const urlCompleta = `${this.url}${ruta}`;

    const respuesta = await fetch(urlCompleta, {
      ...opciones,
      cache: "no-store",
      headers
    });

    if (!respuesta.ok) {
      let detalle = `Error HTTP ${respuesta.status}`;

      try {
        const datos = await respuesta.json();
        detalle =
          datos.msg ||
          datos.message ||
          datos.error_description ||
          datos.error ||
          detalle;
      } catch {}

      if (respuesta.status === 401 && autenticado) {
        this.cerrarSesion();
      }

      const error = new Error(detalle);
      error.respuestaHttp = respuesta.status;
      throw error;
    }

    if (respuesta.status === 204) return null;

    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;
  }

  async iniciarSesion(email, password) {
    let datos;
    try{datos = await this.solicitar(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      },
      false
    );

    }catch(error){throw new Error(error.respuestaHttp===429?'Demasiados intentos. Espera antes de volver a iniciar sesión.':'No se pudo iniciar sesión. Revisa tus credenciales o inténtalo más tarde.');}
    if (!datos.access_token) {
      throw new Error(
        "Supabase no devolvió un token de acceso."
      );
    }

    this.token = datos.access_token;

    this.expira = Date.now() +
      (datos.expires_in || 3600) * 1000;

    try {
      const autorizado = await this.esAdministrador();

      if (!autorizado) {
        throw new Error(
          "Esta cuenta no tiene permisos ADMIN."
        );
      }
    } catch (error) {
      this.cerrarSesion();
      throw error;
    }

    clearTimeout(this.temporizadorSesion);
    this.temporizadorSesion=setTimeout(()=>this.cerrarSesion(),Math.max(0,this.expira-Date.now()));
    this.temporizadorSesion.unref?.();
    return true;
  }

  async esAdministrador() {
    const resultado = await this.solicitar(
      "/rest/v1/rpc/es_admin",
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );

    return resultado === true;
  }

  comprobarSesion() {
    if (!this.token || Date.now() >= this.expira) {
      this.cerrarSesion();
      throw new Error(
        "La sesión ha expirado. Inicia sesión otra vez."
      );
    }
  }

  async obtenerProductos() {
    this.comprobarSesion();

    return await this.obtenerColeccion(
      "/rest/v1/productos?select=*&order=id.desc"
    );
  }

  async guardarProducto(producto) {
    this.comprobarSesion();

    this.validarProducto(producto);
    const { id, ...datos } = producto;

    if (id) {
      const resultado = await this.solicitar(
        `/rest/v1/productos?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(datos)
        }
      );
      if (!resultado?.length) throw new Error("La máquina no existe o no tienes permiso para editarla.");
      this.confirmarGuardado(resultado[0],datos);
      return resultado;
    }

    const resultado = await this.solicitar('/rest/v1/productos', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(datos)
    });
    if (!resultado?.length) throw new Error('No se pudo confirmar el registro de la máquina.');
    this.confirmarGuardado(resultado[0],datos);
    return resultado;
  }

  confirmarGuardado(registro,datos){
    const numeros=['precio','precio_especial','existencias'];
    for(const campo of ['nombre','marca','categoria','descripcion','precio','precio_especial','existencias','estado','oferta','publicado','imagen_url','imagenes']){
      if(!(campo in datos))continue;
      let esperado=datos[campo],actual=registro[campo];
      if(numeros.includes(campo)){esperado=esperado==null?null:Number(esperado);actual=actual==null?null:Number(actual);}
      else if(['categoria','descripcion','imagen_url'].includes(campo)){esperado=esperado??'';actual=actual??'';}
      if(JSON.stringify(esperado)!==JSON.stringify(actual)){
        const error=new Error(`El servidor no conservó el cambio en «${campo}». No se confirmó el guardado; revisa ese dato antes de cerrar la edición.`);
        error.datosGuardados=true;throw error;
      }
    }
  }

  async comprobarPublicacion(id) {
    const filas=await this.solicitar(`/rest/v1/productos?id=eq.${encodeURIComponent(id)}&publicado=eq.true&select=id,nombre,precio,existencias,imagen_url`,{},false);
    if(!filas?.length)throw new Error('El catálogo público aún no puede leer esta máquina. Revisa su publicación y los permisos de lectura.');
    return filas[0];
  }

  async eliminarProducto(id) {
    this.comprobarSesion();
    const resultado = await this.solicitar(`/rest/v1/productos?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { Prefer: 'return=representation' }
    });
    if (!resultado?.length) throw new Error('La máquina no existe o no tienes permiso para eliminarla.');
    return resultado;
  }

  validarProducto(producto) {
    if (!producto.nombre?.trim() || producto.nombre.length > 160 ||
        !producto.marca?.trim() || producto.marca.length > 100 ||
        typeof producto.descripcion !== 'string' || producto.descripcion.length > 5000 ||
        !Number.isSafeInteger(producto.existencias) || producto.existencias < 0 ||
        (producto.precio!==null&&(!Number.isFinite(producto.precio)||producto.precio<0||producto.precio>9999999999)) ||
        !['disponible','reservada','vendida'].includes(producto.estado)) {
      throw new Error('Revisa el nombre, marca, descripción, precio, existencias y estado de la máquina.');
    }
    if (producto.existencias === 0) producto.estado = 'vendida';
    if (producto.existencias > 0 && producto.estado === 'vendida') {
      throw new Error('Para marcar toda la máquina como vendida, establece las existencias en cero. Si vendiste una unidad, reduce las existencias y conserva disponible si quedan unidades.');
    }
  }

  async validarContenidoImagen(archivo) {
    this.validarImagen(archivo);
    const b = new Uint8Array(await archivo.slice(0, 32).arrayBuffer());
    const texto = (inicio, fin) => String.fromCharCode(...b.slice(inicio, fin));
    const valido = {
      'image/jpeg': b[0] === 255 && b[1] === 216 && b[2] === 255,
      'image/png': b[0] === 137 && texto(1, 4) === 'PNG' && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10,
      'image/webp': texto(0, 4) === 'RIFF' && texto(8, 12) === 'WEBP',
      'image/gif': ['GIF87a','GIF89a'].includes(texto(0, 6)),
      'image/avif': texto(4, 8) === 'ftyp' && /avif|avis/.test(texto(8, 32))
    }[archivo.type];
    if (!valido) throw new Error('El contenido del archivo no coincide con el formato de imagen indicado.');
  }

  validarImagen(archivo) {
    const tipos=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
    if(!tipos.includes(archivo.type))throw new Error('Formato de imagen no permitido.');
    if(!archivo.size||archivo.size>5*1024*1024)throw new Error('La imagen debe pesar menos de 5 MB.');
  }

  async subirImagen(archivo) {
    this.comprobarSesion();await this.validarContenidoImagen(archivo);
    const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'})[archivo.type];
    const ruta=`${crypto.randomUUID()}.${extension}`;
    const respuesta=await fetch(`${this.url}/storage/v1/object/maquinas/${ruta}`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${this.token}`,'Content-Type':archivo.type,'x-upsert':'false'},body:archivo});
    if(!respuesta.ok){let error='No se pudo subir la imagen.';try{const data=await respuesta.json();error=data.message||data.error||error;}catch{}throw new Error(error);}
    return `${this.url}/storage/v1/object/public/maquinas/${ruta}`;
  }

  async eliminarImagen(url) {
    this.comprobarSesion();
    const prefijo=`${this.url}/storage/v1/object/public/maquinas/`;
    if(!url.startsWith(prefijo))return;
    const ruta=url.slice(prefijo.length);
    if(!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif|avif)$/.test(ruta))throw new Error('Ruta de imagen inválida.');
    const respuesta=await fetch(`${this.url}/storage/v1/object/maquinas/${ruta}`,{method:'DELETE',headers:{apikey:this.key,Authorization:`Bearer ${this.token}`}});
    if(!respuesta.ok)throw new Error('No se pudo eliminar la imagen sin utilizar.');
  }

  async obtenerColeccion(ruta) {
    this.comprobarSesion();
    const filas=[];
    for(let offset=0;;offset+=1000){
      const pagina=await this.solicitar(`${ruta}${ruta.includes('?')?'&':'?'}limit=1000&offset=${offset}`);
      filas.push(...pagina);if(pagina.length<1000)return filas;
    }
  }

  async obtenerComercial() {
    const nombres=['clientes','solicitudes','seguimientos','cotizaciones','ventas','pagos'];
    const valores=await Promise.all(nombres.map(nombre=>this.obtenerColeccion(`/rest/v1/${nombre}?select=${nombre==='solicitudes'?'*,solicitud_productos(*)':'*'}&order=id.desc`)));
    const datos=Object.fromEntries(nombres.map((nombre,i)=>[nombre,valores[i]]));
    try{datos.clientes_fuentes=await this.obtenerColeccion('/rest/v1/clientes_fuentes?select=*&order=pagina.asc,fila.asc');}
    catch(error){if(![400,404].includes(error.respuestaHttp))throw error;datos.clientes_fuentes=[];}
    return datos;
  }

  async guardarCliente(datos) {
    this.comprobarSesion();
    const {id,...campos}=datos;
    try {
      const filas=await this.solicitar(`/rest/v1/clientes${id?'?id=eq.'+encodeURIComponent(id):''}`,{
        method:id?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(campos)
      });
      if(!filas?.length)throw new Error('No se pudo guardar el cliente.');return filas[0];
    } catch(error) {
      if(error.respuestaHttp===409)throw new Error('Ya existe una ficha con ese teléfono. Búscala en el Directorio.');
      throw error;
    }
  }

  async actualizarSolicitud(id,campos) {
    this.comprobarSesion();
    const permitidos={};
    for(const nombre of ['estado_comercial','asesor'])if(nombre in campos)permitidos[nombre]=campos[nombre];
    const filas=await this.solicitar(`/rest/v1/solicitudes?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(permitidos)
    });
    if(!filas?.length)throw new Error('La solicitud no existe o no tienes permiso para actualizarla.');return filas[0];
  }

  async accionComercial(nombre,datos) {
    this.comprobarSesion();
    if(!['registrar_solicitud_interna','guardar_seguimiento','completar_seguimiento','guardar_cotizacion','cambiar_cotizacion','confirmar_venta','registrar_pago'].includes(nombre))throw new Error('Acción inválida.');
    return await this.solicitar(`/rest/v1/rpc/${nombre}`,{method:'POST',body:JSON.stringify(datos)});
  }

  async actualizarEntrega(id,estado_entrega) {
    this.comprobarSesion();
    const filas=await this.solicitar(`/rest/v1/ventas?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({estado_entrega})
    });
    if(!filas?.length)throw new Error('No se pudo actualizar la entrega.');
  }

  async cerrarSesionRemota(){
    const token=this.token;this.cerrarSesion();
    if(!token)return;
    const respuesta=await fetch(`${this.url}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${token}`}});
    if(!respuesta.ok&&respuesta.status!==401)throw new Error('Sesión local cerrada. No se pudo confirmar la revocación remota; vuelve a intentarlo desde Supabase si es necesario.');
  }
  cerrarSesion() {
    const activa=Boolean(this.token);clearTimeout(this.temporizadorSesion);
    this.token = null;this.expira = 0;
    if(activa)this.onSesionCerrada?.();
  }
}
