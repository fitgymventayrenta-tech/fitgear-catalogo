# FitGear Venta y Renta

Catálogo público y administrador con Supabase. Un repositorio, dos proyectos de Vercel y una misma base de datos.

## Dónde está cada cosa

```text
index.html                       Página pública
Logo Fit Gear.png                Logotipo
js/                              Código del catálogo y configuración compartida
  app.js                         Inicio del catálogo
  CatalogoController.js          Búsquedas, selección y solicitudes
  CatalogoView.js                Tarjetas, fotos y detalles
  ProductoModel.js               Datos del catálogo y envío de solicitudes
  comercial.js                   Validaciones y utilidades compartidas
  supabase.js                    URL y clave pública de Supabase
  contacto.js                    Información de contacto
admin/
  index.html                     Acceso y panel administrativo
  vista-catalogo.html             Vista previa del catálogo
  js/
    app.js                       Inicio del administrador
    AdminController.js           Acciones del administrador
    AdminView.js                 Pantallas y formularios
    AdminModel.js                Sesión y operaciones de datos
    vista-catalogo.js             Vista previa de máquinas
css/                             Estilos públicos, administrativos y vista previa
supabase/                        Migraciones y diagnóstico de la base de datos
scripts/                         Build y comprobaciones automáticas
tests/                          Pruebas funcionales y de seguridad
.github/workflows/seguridad.yml   Comprobaciones en GitHub
vercel.json                      Cabeceras de seguridad
AUDITORIA_SEGURIDAD_FITGEAR.md     Informe y configuraciones pendientes
```

Los archivos están agrupados por uso. No hay subcarpetas de un solo archivo para modelos, vistas, controladores, configuración ni utilidades.

## Ejecutar y publicar

Para ver el proyecto localmente, utiliza un servidor estático desde esta carpeta, por ejemplo `python3 -m http.server 8000`. El catálogo abre en `/` y el administrador en `/admin/`.

En los dos proyectos de Vercel: Framework Preset **Other** y Root Directory en la raíz del repositorio.

| Proyecto | Build Command | Output Directory |
| --- | --- | --- |
| Catálogo | `node scripts/build-static.mjs catalogo` | `dist/catalogo` |
| Administrador | `node scripts/build-static.mjs admin` | `dist/admin` |

`dist/` se genera al compilar: no se guarda en Git ni hace falta mantenerlo como copia del código. La URL principal del proyecto ADMIN abre su login.

## Atención de clientes

El directorio muestra el contacto, su atención y sus compras registradas. Cada solicitud se marca **Pendiente** o **Atendido**, independientemente de cotizaciones y ventas. Si tiene alguna solicitud pendiente, el cliente aparece pendiente; sin solicitudes se indica esa condición.

Dentro de **Ver ficha** están las máquinas solicitadas, las notas editables y el historial de ventas. Las notas reutilizan `clientes.observaciones` y la atención reutiliza `solicitudes.estado`; este cambio no necesita ejecutar SQL. Se conservan los datos y estados comerciales anteriores, aunque se retira la pantalla «Oportunidades».

Un cliente con al menos una venta confirmada se muestra como recurrente para su próxima compra. Las cotizaciones y las notas no cuentan como ventas. **Registrar venta** reutiliza la cotización aceptada y la confirmación de pedido existentes, que registran la venta y descuentan inventario. Las herramientas de seguimiento, cotizaciones y pedidos siguen disponibles en **Seguimiento y ventas**.

## Comprobar cambios

```sh
node scripts/check-security.mjs --history
node --test tests/fitgear.test.mjs tests/seguridad.test.mjs
node scripts/build-static.mjs catalogo
node scripts/build-static.mjs admin
```

Las pruebas SQL y sus archivos `tests/supabase_*.sql` son exclusivamente para una base local vacía de pruebas. **Nunca ejecutarlos en la base comercial.** GitHub utiliza un PostgreSQL temporal para estas comprobaciones.

## Base de datos y archivos privados

Las migraciones de `supabase/` se conservan para mantener y recuperar el sistema: no son archivos duplicados. No ejecutarlas indiscriminadamente; algunas cambian permisos y presuponen la estructura existente.

Antes de aplicar la migración de auditoría, leer [el informe de seguridad](AUDITORIA_SEGURIDAD_FITGEAR.md), verificar respaldo, políticas y membresía ADMIN. Esa migración no fue aplicada a producción por el asistente.

No guardar contraseñas, datos de clientes ni claves `service_role` en el código ni en las salidas publicadas. La configuración del navegador utiliza una clave pública y necesita RLS correctamente aplicada.

La reorganización aplanó las carpetas sin fusionar la lógica de los módulos. Se conservaron las pruebas, la seguridad y la separación de los dos sitios. Los archivos fuente anteriores se guardaron en un ZIP externo al proyecto antes de moverlos.

## Precios, ofertas y preventa

Antes de publicar esta versión, ejecutar completo `supabase/migracion_precios_catalogo.sql` en el SQL Editor de Supabase. Agrega `precio_oferta` y valida los precios sin reemplazar los registros existentes. No se aplicó a producción automáticamente.

El editor conserva el precio normal (`precio`), el de preventa (`precio_especial`) y el de oferta por separado. Los interruptores de preventa y oferta son independientes y desactivarlos conserva sus importes. Con ambas condiciones activas, la oferta es el precio vigente y debe ser inferior al normal y al de preventa. Ese precio también se utiliza para filtros, orden y cotizaciones nuevas; las cotizaciones y ventas anteriores conservan sus importes.

Las fichas antiguas marcadas en oferta sin un precio rebajado válido muestran su precio normal o de preventa hasta completarlas; al editarlas, se debe indicar el precio de oferta o desactivar la condición. No se inventan descuentos ni se modifican precios históricos.
