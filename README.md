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

**Estado de aplicación:** el usuario confirmó que las tres migraciones iniciales terminaron correctamente en Supabase. La nueva ampliación comercial requiere ejecutar además `migracion_modulo_clientes.sql`. No se dispone aquí de una sesión SQL administrativa para aplicarla remotamente.

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

Las pruebas automatizadas usan respuestas simuladas de Supabase. No se han certificado las escrituras ni las políticas del proyecto remoto. La ampliación comercial se probó además en PostgreSQL temporal y en navegador con el transporte interceptado, como se detalla abajo. La validación de extremo a extremo requiere aplicar SQL e iniciar sesión ADMIN. No hay envío automático de correos: el administrador gestiona las solicitudes desde el dashboard.

## Ampliación comercial: Dashboard | Catálogo | Clientes

Para habilitar esta versión, las tres migraciones anteriores deben estar aplicadas. **Solo falta ejecutar el contenido de `supabase/migracion_modulo_clientes.sql` en el SQL Editor de Supabase**. No pegues el nombre del archivo. Después, recarga las dos páginas. No vuelvas a ejecutar la migración inicial para esta ampliación.

La nueva migración conserva `productos`, `solicitudes` y `solicitud_productos`. Añade:

- `clientes`: ficha única por teléfono normalizado; los ocho dígitos locales se normalizan con el prefijo 502. Vincula las solicitudes anteriores al cliente. Recibir otro formulario no sobrescribe su ficha privada. Teléfonos diferentes se consideran contactos diferentes; no se fusionan por nombres parecidos.
- En `solicitudes`: cliente, operación (compra/preventa/renta), origen, asesor, datos personalizados y estado comercial. Conserva el campo `estado` heredado. Las solicitudes antiguas finalizadas pasan a seguimiento comercial; no se inventan ventas ni tareas completadas.
- En `solicitud_productos`: cantidades y fotografía/marca/modelo históricos. Se conserva el identificador real del producto y el nombre histórico, incluso si se modifica la máquina.
- `seguimientos`: cada conversación y próxima actividad queda en un registro independiente, con responsable, medio, acuerdos, respuesta y fecha de siguiente contacto. Completar una tarea conserva su historial y no gana una oportunidad.
- `cotizaciones`: partidas, cantidades, precios, total calculado en servidor, vigencia y condiciones. Los documentos guardados conservan sus precios; para cambiar una propuesta se crea otra cotización desde la solicitud.
- `ventas` y `pagos`: pedido, cantidades, precio acordado, anticipo, historial de pagos, saldo calculado y estado de entrega. Cada solicitud puede convertirse en un solo pedido; cada cotización solo se convierte una vez.

El catálogo administrativo mantiene su inventario, fotos y formularios emergentes, y vuelve a permitir editar categoría. La pestaña Clientes incluye Directorio, Solicitudes, Oportunidades, Seguimientos, Cotizaciones y Ventas y pedidos. La ficha de cliente agrupa su historial y permite registrar clientes y solicitudes manualmente (WhatsApp, Instagram, Marketplace, llamadas o visitas), sin crear otro módulo paralelo.

El catálogo público permite:

1. **Solicitar información** de una máquina, con foto, marca, modelo cuando exista y cantidad.
2. **Agregar a mi solicitud** varios equipos, ajustar cantidades individuales, quitar equipos y enviar una sola consulta.
3. **¿No encuentras la máquina que necesitas?**: solicitud personalizada con marca, máquina, cantidad, presupuesto opcional y comentarios.

El correo es opcional. La confirmación se muestra después de que la RPC devuelva el identificador guardado. No hay pagos públicos ni modificaciones de inventario al consultar. La RPC anterior se conserva como adaptador al mecanismo nuevo.

### Reglas de inventario y seguridad del módulo

