
export class AdminView {
  constructor() {
    this.login = document.querySelector("#login");
    this.panel = document.querySelector("#administracion");
    this.formLogin = document.querySelector("#form-login");
    this.formProducto = document.querySelector("#form-producto");
    this.lista = document.querySelector("#lista-admin");
    this.mensaje = document.querySelector("#mensaje");
    this.titulo = document.querySelector("#titulo-formulario");
    this.salir = document.querySelector("#cerrar-sesion");
    this.guardar = document.querySelector("#guardar-producto");
  }

  mostrarPanel(autorizado) {
    this.login.hidden = autorizado;
    this.panel.hidden = !autorizado;
    this.salir.hidden = !autorizado;
  }

  notificar(texto, error = false) {
    this.mensaje.textContent = texto;
    this.mensaje.className = error ? "error" : "correcto";
  }

  limpiarFormulario() {
    this.formProducto.reset();
    this.formProducto.elements.id.value = "";
    this.titulo.textContent = "Registrar máquina";
    this.guardar.textContent = "Guardar máquina";
  }

  leerFormulario() {
    const form = this.formProducto;
    const datos = new FormData(form);

    const texto = nombre =>
      String(datos.get(nombre) || "").trim();

    const numero = nombre => {
      const valor = texto(nombre);
      return valor === "" ? null : Number(valor);
    };

    const producto = {
      nombre: texto("nombre"),
      marca: texto("marca"),
      modelo: texto("modelo") || null,
      codigo_interno: texto("codigo_interno") || null,
      area: texto("area"),
      categoria: texto("categoria"),
      descripcion: texto("descripcion") || null,
      precio: numero("precio"),
      precio_especial: numero("precio_especial"),
      moneda: "GTQ",
      existencias: Number(texto("existencias")),
      estado: texto("estado"),
      color: texto("color") || null,
      peso_kg: numero("peso_kg"),
      dimensiones: texto("dimensiones") || null,
      musculos: texto("musculos") || null,
      imagen_url: texto("imagen_url") || null,
      preventa: form.elements.preventa.checked,
      publicado: form.elements.publicado.checked,
      actualizado_en: new Date().toISOString()
    };

    const id = texto("id");
    if (id) producto.id = Number(id);

    return producto;
  }

  editar(producto) {
    this.limpiarFormulario();

    for (const [campo, valor] of Object.entries(producto)) {
      const elemento = this.formProducto.elements.namedItem(campo);
      if (!elemento) continue;

      if (elemento.type === "checkbox") {
        elemento.checked = Boolean(valor);
      } else {
        elemento.value = valor ?? "";
      }
    }

    this.titulo.textContent = "Editar máquina";
    this.guardar.textContent = "Guardar cambios";

    this.formProducto.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  mostrarProductos(productos, editar, eliminar) {
    this.lista.replaceChildren();

    if (productos.length === 0) {
      const aviso = document.createElement("p");
      aviso.textContent = "No hay máquinas registradas.";
      this.lista.append(aviso);
      return;
    }

    productos.forEach(producto => {
      const fila = document.createElement("article");
      fila.className = "fila-producto";

      const datos = document.createElement("div");

      const nombre = document.createElement("strong");
      nombre.textContent = producto.nombre;

      const detalle = document.createElement("p");
      detalle.textContent =
        `${producto.marca} · ${producto.area || "Sin área"} · ` +
        `${producto.categoria} · ` +
        `${producto.publicado ? "Publicado" : "Borrador"}`;

      datos.append(nombre, detalle);

      const acciones = document.createElement("div");
      acciones.className = "acciones";

      const botonEditar = document.createElement("button");
      botonEditar.textContent = "Editar";
      botonEditar.className = "secundario";
      botonEditar.addEventListener("click", () => editar(producto));

      const botonEliminar = document.createElement("button");
      botonEliminar.textContent = "Eliminar";
      botonEliminar.className = "peligro";
      botonEliminar.addEventListener("click", () => eliminar(producto));

      acciones.append(botonEditar, botonEliminar);
      fila.append(datos, acciones);
      this.lista.append(fila);
    });
  }
}
