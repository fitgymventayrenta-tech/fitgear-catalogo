export class AdminController {
  constructor(modelo, vista) {
    this.modelo = modelo;
    this.vista = vista;
    this.productos = [];
    this.guardando = false;
  }

  iniciar() {
    this.vista.mostrarPanel(false);
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
    this.vista.formProducto.addEventListener('submit', e => this.guardarProducto(e));
    document.querySelector('#nuevo-producto').addEventListener('click', () => {
      if (this.guardando) return;
      this.vista.nuevaMaquina();

    });
    document.querySelector('#editor-producto').addEventListener('cancel', e => {
      e.preventDefault();
      if (!this.guardando) this.vista.volverInventario();
    });
    document.querySelector('#cancelar-edicion').addEventListener('click', () => {
      if (!this.guardando) this.vista.volverInventario();
    });
    document.querySelector('#actualizar-solicitudes').addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      try { await this.cargarSolicitudes(); }
      catch (error) { this.vista.notificar(error.message, true); }
      finally { document.querySelector('#actualizar-solicitudes').disabled = false; }
    });
    this.vista.salir.addEventListener('click', () => {
      if (this.guardando) return;
      this.modelo.cerrarSesion();
      this.productos = [];
      this.vista.lista.replaceChildren();
      document.querySelector('#lista-solicitudes').replaceChildren();
      this.vista.limpiarFormulario();
      this.vista.mostrarPanel(false);
      this.vista.notificar('Sesión cerrada.');
    });
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
      this.modelo.validarProducto(datos);
      datos.publicado = true;
      datos.moneda = 'GTQ';
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
      await this.modelo.guardarProducto(datos);
      guardado = true;
      this.vista.limpiarFormulario();
      try {
        await this.cargarProductos();
        this.vista.notificar('Máquina guardada correctamente.');
      } catch (error) {
        this.vista.notificar('La máquina se guardó, pero no se pudo actualizar la lista: ' + error.message, true);
      }
    } catch (error) {
      // Una pérdida de red puede ocurrir DESPUÉS del commit remoto. En ese caso
      // conservar las fotos evita romper una ficha que sí llegó a guardarse.
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

  async cargarProductos() {
    this.productos = await this.modelo.obtenerProductos();
    this.vista.mostrarProductos(this.productos, p => this.vista.editar(p), p => this.eliminarProducto(p));
  }

  async eliminarProducto(producto) {
    if (this.guardando || !confirm(`¿Eliminar definitivamente "${producto.nombre}"?`)) return;
    try {
      await this.modelo.eliminarProducto(producto.id);
      if (String(this.vista.formProducto.elements.id.value) === String(producto.id)) this.vista.limpiarFormulario();
      await this.cargarProductos();
      this.vista.notificar('Máquina eliminada.');
    } catch (error) { this.vista.notificar(error.message, true); }
  }

  async cargarSolicitudes() {
    try {
      const solicitudes = await this.modelo.obtenerSolicitudes();
      this.vista.mostrarSolicitudes(solicitudes, async (solicitud, estado) => {
        try {
          await this.modelo.actualizarSolicitud(solicitud.id, estado);
          solicitud.estado = estado;
          this.vista.resumirSolicitudes(solicitudes);
          this.vista.notificar('Seguimiento actualizado.');
        } catch (error) {
          this.vista.notificar(error.message, true);
          throw error;
        }
      });
    } catch (error) {
      this.vista.resumirSolicitudes(null);
      document.querySelector('#lista-solicitudes').textContent = 'No fue posible cargar las solicitudes. Revisa la migración de Supabase y usa «Actualizar solicitudes».';
      throw error;
    }
  }
}
