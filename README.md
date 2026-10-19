# FitGear: catálogo y administración

Proyecto existente en HTML, CSS y JavaScript, organizado en MVC. Sin framework ni servidor de aplicación nuevo. Se puede alojar en GitHub Pages. Utiliza Supabase Auth, PostgreSQL/PostgREST y Storage.

## Organización y cambios

- `index.html`, `css/style.css`: catálogo público responsivo, selección de varias máquinas y formulario de contacto. Se conserva el logo de fondo y la portada sin encabezado.
- `js/models/ProductoModel.js`: lectura de máquinas publicadas, normalización de disponibilidad y validación/envío de solicitudes a la RPC existente.
- `js/views/CatalogoView.js`: tarjetas con Q, oferta y estado; ficha con galería y ampliación. Conserva los detalles heredados que tengan contenido, sin mostrar bloques vacíos.
- `js/controllers/CatalogoController.js`: filtros, selección de 1 a 20 máquinas, envío y confirmación. Evita envíos simultáneos.
- `admin/index.html`, `css/admin.css`: dashboard de clientes interesados y sección de catálogo, adaptados a móvil, tablet y escritorio. Formulario limitado a fotos, nombre, descripción, existencias, marca, estado, precio y oferta.
- `admin/js/models/AdminModel.js`: autenticación y autorización ADMIN, CRUD, Storage persistente, validación de inventario y comprobación de resultados al editar/eliminar.
- `admin/js/controllers/AdminController.js`: coordina guardado, subidas, limpieza tras errores y seguimiento. Impide cambiar de máquina durante una subida. Una carga de solicitudes fallida no oculta el catálogo.
- `admin/js/views/AdminView.js`: previews locales temporales, portada, adición y eliminación de fotos; solicitudes desplegables con acceso a sus máquinas y contacto por WhatsApp/correo. Usa prefijo 502 para teléfonos locales de ocho dígitos.
- `tests/fitgear.test.mjs`: pruebas automatizadas sin instalar dependencias.

## Base de datos existente: aplicación

Se reutiliza `productos`, la función `es_admin()` y los usuarios existentes. Las escrituras usan el token de Supabase Auth. La clave pública de `js/config/supabase.js` no permite ejecutar SQL administrativo.

Ejecutar estos archivos en el **SQL Editor del proyecto Supabase**, en este orden:

1. `supabase/migracion_fitgear.sql`: agrega `oferta`, permite categoría/área vacías, normaliza inventario, crea `solicitudes`, `solicitud_productos` y la RPC `registrar_solicitud`. Configura el bucket público `maquinas` y sus reglas de subida. No vuelve a insertar máquinas ni administradores.
2. `supabase/migracion_galeria_detalles.sql`: agrega únicamente `imagenes` como arreglo JSON persistente. Si ya existe el campo, lo conserva. Los campos heredados no se eliminan ni se sobrescriben al editar con el formulario sencillo.
3. `supabase/migracion_seguridad_catalogo.sql`: aplica RLS a productos, sustituye sus políticas por lectura pública de publicados y CRUD exclusivamente ADMIN; refuerza validaciones y limita la actualización de solicitudes al estado de seguimiento. Recarga el esquema REST.

Los scripts son transaccionales y pueden repetirse. La tercera migración sustituye las políticas de `productos` deliberadamente, porque las políticas permisivas se combinan y podrían permitir escrituras públicas. Los administradores existentes deben seguir siendo reconocidos por `es_admin()`. No elimina columnas, registros ni fotos. La relación de solicitudes guarda el nombre histórico y deja `producto_id` nulo si se elimina una máquina.

**Estado comprobado durante esta revisión:** el acceso público a `productos` responde; las tablas de solicitudes y `productos.imagenes` aún no existen en el proyecto remoto. Las migraciones están preparadas en este repositorio, no aplicadas remotamente. No se dispone de una sesión ADMIN ni de una conexión SQL administrativa para realizar esa aplicación desde aquí.

