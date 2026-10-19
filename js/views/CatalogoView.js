
export class CatalogoView {
  constructor() {
    this.lista = document.querySelector("#lista-productos");
    this.contador = document.querySelector("#contador-productos");
    this.mensaje = document.querySelector("#mensaje-vacio");
    this.busqueda = document.querySelector("#buscar-producto");
    this.marca = document.querySelector("#filtro-marca");
    this.categoria = document.querySelector("#filtro-categoria");
    this.seleccion=new Set();
    this.onSeleccion=()=>{};
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

    if (producto.imagen || producto.imagenes.length) {
      const imagen = document.createElement("img");
      imagen.src = producto.imagen || producto.imagenes[0];
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
        `Q ${numero.toLocaleString("es-GT", {
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

    const enlace = document.createElement("button");
    enlace.className = "boton-cotizar";
    enlace.textContent = "Solicitar información";

    enlace.type='button';
    enlace.addEventListener('click',()=>this.onSeleccion(producto.id));
    const estado=document.createElement('p');estado.className='producto-estado';
    const disponible=producto.existencias>0&&producto.estado==='disponible';
    estado.textContent=disponible?'Disponible':producto.existencias>0&&producto.estado==='reservada'?'Reservada':'Vendida / sin existencias';
    if(!disponible)estado.classList.add('no-disponible');
    const oferta=document.createElement('span');oferta.className='insignia-oferta';oferta.textContent='EN OFERTA';oferta.hidden=!producto.oferta;
    enlace.textContent=this.seleccion.has(producto.id)?'✓ Seleccionada':'Me interesa';
    enlace.setAttribute('aria-pressed',String(this.seleccion.has(producto.id)));
    disponibilidad.textContent=`Existencias: ${producto.existencias}`;
    const detalles=document.createElement('button');detalles.type='button';detalles.className='boton-detalles';detalles.textContent='Ver detalles y fotos';detalles.addEventListener('click',()=>this.mostrarDetalle(producto,detalles));
    contenido.append(
      marca,
      nombre,
      oferta,
      categoria,
      descripcion,
      precio,
      disponibilidad,
      estado,
      detalles,
      enlace
    );

    tarjeta.append(imagenContenedor, contenido);
    return tarjeta;
  }
  mostrarDetalle(producto,origen) {
    const dialogo=document.createElement('dialog');dialogo.className='detalle-dialogo';dialogo.setAttribute('aria-label',`Detalles de ${producto.nombre}`);
    const crear=(tag,clase,texto)=>{const e=document.createElement(tag);if(clase)e.className=clase;if(texto!==undefined)e.textContent=texto;return e;};
    const boton=(texto,accion)=>{const b=crear('button','boton boton-neutral',texto);b.type='button';b.onclick=accion;return b;};
    const cerrar=()=>dialogo.close();
    const nav=crear('nav','detalle-navegacion');
    nav.append(boton('Volver al catálogo',cerrar));
    const grid=crear('div','detalle-grid');const galeria=crear('section','detalle-galeria');
    const fotos=[...new Set([producto.imagen,...producto.imagenes].filter(u=>typeof u==='string'&&u))];
    const principal=crear('img','detalle-foto');principal.alt=producto.nombre;
    const marco=crear('div','detalle-marco');const miniaturas=crear('div','detalle-miniaturas');let actual=0;
    const seleccionar=i=>{actual=i;principal.src=fotos[i];principal.alt=`${producto.nombre}, foto ${i+1}`;[...miniaturas.children].forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));};
    if(fotos.length){marco.append(principal);fotos.forEach((url,i)=>{const b=boton(`Foto ${i+1}`,()=>seleccionar(i));const img=crear('img');img.src=url;img.alt='';img.loading='lazy';b.prepend(img);miniaturas.append(b);});seleccionar(0);}else marco.textContent='Fotografía próximamente';
    galeria.append(marco);
    if(fotos.length>1)galeria.append(miniaturas);
    if(fotos.length)galeria.append(boton('Ampliar fotografía',()=>{
      const ampliada=document.createElement('dialog');ampliada.className='foto-ampliada';ampliada.setAttribute('aria-label','Fotografía ampliada');
      const img=crear('img');img.src=fotos[actual];img.alt=principal.alt;ampliada.append(boton('Cerrar fotografía',()=>ampliada.close()),img);
      ampliada.addEventListener('close',()=>ampliada.remove());document.body.append(ampliada);ampliada.showModal();
    }));
    const info=crear('section','detalle-info');info.append(crear('span','producto-marca',producto.marca),crear('h2','',producto.nombre));if(producto.oferta)info.append(crear('span','insignia-oferta','EN OFERTA'));
    const fichas=crear('div','detalle-fichas');
    for(const [etiqueta,valor] of [['Descripción del equipo',producto.descripcion],['Características principales',producto.caracteristicas],['Grupo muscular trabajado',producto.grupo_muscular],['Características técnicas',producto.caracteristicas_tecnicas],['Dimensiones',producto.dimensiones],['Peso del equipo',producto.peso_kg==null?null:`${producto.peso_kg} kg`],['Colores disponibles',producto.color],['Materiales',producto.materiales],['Capacidad de carga',producto.capacidad_carga]]){if(valor===null||valor===undefined||valor==='')continue;const ficha=crear('article');ficha.append(crear('h3','',etiqueta),crear('p','',valor||'Pendiente de completar'));fichas.append(ficha);}
    const inventario=crear('div','detalle-inventario');
    for(const [etiqueta,valor] of [['Precio',producto.precio==null?'Precio a consultar':`Q ${Number(producto.precio).toLocaleString('es-GT',{minimumFractionDigits:2})}`],['Existencias',`${producto.existencias} · ${producto.existencias<=0?'Vendida / sin existencias':producto.estado==='reservada'?'Reservada':producto.estado==='disponible'?'Disponible':'Vendida'}`]]){const bloque=crear('div');bloque.append(crear('strong','',etiqueta),crear('p','',valor));inventario.append(bloque);}
    const interes=boton(this.seleccion.has(producto.id)?'✓ Seleccionada':'Me interesa',()=>{this.onSeleccion(producto.id);interes.textContent=this.seleccion.has(producto.id)?'✓ Seleccionada':'Me interesa';});
    info.append(fichas,inventario,interes);grid.append(galeria,info);dialogo.append(nav,grid);
    dialogo.addEventListener('close',()=>{dialogo.remove();origen.focus();});document.body.append(dialogo);dialogo.showModal();
  }

}
