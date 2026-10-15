
import { supabaseConfig } from "../config/supabase.js";

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

    const respuesta = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: key,
   
        Accept: "application/json"
      }


      
    });

    if (!respuesta.ok) {
      let detalle = "";

      try {
        const error = await respuesta.json();
        detalle = error.message || error.error || "";
      } catch {
        detalle = await respuesta.text();
      }

      throw new Error(
        `Error Supabase (${respuesta.status}): ${detalle}`
      );
    }

    const registros = await respuesta.json();

    this.productos = registros.map((producto) => ({
      id: producto.id,
      nombre: producto.nombre ?? "",
      marca: producto.marca ?? "",
      categoria: producto.categoria ?? "",
      descripcion: producto.descripcion ?? "",
      precio: producto.precio,
      moneda: producto.moneda ?? "GTQ",
      existencias: producto.existencias ?? 0,
      color: producto.color ?? "",
      peso_kg: producto.peso_kg,
      dimensiones: producto.dimensiones ?? "",
      imagen: producto.imagen_url ?? "",
      estado: producto.estado ?? "consultar"
    }));

    return [...this.productos];
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

  filtrar({
    busqueda = "",
    marca = "",
    categoria = ""
  } = {}) {
    const texto = busqueda.trim().toLocaleLowerCase("es");

    return this.productos.filter((producto) => {
      const contenido = [
        producto.nombre,
        producto.marca,
        producto.categoria,
        producto.descripcion
      ].join(" ").toLocaleLowerCase("es");

      return (
        (!texto || contenido.includes(texto)) &&
        (!marca || producto.marca === marca) &&
        (!categoria || producto.categoria === categoria)
      );
    });
  }
}