- Una consulta, un seguimiento o una cotización no reservan ni descuentan unidades. El estado de reserva manual del catálogo se conserva; no hay reservas parciales automáticas ni cobro en línea.
- Al confirmar un pedido desde una cotización aceptada y vigente, una transacción bloquea sus productos, verifica todas las cantidades, descuenta existencias y registra pedido/anticipo. Si falta stock, no guarda descuentos parciales. Una venta parcial mantiene disponibles las unidades restantes; cero unidades implica vendida.
- Las partidas personalizadas sin producto asociado quedan en el pedido sin descontar inventario; requieren gestión de suministro por el asesor. La operación solicitada queda en la solicitud vinculada. El módulo no incluye devoluciones ni control de retornos de alquileres.
- El total y los pagos se validan en servidor. Los pagos no pueden exceder el saldo y el pedido no puede duplicarse. El saldo incluye el anticipo registrado.
- RLS limita clientes, tareas, cotizaciones, pedidos y pagos a ADMIN. Las acciones de cotización, venta y pago se realizan por RPC con validación explícita de `es_admin()`. Los roles públicos no pueden leer información privada ni modificar inventario.
- Recepción pública: validación de campos, límite de veinte equipos distintos y cantidades de 1–999, campo trampa y límite de una solicitud por minuto / diez al día por teléfono, aplicado en PostgreSQL con bloqueo contra concurrencia. Este límite básico puede eludirse cambiando de teléfono; no sustituye un CAPTCHA o limitación por IP en un servicio perimetral si aumenta el abuso.
- Asesor, tipo y origen son datos administrativos; no se han creado cuentas ni roles nuevos de asesores.

### Dashboard y pruebas de esta ampliación

El dashboard muestra solicitudes recibidas/nuevas, clientes únicos/contactados, tareas pendientes/programadas/vencidas/completadas, cotizaciones pendientes y ventas concretadas. Se deduplican clientes por ficha; las solicitudes y las tareas conservan sus propios contadores. Una oportunidad marcada ganada sin pedido no aumenta las ventas concretadas.

Comprobaciones realizadas:

- `node --test tests/fitgear.test.mjs`: validaciones, selección, cantidades, correo opcional, métricas, imágenes, guardado y manejo de errores.
- `tests/comercial.integration.sql`: pruebas reales de las migraciones en un PostgreSQL temporal con esquema mínimo compatible. Comprueba RLS anónimo/no ADMIN, deduplicación, límites de frecuencia, historial, cotización, inventario, anticipos, pagos y rechazo de ventas sin stock. Termina con `ROLLBACK`.
- `tests/comercial.browser.mjs`: Chrome a 360, 768 y 1440 px, sin desbordes horizontales ni errores JavaScript. Prueba consultas simple/múltiple/personalizada, navegación, ficha, seguimientos, cotizaciones, pedidos, pagos y modales de máquinas. Intercepta todas las llamadas a Supabase: **no envía datos de prueba a producción**. Requiere `playwright-core` y Chrome; `FITGEAR_PLAYWRIGHT` permite apuntar al módulo instalado para QA sin agregar dependencias al sitio.

Los archivos de `tests/fixtures/` son exclusivos de la base temporal: **no ejecutarlos en Supabase**, pues simulan Auth para las pruebas. La migración comercial y las pruebas locales no constituyen una verificación de producción: falta aplicar la nueva migración con acceso SQL administrativo y comprobar una operación real autorizada con la cuenta ADMIN.

Prueba manual tras migrar: enviar una consulta real → Clientes / Solicitudes → abrir ficha → asignar asesor y registrar seguimiento → crear cotización → marcarla aceptada → confirmar pedido con anticipo → comprobar stock y registrar pago → recargar y verificar el saldo. Para las operaciones que no desees realizar realmente, revisa las pantallas sin confirmar la venta.

## Importar la lista inicial de equipos

Abrir `supabase/importar_inventario_inicial.sql`, copiar todo el contenido y ejecutarlo en el SQL Editor de Supabase. Es un script independiente para esta carga, posterior a las migraciones iniciales del inventario; no requiere volver a ejecutar las anteriores.

La lista contiene **39 fichas**: 23 Hammer Strength, 11 Life Fitness Signature, una ficha de Caminadoras Matrix con **seis unidades en total**, y cuatro Nautilus Inspiration. No se crean modelos Matrix distintos. El script compara nombre y marca normalizados para evitar duplicados, conserva los datos de las fichas que ya existan y no vuelve a poner seis unidades Matrix al repetirlo después de una venta. Si hay duplicados previos ambiguos, se detiene sin borrar nada.

