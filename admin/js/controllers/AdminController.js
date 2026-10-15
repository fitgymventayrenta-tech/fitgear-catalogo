
export class AdminController {
  constructor(modelo, vista) {
    this.modelo = modelo;
    this.vista = vista;
    this.productos = [];
  }

  iniciar() {
    this.vista.mostrarPanel(false);

    this.vista.formLogin.addEventListener(
      "submit",
      async evento => {
        evento.preventDefault();

        const email = document.querySelector("#email").value;
        const password = document.querySelector("#password").value;

        this.vista.notificar("Verificando acceso...");

        try {
          await this.modelo.iniciarSesion(email, password);
          this.vista.formLogin.reset();
          this.vista.mostrarPanel(true);
          await this.cargarProductos();
          this.vista.notificar("Sesión ADMIN iniciada.");
        } catch (error) {
          this.vista.mostrarPanel(false);
          this.vista.notificar(error.message, true);
        }
      }
    );

    this.vista.formProducto.addEventListener(
      "submit",
      async evento => {
        evento.preventDefault();

        const producto = this.vista.leerFormulario();

        if (!producto.nombre || !producto.marca ||
            !producto.area || !producto.categoria) {
          this.vista.notificar(
            "Completa los campos obligatorios.",
            true
          );
          return;
        }

        this.vista.guardar.disabled = true;

        try {
          await this.modelo.guardarProducto(producto);
          this.vista.limpiarFormulario();
          await this.cargarProductos();
          this.vista.notificar("Máquina guardada correctamente.");
        } catch (error) {
          this.vista.notificar(error.message, true);
        } finally {
          this.vista.guardar.disabled = false;
        }
      }
    );

    document.querySelector("#nuevo-producto")
      .addEventListener("click", () => {
        this.vista.limpiarFormulario();
        this.vista.formProducto.scrollIntoView({
          behavior: "smooth"
        });
      });

    document.querySelector("#cancelar-edicion")
      .addEventListener("click", () => {
        this.vista.limpiarFormulario();
      });

    this.vista.salir.addEventListener("click", () => {
      this.modelo.cerrarSesion();
      this.productos = [];
      this.vista.lista.replaceChildren();
      this.vista.limpiarFormulario();
      this.vista.mostrarPanel(false);
      this.vista.notificar("Sesión cerrada.");
    });
  }

  async cargarProductos() {
    this.productos = await this.modelo.obtenerProductos();

    this.vista.mostrarProductos(
      this.productos,
      producto => this.vista.editar(producto),
      producto => this.eliminarProducto(producto)
    );
  }

  async eliminarProducto(producto) {
    const confirmar = window.confirm(
      `¿Eliminar definitivamente "${producto.nombre}"?`
    );

    if (!confirmar) return;

    try {
      await this.modelo.eliminarProducto(producto.id);
      await this.cargarProductos();
      this.vista.notificar("Máquina eliminada.");
    } catch (error) {
      this.vista.notificar(error.message, true);
    }
  }
}
