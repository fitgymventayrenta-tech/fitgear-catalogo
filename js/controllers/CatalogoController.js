
export class CatalogoController {
  constructor(modelo, vista) {
    this.modelo = modelo;
    this.vista = vista;
  }

  iniciar() {
    const marcas = this.modelo.obtenerMarcas();
    const categorias = this.modelo.obtenerCategorias();

    this.vista.configurarFiltros(marcas, categorias);

    this.vista.mostrarProductos(
      this.modelo.obtenerTodos()
    );

    this.vista.escucharFiltros(() => {
      this.actualizarCatalogo();
    });
  }

  actualizarCatalogo() {
    const filtros = this.vista.obtenerFiltros();

    const productosFiltrados =
      this.modelo.filtrar(filtros);

    this.vista.mostrarProductos(productosFiltrados);
  }
}