Los nuevos registros quedan como **borradores no publicados**, con precio pendiente y sin fotografías inventadas. Para los equipos cuyo inventario no se proporcionó, cero es un valor técnico provisional; se debe confirmar al completar la ficha, no interpretarlo como una venta real. El registro de prueba Linear Leg Press, si todavía conserva exactamente la descripción de prueba y no tiene precio, fotos ni unidades, pasa a borrador y se retira esa descripción de prueba; sus datos reales, si ya los tiene, se conservan.

En ADMIN → Catálogo → Editar, «Guardar y publicar» muestra los cambios al público; «Guardar sin publicar» los conserva solo en ADMIN. El precio puede quedar pendiente y mostrarse como «Precio a consultar»; se mantienen las reglas de inventario. Completar fotos, precio y existencias antes de publicar cada máquina. La regla actual admite precio nulo como «Precio a consultar» tanto en borradores como en fichas publicadas.

Comprobación realizada en PostgreSQL temporal: 39 fichas, cero nuevas fichas al repetir la carga y seis unidades Matrix en una sola ficha. La ejecución en Supabase queda pendiente del usuario; no se han insertado estos productos remotamente desde el agente.

## Ajustes de experiencia del catálogo público

La portada es más compacta y los equipos aparecen antes. La búsqueda incluye modelo, área de entrenamiento, acentos y equivalencias frecuentes como «prensa» / «leg press». Hay filtros desplegables por marca, categoría, disponibilidad, oferta/preventa y rango de precio, con ordenamiento y limpieza. Los precios pendientes no se incluyen artificialmente en rangos ni totales; la preventa usa un precio especial solo si existe y es válido.

La tarjeta tiene consulta individual y adición a cotización con jerarquías visuales distintas; fotos y nombre abren los detalles. La cotización permanece accesible en una barra fija y su selección se conserva al recargar la misma pestaña, por un máximo de 24 horas. Solo se guarda la lista de IDs y cantidades en sessionStorage; los datos personales no se guardan ahí.

Los campos personalizados se desactivan cuando no corresponden, corrigiendo la validación invisible al cambiar de formulario. Los datos opcionales están agrupados, el resumen distingue precios conocidos de pendientes y la confirmación explica el siguiente paso únicamente tras respuesta del servidor. La sección de contacto abre una consulta, sin devolver al visitante a un ciclo de enlaces.

`js/config/contacto.js` permite completar WhatsApp, correo, horario y condiciones de preventa oficiales. Los valores vacíos no generan contactos ficticios; falta que FitGear proporcione esos datos. El catálogo no fabrica fotos, precios ni condiciones comerciales para los productos.

## Corrección de edición y visibilidad

Si ejecutaste la importación anterior, aplica una sola vez **`supabase/corregir_edicion_catalogo.sql`** en SQL Editor. No reimportes las máquinas. Este script no crea ni elimina productos; corrige la función de validación y su trigger para admitir precio a consultar y recibir unidades de máquinas anteriormente sin existencias. No publica masivamente borradores.

En ADMIN, la acción principal es **Guardar y publicar**; la secundaria es **Guardar sin publicar**. Ya no depende de una casilla de publicación que podía pasar inadvertida. El precio es opcional y no se sustituye por cero. Al aumentar existencias desde cero, la interfaz cambia el estado a disponible; el servidor aplica también esta regla si conserva el estado heredado vendida. Marcar toda una ficha como vendida sigue requiriendo cero unidades.

El aviso diferencia publicación de borrador y, al publicar, se consulta la ficha con la clave pública sin token ADMIN para comprobar su visibilidad. Si esa comprobación falla, informa que se guardó pero no pudo confirmarse la lectura pública. Las consultas evitan caché; el catálogo se actualiza al regresar a la pestaña, al recibir el aviso de otra pestaña del mismo sitio y cada 30 segundos mientras esté visible. La actualización se difiere si el comprador tiene abierto el formulario y conserva sus filtros y selección.

Pruebas específicas: `tests/edicion_catalogo.integration.sql` verifica en PostgreSQL temporal edición, precio pendiente, publicación, entrada de unidades y acceso anónimo con RLS. `tests/edicion_catalogo.browser.mjs` recorre ADMIN y catálogo en dos pestañas con Supabase interceptado, comprobando nombre, descripción, precio, stock, oferta y ocultación como borrador. No modifica Supabase real.

## Catálogo vacío tras importar: publicación de las 39 fichas