## Validaciones y persistencia

- Nombre y marca obligatorios, con límites de longitud; descripción hasta 5000 caracteres.
- Precio finito entre Q 0 y Q 9,999,999,999; existencias enteras no negativas. La moneda nueva se guarda como GTQ y se muestra como Q.
- Cero unidades implica vendida. Con unidades restantes no se puede marcar toda la ficha como vendida. Para vender una de varias unidades se reduce el inventario; una reserva afecta la ficha completa.
- JPEG/JPG, PNG, WEBP, GIF y AVIF hasta 5 MB por archivo. Validación de tipo, tamaño y firma de archivo en el cliente, y tipo/tamaño configurados también en Storage. SVG y formatos ejecutables excluidos. La comprobación de firma del cliente no sustituye un escáner de archivos en servidor.
- Las previews `blob:` solo se usan antes de guardar. Las URLs persistidas son las devueltas por Storage. La primera foto es la portada. No hay un límite fijo de cantidad de fotos.
- Si falla una subida o Supabase rechaza el guardado, se intenta retirar las fotos nuevas. Ante un fallo de red que no permite saber si el guardado se completó, se conservan para no romper una ficha confirmada por el servidor. Las fotos antiguas no se eliminan de Storage automáticamente, evitando borrar archivos compartidos.
- Nombre de cliente entre 3 y 120 caracteres, teléfono entre 8 y 22 caracteres y al menos ocho dígitos, correo válido hasta 254 caracteres, mensaje opcional hasta 2000 caracteres y 1–20 máquinas distintas publicadas. Se valida tanto en cliente como en la RPC.
- Los visitantes solo envían mediante `registrar_solicitud`; no tienen acceso a solicitudes ni pueden modificar inventario. ADMIN puede leer solicitudes y actualizar únicamente su seguimiento. Los datos del cliente se insertan como texto en el DOM.

## Pruebas

Desde la raíz:

```sh
node --test tests/fitgear.test.mjs
python3 -m http.server 8000 --bind 127.0.0.1
```

Catálogo: `http://localhost:8000`. ADMIN: `http://localhost:8000/admin/`.

Después de aplicar las migraciones:

1. Entrar con una cuenta ADMIN. Crear una máquina con dos fotos y dos unidades. Guardar y recargar ambas páginas: comprobar precio Q, oferta, fotos y existencias persistentes.
2. Editar la máquina: cambiar portada, quitar/agregar fotos y modificar nombre, descripción, marca y precio. Confirmar que categoría/área heredadas no se borran.
3. Reducir de dos unidades a una: debe seguir disponible. Reservarla: debe verse reservada. Poner cero: debe verse vendida. Intentar vendida con unidades restantes: debe rechazarse.
4. En incógnito, seleccionar varias máquinas, enviar una solicitud y ver la confirmación. Recargar ADMIN: abrir la solicitud, consultar máquinas, contactar y cambiar seguimiento. Recargar y confirmar persistencia.
5. Probar errores: SVG, falso PNG, más de 5 MB, números inválidos y solicitud sin máquinas. Comprobar que no se reporta éxito al rechazar un guardado.
6. Desde una sesión anónima y una cuenta sin rol ADMIN, comprobar que no es posible escribir productos ni consultar solicitudes. Verificar también las políticas en Supabase.
7. Revisar a 360, 768 y 1280 px: navegación, tarjetas, galería, formulario y dashboard sin desbordes.
8. Eliminar una máquina de prueba: debe desaparecer del catálogo, conservar su nombre en solicitudes antiguas y mostrar que fue eliminada.

Las pruebas automatizadas usan respuestas simuladas de Supabase. No se han certificado en esta sesión las escrituras reales, las políticas remotas después de migrar ni la interacción visual en navegador. La validación de extremo a extremo requiere aplicar SQL e iniciar sesión ADMIN. No hay envío automático de correos: el administrador gestiona las solicitudes desde el dashboard.
