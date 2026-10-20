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
