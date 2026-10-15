
export class ProductoModel {
  constructor() {
    // Datos temporales para probar el catálogo.
    // Después vendrán desde PostgreSQL en Supabase.
    this.productos = [
      {
        id: 1,
        nombre: "Linear Leg Press",
        marca: "Hammer Strength",
        categoria: "Piernas",
        descripcion: "Prensa de piernas comercial.",
        imagen: "",
        estado: "Demostración"
      },
      {
        id: 2,
        nombre: "Iso-Lateral Shoulder Press",
        marca: "Hammer Strength",
        categoria: "Hombros",
        descripcion: "Máquina de press de hombros.",
        imagen: "",
        estado: "Demostración"
      },
      {
        id: 3,
        nombre: "Signature Chest Press",
        marca: "Life Fitness",
        categoria: "Pecho",
        descripcion: "Máquina comercial para entrenamiento de pecho.",
        imagen: "",
        estado: "Demostración"
      },
      {
        id: 4,
        nombre: "Equipo de fuerza Cybex",
        marca: "Cybex",
        categoria: "Fuerza",
        descripcion: "Ejemplo de producto para configurar el catálogo.",
        imagen: "",
        estado: "Demostración"
      }
    ];
  }

  obtenerTodos() {
    return [...this.productos];
  }

  obtenerMarcas() {
    return [...new Set(
      this.productos.map(producto => producto.marca)
    )].sort();
  }

  obtenerCategorias() {
    return [...new Set(
      this.productos.map(producto => producto.categoria)
    )].sort();
  }

  filtrar({ busqueda = "", marca = "", categoria = "" }) {
    const texto = busqueda.trim().toLocaleLowerCase("es");

    return this.productos.filter(producto => {
      const contenido = [
        producto.nombre,
        producto.marca,
        producto.categoria,
        producto.descripcion
      ].join(" ").toLocaleLowerCase("es");

      const coincideBusqueda = contenido.includes(texto);
      const coincideMarca = !marca || producto.marca === marca;
      const coincideCategoria =
        !categoria || producto.categoria === categoria;

      return coincideBusqueda &&
             coincideMarca &&
             coincideCategoria;
    });
  }
}
