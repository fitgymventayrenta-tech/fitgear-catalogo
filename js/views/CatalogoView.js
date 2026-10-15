
export class CatalogoView {
  constructor() {
    this.lista = document.querySelector("#lista-productos");
    this.contador = document.querySelector("#contador-productos");
    this.mensaje = document.querySelector("#mensaje-vacio");
    this.busqueda = document.querySelector("#buscar-producto");
    this.marca = document.querySelector("#filtro-marca");
    this.categoria = document.querySelector("#filtro-categoria");
  }

  configurarFiltros(marcas, categorias) {
    this.llenarSelect(this.marca, marcas, "Todas las marcas");
    this.llenarSelect(
      this.categoria,
      categorias,
      "Todas las categorías"
    );
  }

  llenarSelect(elemento, valores, etiqueta) {
    if (!elemento) return;

    elemento.replaceChildren();

    const inicial = document.createElement("option");
    inicial.value = "";
    inicial.textContent = etiqueta;
    elemento.append(inicial);

    valores.forEach(valor => {
      const opcion = document.createElement("option");
      opcion.value = valor;
      opcion.textContent = valor;
      elemento.append(opcion);
    });
  }

  obtenerFiltros() {
    return {
      busqueda: this.busqueda?.value || "",
      marca: this.marca?.value || "",
      categoria: this.categoria?.value || ""
    };
  }

  escucharFiltros(callback) {
    this.busqueda?.addEventListener("input", callback);
    this.marca?.addEventListener("change", callback);
    this.categoria?.addEventListener("change", callback);
  }

  mostrarCargando() {
    this.lista.replaceChildren();

    const texto = document.createElement("p");
    texto.className = "estado-catalogo";
    texto.textContent = "Cargando máquinas desde Supabase...";

    this.lista.append(texto);
    if (this.contador) this.contador.textContent = "";
    if (this.mensaje) this.mensaje.hidden = true;
  }

  mostrarError(error) {
    this.lista.replaceChildren();

    const aviso = document.createElement("p");
    aviso.className = "estado-catalogo error-catalogo";
    aviso.textContent =
      "No fue posible cargar el catálogo. " + error.message;

    this.lista.append(aviso);
    if (this.contador) this.contador.textContent = "";
    if (this.mensaje) this.mensaje.hidden = true;
  }

  mostrarProductos(productos) {
    this.lista.replaceChildren();

    if (this.contador) {
      this.contador.textContent =
        `${productos.length} máquina(s) encontrada(s)`;
    }

    if (this.mensaje) {
      this.mensaje.hidden = productos.length > 0;
    }

    productos.forEach(producto => {
      this.lista.append(this.crearTarjeta(producto));
    });
  }

  crearTarjeta(producto) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-producto";

    const imagenContenedor = document.createElement("div");
    imagenContenedor.className = "producto-imagen";

    if (producto.imagen) {
      const imagen = document.createElement("img");
      imagen.src = producto.imagen;
      imagen.alt = producto.nombre;
      imagen.loading = "lazy";
      imagen.onerror = () => {
        imagenContenedor.textContent = "Imagen no disponible";
      };
      imagenContenedor.append(imagen);
    } else {
      imagenContenedor.textContent = "Fotografía próximamente";
    }

    const contenido = document.createElement("div");
    contenido.className = "producto-contenido";

    const marca = document.createElement("span");
    marca.className = "producto-marca";
    marca.textContent = producto.marca;

    const nombre = document.createElement("h3");
    nombre.textContent = producto.nombre;

    const categoria = document.createElement("p");
    categoria.className = "producto-categoria";
    categoria.textContent = producto.categoria;

    const descripcion = document.createElement("p");
    descripcion.className = "producto-descripcion";
    descripcion.textContent =
      producto.descripcion || "Consulta las características.";

    const precio = document.createElement("p");
    precio.className = "producto-precio";

    if (producto.precio !== null &&
        producto.precio !== undefined) {
      const numero = Number(producto.precio);
      precio.textContent =
        `${producto.moneda} ${numero.toLocaleString("es-GT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
    } else {
      precio.textContent = "Precio a consultar";
    }

    const disponibilidad = document.createElement("p");
    disponibilidad.className = "producto-disponibilidad";
    disponibilidad.textContent =
      producto.existencias > 0
        ? `Existencias: ${producto.existencias}`
        : "Disponibilidad a consultar";

    const enlace = document.createElement("a");
    enlace.className = "boton-cotizar";
    enlace.textContent = "Solicitar información";

    const asunto = `Consulta sobre ${producto.nombre}`;
    const cuerpo =
      `Hola, deseo información sobre la máquina ` +
      `${producto.nombre} (${producto.marca}).`;

    enlace.href =
      `mailto:ventas@ejemplo.com?subject=${encodeURIComponent(asunto)}` +
      `&body=${encodeURIComponent(cuerpo)}`;

    contenido.append(
      marca,
      nombre,
      categoria,
      descripcion,
      precio,
      disponibilidad,
      enlace
    );

    tarjeta.append(imagenContenedor, contenido);
    return tarjeta;
  }
}
