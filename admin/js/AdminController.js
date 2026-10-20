export class AdminController {
  constructor(modelo, vista) {
    this.modelo = modelo;
    this.vista = vista;
    this.productos = [];
    this.guardando = false;
  }

  iniciar() {
    this.vista.mostrarPanel(false);
    this.vista.configurarComercial();
    this.vista.onComercial=(accion,datos)=>this.accionComercial(accion,datos);
    document.querySelectorAll('[data-seccion]').forEach(b => {
      b.addEventListener('click', () => this.vista.mostrarSeccion(b.dataset.seccion));
    });
    this.vista.onAbrirProducto = async id => {
      try {
        await this.cargarProductos();
        const producto = this.productos.find(p => String(p.id) === String(id));
        if (!producto) throw new Error('La máquina ya no existe en el catálogo.');
        this.vista.mostrarSeccion('catalogo');
        this.vista.editar(producto);
      } catch (error) { this.vista.notificar(error.message, true); }
    };
    this.vista.formLogin.addEventListener('submit', e => this.iniciarSesion(e));
    this.vista.formProducto.elements.imagen.addEventListener('change', () => {
      try {
        for (const archivo of this.vista.formProducto.elements.imagen.files) {
          this.modelo.validarImagen(archivo);
        }
        this.vista.previsualizarArchivo();
      } catch (error) {
        this.vista.formProducto.elements.imagen.value = '';
        this.vista.notificar(error.message, true);
      }
    });
    this.vista.formProducto.elements.existencias.addEventListener('input',()=>this.vista.sincronizarInventario());
    this.vista.formProducto.addEventListener('submit', e => this.guardarProducto(e));
    document.querySelector('#nuevo-producto').addEventListener('click', () => {
      if (this.guardando) return;
      this.vista.nuevaMaquina();

    });
    document.querySelector('#editor-producto').addEventListener('cancel', e => {
      e.preventDefault();
      if (!this.guardando) this.vista.volverInventario();
    });
    document.querySelector('#cerrar-editor').addEventListener('click',()=>{if(!this.guardando)this.vista.volverInventario();});
    document.querySelector('#cancelar-edicion').addEventListener('click', () => {
      if (!this.guardando) this.vista.volverInventario();
    });
    document.querySelector('#actualizar-solicitudes').addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      try { await this.cargarSolicitudes(); }
      catch (error) { this.vista.notificar(error.message, true); }
      finally { document.querySelector('#actualizar-solicitudes').disabled = false; }
    });
    this.modelo.onSesionCerrada=()=>this.limpiarAcceso();
    this.vista.salir.addEventListener('click', async () => {
      if(this.guardando)return;
      try{await this.modelo.cerrarSesionRemota();this.vista.notificar('Sesión cerrada.');}
      catch(error){this.vista.notificar(error.message,true);}
    });
  }

  limpiarAcceso(){
    this.vista.comercial=null;this.vista.productos=[];this.productos=[];
    document.querySelectorAll('[data-comercial-dialogo]').forEach(d=>d.remove());
    for(const id of ['lista-clientes','lista-oportunidades','lista-seguimientos','lista-cotizaciones','lista-ventas','lista-solicitudes'])document.querySelector('#'+id).replaceChildren();
    this.vista.lista.replaceChildren();this.vista.limpiarFormulario();
    this.vista.vistaCatalogo='inventario';this.vista.actualizarVistaCatalogo();
    // Quitar el documento del iframe elimina también sus datos y galerías privadas.
    const frame=document.querySelector('#vista-cliente-catalogo');frame.replaceWith(frame.cloneNode(false));
    this.vista.formLogin.reset();this.vista.mostrarPanel(false);
    this.vista.notificar('Sesión cerrada o expirada. Inicia sesión para continuar.');
  }

  async iniciarSesion(e) {
    e.preventDefault();
    const boton = this.vista.formLogin.querySelector('[type=submit]');
    boton.disabled = true;
    this.vista.notificar('Verificando acceso...');
    try {
      await this.modelo.iniciarSesion(document.querySelector('#email').value, document.querySelector('#password').value);
      this.vista.formLogin.reset();
      this.vista.mostrarPanel(true);
      const resultados = await Promise.allSettled([this.cargarProductos(), this.cargarSolicitudes()]);
      if(!this.modelo.token)return;
      const errores = resultados.filter(r => r.status === 'rejected');
      this.vista.notificar(errores.length ? errores.map(r => r.reason.message).join(' ') : 'Sesión ADMIN iniciada.', errores.length > 0);
    } catch (error) {
      this.vista.notificar(error.message, true);
      if (!this.modelo.token) this.vista.mostrarPanel(false);
    } finally { boton.disabled = false; }
  }

  async guardarProducto(e) {
    e.preventDefault();
    if (this.guardando) return;
    const { fotos, ...datos } = this.vista.leerFormulario();
    const subidas = [];
    let guardado = false;
    let intentoGuardar = false;
    try {
      datos.publicado = e.submitter?.value !== 'borrador';
      this.modelo.validarProducto(datos);
      datos.moneda = 'GTQ';
      const anterior=this.productos.find(p=>String(p.id)===String(datos.id));
      if(anterior?.preventa)datos.precio_especial=datos.precio;
      this.guardando = true;
      // Impide alterar fotos o cambiar de máquina durante una subida.
      const controles = [...this.vista.panel.querySelectorAll('button,input,select,textarea')];
      this.controlesPrevios = controles.map(control => [control, control.disabled]);
      controles.forEach(control => { control.disabled = true; });
      this.vista.notificar('Guardando máquina y fotografías...');
      for (const foto of fotos) if (foto.archivo) await this.modelo.validarContenidoImagen(foto.archivo);
      const urls = [];
      for (const foto of fotos) {
        const url = foto.archivo ? await this.modelo.subirImagen(foto.archivo) : foto.url;
        if (foto.archivo) subidas.push(url);
        urls.push(url);
      }
      datos.imagen_url = urls[0] || null;
      datos.imagenes = urls;
      intentoGuardar = true;
      const registros=await this.modelo.guardarProducto(datos);
      guardado = true;
      const idGuardado=registros?.[0]?.id||datos.id;
      let problemaPublicacion=null;
      if(datos.publicado&&idGuardado&&this.modelo.comprobarPublicacion){try{await this.modelo.comprobarPublicacion(idGuardado);}catch(error){problemaPublicacion=error.message;}}
      this.notificarCambioCatalogo();
      this.vista.limpiarFormulario();
      try {
        await this.cargarProductos();
        if(problemaPublicacion)this.vista.notificar('Los cambios se guardaron en ADMIN, pero no se pudo confirmar su lectura pública: '+problemaPublicacion,true);
        else this.vista.notificar(datos.publicado?'Máquina guardada y publicada. Los cambios ya están disponibles en el catálogo.':'Máquina guardada sin publicar. Solo está visible en ADMIN.');
      } catch (error) {
        this.vista.notificar('La máquina se guardó, pero no se pudo actualizar la lista: ' + error.message, true);
      }
    } catch (error) {
      // Una pérdida de red puede ocurrir DESPUÉS del commit remoto. En ese caso
      // conservar las fotos evita romper una ficha que sí llegó a guardarse.
      if(error.datosGuardados)guardado=true;
      if (!guardado && (!intentoGuardar || error.respuestaHttp)) {
        await Promise.allSettled(subidas.map(url => this.modelo.eliminarImagen(url)));
      }
      this.vista.notificar(error.message, true);
    } finally {
      for (const [control, disabled] of this.controlesPrevios || []) control.disabled = disabled;
      this.controlesPrevios = [];
      this.guardando = false;
    }
  }

  notificarCambioCatalogo(){
    if(typeof window==='undefined')return;
    try{localStorage.setItem('fitgear.catalogo.actualizado',String(Date.now()));}catch{}
  }

  async cargarProductos() {
    const token=this.modelo.token,productos=await this.modelo.obtenerProductos();
    if(!token||token!==this.modelo.token)return;
    this.productos=productos;
    this.vista.mostrarProductos(this.productos, p => this.vista.editar(p), p => this.eliminarProducto(p));
  }

  async eliminarProducto(producto) {
    if (this.guardando || !confirm(`¿Eliminar definitivamente "${producto.nombre}"?`)) return;
    try {
      await this.modelo.eliminarProducto(producto.id);
      this.notificarCambioCatalogo();
      if (String(this.vista.formProducto.elements.id.value) === String(producto.id)) this.vista.limpiarFormulario();
      await this.cargarProductos();
      this.vista.notificar('Máquina eliminada.');
    } catch (error) { this.vista.notificar(error.message, true); }
  }

  async cargarSolicitudes() {
    const token=this.modelo.token;
    try {
      const datos=await this.modelo.obtenerComercial();
      if(!token||token!==this.modelo.token)return;
      this.vista.mostrarComercial(datos);
    } catch (error) {
      if(!token||token!==this.modelo.token)return;
      this.vista.resumirSolicitudes(null);
      for(const id of ['lista-clientes','lista-solicitudes','lista-oportunidades','lista-seguimientos','lista-cotizaciones','lista-ventas'])document.querySelector('#'+id).textContent='No fue posible cargar el módulo comercial. Aplica migracion_modulo_clientes.sql en Supabase y pulsa «Actualizar datos».';
      throw error;
    }
  }

  async accionComercial(accion,datos) {
    switch(accion){
      case 'cliente': await this.modelo.guardarCliente(datos);break;
      case 'solicitud': await this.modelo.actualizarSolicitud(datos.id,datos.campos);break;
      case 'solicitud-interna': await this.modelo.accionComercial('registrar_solicitud_interna',{p_cliente:datos.cliente_id,p_datos:datos.solicitud});break;
      case 'seguimiento': await this.modelo.accionComercial('guardar_seguimiento',{p_datos:datos});break;
      case 'completar': await this.modelo.accionComercial('completar_seguimiento',{p_id:datos.id});break;
      case 'cotizacion': await this.modelo.accionComercial('guardar_cotizacion',{p_datos:datos});break;
      case 'estado-cotizacion': await this.modelo.accionComercial('cambiar_cotizacion',{p_id:datos.id,p_estado:datos.estado});break;
      case 'pedido': await this.modelo.accionComercial('confirmar_venta',{p_cotizacion:datos.cotizacion,p_anticipo:datos.anticipo});break;
      case 'pago': await this.modelo.accionComercial('registrar_pago',{p_venta:datos.venta,p_monto:datos.monto,p_medio:datos.medio,p_referencia:datos.referencia});break;
      case 'entrega': await this.modelo.actualizarEntrega(datos.id,datos.estado);break;
      default:throw new Error('Acción comercial desconocida.');
    }
    if(accion==='pedido')this.notificarCambioCatalogo();
    const resultados=await Promise.allSettled([this.cargarSolicitudes(),...(accion==='pedido'?[this.cargarProductos()]:[])]);
    const errores=resultados.filter(r=>r.status==='rejected');
    this.vista.notificar(errores.length?'La operación se guardó. No se pudo actualizar la vista; pulsa «Actualizar datos».':'Información guardada correctamente.',errores.length>0);
  }
}
