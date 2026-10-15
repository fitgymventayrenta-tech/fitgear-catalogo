
export class CatalogoView {
  constructor() {
    this.contenedor = document.getElementById("lista-productos");
    this.contador = document.getElementById("contador-productos");
    this.mensajeVacio = document.getElementById("mensaje-vacio");

    this.buscarInput = document.getElementById("buscar-producto");
    this.marcaSelect = document.getElementById("filtro-marca");
    this.categoriaSelect =
      document.getElementById("filtro-categoria");
  }

  crearElemento(etiqueta, clase, texto = "") {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    elemento.textContent = texto;
    return elemento;
  }

  cargarOpciones(select, valores) {
    valores.forEach(valor => {
      const opcion = document.createElement("option");
      opcion.value = valor;
      opcion.textContent = valor;
      select.appendChild(opcion);
    });
  }

  configurarFiltros(marcas, categorias) {
    this.cargarOpciones(this.marcaSelect, marcas);
    this.cargarOpciones(this.categoriaSelect, categorias);
  }

  crearTarjeta(producto) {
    const tarjeta = this.crearElemento("article", "producto-card");

    const imagenContenedor =
      this.crearElemento("div", "producto-imagen");

    if (producto.imagen) {
      const imagen = document.createElement("img");
      imagen.src = producto.imagen;
      imagen.alt = producto.nombre;
      imagen.loading = "lazy";
      imagenContenedor.appendChild(imagen);
    } else {
      const placeholder = this.crearElemento(
        "span",
        "producto-sin-imagen",
        "Fotografía próximamente"
      );
      imagenContenedor.appendChild(placeholder);
    }

    const contenido =
      this.crearElemento("div", "producto-contenido");

    const marca = this.crearElemento(
      "span", "producto-marca", producto.marca
    );

    const titulo = this.crearElemento(
      "h3", "", producto.nombre
    );

    const descripcion = this.crearElemento(
      "p", "producto-descripcion", producto.descripcion
    );

    const detalles =
      this.crearElemento("div", "producto-detalles");

    const categoria = this.crearElemento(
      "span", "producto-categoria", producto.categoria
    );

    const estado = this.crearElemento(
      "span", "estado estado-preventa", producto.estado
    );

    detalles.append(categoria, estado);

    const enlace = this.crearElemento(
      "a", "producto-accion", "Consultar equipo"
    );

    const asunto = `Consulta sobre ${producto.nombre}`;
    enlace.href =
      `mailto:ventas@ejemplo.com?subject=${encodeURIComponent(asunto)}`;

    contenido.append(
      marca,
      titulo,
      descripcion,
      detalles,
      enlace
    );

    tarjeta.append(imagenContenedor, contenido);

    return tarjeta;
  }

  mostrarProductos(productos) {
    this.contenedor.replaceChildren();

    productos.forEach(producto => {
      this.contenedor.appendChild(this.crearTarjeta(producto));
    });

    this.contador.textContent =
      `${productos.length} equipo(s) encontrado(s)`;

    this.mensajeVacio.hidden = productos.length !== 0;
  }

  obtenerFiltros() {
    return {
      busqueda: this.buscarInput.value,
      marca: this.marcaSelect.value,
      categoria: this.categoriaSelect.value
    };
  }

  escucharFiltros(callback) {
    this.buscarInput.addEventListener("input", callback);
    this.marcaSelect.addEventListener("change", callback);
    this.categoriaSelect.addEventListener("change", callback);
  }
}