La versión actual de `supabase/corregir_edicion_catalogo.sql` corrige el trigger **y publica las fichas de la lista importada**, conservando fotos, precios, ofertas y existencias. Si ejecutaste una versión anterior de ese archivo, copia y ejecuta de nuevo TODO el contenido actualizado. No reimportes ni borres productos. La consulta final muestra cuántos están visibles por marca. Las existencias en cero se muestran como sin existencias, sin inventar disponibilidad.

Las nuevas importaciones ahora crean fichas publicadas con precio a consultar; los datos desconocidos siguen sin inventarse. En ADMIN el resumen distingue visibles y ocultas. Los módulos de esta revisión usan versión 12 en sus URLs para evitar mezclar archivos de versiones anteriores; después de aplicar SQL recarga completamente ambas páginas. Guardar valida también la representación que devuelve el servidor: si un campo no coincide, no se informa éxito.

Comprobación en PostgreSQL temporal: 39 fichas publicadas, seis unidades conservadas y cero diferencias en los demás campos. Estas pruebas no ejecutan la reparación en el proyecto remoto.

Importación de contactos desde un documento: `supabase/migracion_importacion_clientes.sql` amplía el módulo de clientes con ubicación original, contactos sin teléfono y fuentes privadas con página/fila. El directorio muestra las coincidencias pendientes sin fusionarlas. Los datos y el SQL específico del documento se guardan exclusivamente en `datos_privados/`, excluido de Git; sus instrucciones están en `datos_privados/LEEME.md`. El SQL privado ya incluye esta ampliación: no hace falta ejecutar ambos. No modifica máquinas, solicitudes, ventas ni fichas previas. La recepción pública sigue exigiendo teléfono; para crear una solicitud interna de un contacto importado sin número hay que completar primero su teléfono real.

Adaptación responsive: el administrador usa navegación de clientes con selector en pantallas de hasta 800 px, filtros plegables y fichas con datos etiquetados. Los formularios de clientes se agrupan por contacto, ubicación e información comercial; el historial de la ficha se abre por secciones. En teléfonos, los diálogos ocupan la pantalla disponible y conservan el cierre visible. El catálogo público ajusta filtros, galería, cotización y botones al ancho. Validación del flujo con transporte Supabase simulado en 320, 360, 390, 430, 768, 1024 y 1440 px, más 844×390 en horizontal; sin desbordamientos de página ni de diálogos en los estados comprobados. Estos cambios de presentación no requieren SQL.

En ADMIN → Catálogo hay tres vistas: Inventario para agregar/editar, Vista previa · Todas para revisar también máquinas ocultas y Publicadas para ver únicamente las visibles. La vista previa recibe los datos ya autorizados del administrador mediante mensajes del mismo origen; su página independiente no consulta Supabase ni incluye datos de máquinas. Reutiliza las tarjetas y la galería públicas en modo de consulta, sin enviar solicitudes ni cambiar la publicación. Buscar dentro de estas vistas no modifica el inventario. No requiere una migración SQL adicional.

Despliegue separado en Vercel desde el mismo GitHub

Crea dos proyectos de Vercel conectados a este repositorio y a la rama `main`. En ambos selecciona Framework Preset `Other` y Root Directory en la raíz del repositorio (no `admin`). Configura:

| Proyecto | Build Command | Output Directory |
| --- | --- | --- |
| Catálogo público | `node scripts/build-static.mjs catalogo` | `dist/catalogo` |
| Administrador | `node scripts/build-static.mjs admin` | `dist/admin` |

El administrador abre el login desde `/` en su propio dominio. Conserva internamente `/admin/` y las rutas compartidas de estilos y módulos. El catálogo generado no incluye la carpeta `admin`. Ambas aplicaciones usan el Supabase configurado en `js/config/supabase.js`; tener otro dominio no crea otra base de datos. El acceso a datos privados sigue dependiendo del login y las políticas ADMIN de Supabase.

La salida se genera con una lista explícita de archivos: nunca copia `datos_privados/`, scripts SQL, pruebas ni archivos `.env`. `dist/` no se sube a Git. `.vercelignore` excluye también los archivos privados en despliegues mediante CLI. Al cambiar la configuración del proyecto público existente, haz un nuevo despliegue para que utilice `dist/catalogo`.
