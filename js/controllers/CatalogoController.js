
export class CatalogoController {
  constructor(modelo, vista) {
    this.modelo = modelo;
    this.vista = vista;
  }

  async iniciar() {
    this.vista.mostrarCargando();

    this.vista.escucharFiltros(() => {
      this.actualizarCatalogo();
    });

    try {
      await this.modelo.obtenerTodos();

      this.vista.configurarFiltros(
        this.modelo.obtenerMarcas(),
        this.modelo.obtenerCategorias()
      );

      this.actualizarCatalogo();
    } catch (error) {
      console.error("Error al cargar FitGear:", error);
      this.vista.mostrarError(error);
    }
  }

  actualizarCatalogo() {
    const filtros = this.vista.obtenerFiltros();
    const productos = this.modelo.filtrar(filtros);
    this.vista.mostrarProductos(productos);
  }
}
