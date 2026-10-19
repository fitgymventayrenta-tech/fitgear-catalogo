# FitGear Venta y Renta

Catálogo público y administrador con Supabase. Ambos se mantienen en este repositorio y se publican como dos proyectos independientes en Vercel.

## Archivos que se mantienen

| Carpeta / archivo | Uso |
| --- | --- |
| `index.html`, `js/`, `css/style.css` | Catálogo público |
| `admin/`, `css/admin.css`, `css/vista-catalogo.css` | Administrador, CRM y vista previa |
| `Logo Fit Gear.png` | Logotipo utilizado por la web |
| `js/config/` | Configuración pública de Supabase y contacto |
| `scripts/` | Generación de los sitios y controles automáticos |
| `supabase/` | Migraciones funcionales y de seguridad; diagnóstico |
| `tests/`, `.github/workflows/` | Pruebas funcionales y de seguridad que se conservan |
| `vercel.json` | Cabeceras de seguridad para Vercel |
| `.gitignore`, `.vercelignore` | Exclusión de archivos privados y generados |
| `docs/AUDITORIA_SEGURIDAD_FITGEAR.md` | Resultados de la auditoría y configuración pendiente |

No guardar contraseñas ni claves `service_role` en el navegador. La clave pública de Supabase necesita políticas RLS correctas. No se incluye información personal de clientes en los archivos del sitio.

## Publicar en Vercel

En ambos proyectos: Framework Preset **Other**, Root Directory en la raíz del repositorio.

| Proyecto | Build Command | Output Directory |
| --- | --- | --- |
| Catálogo | `node scripts/build-static.mjs catalogo` | `dist/catalogo` |
| Administrador | `node scripts/build-static.mjs admin` | `dist/admin` |

`dist/` se genera al compilar: no se sube a Git y no hace falta mantener una copia local. El administrador abre el login desde `/` y comparte la misma base de datos del catálogo.

## Comprobar cambios

```sh
node scripts/check-security.mjs --history
node --test tests/fitgear.test.mjs tests/seguridad.test.mjs
node scripts/build-static.mjs catalogo
node scripts/build-static.mjs admin
```

Las pruebas SQL, sus fixtures y `scripts/test-crm-auth.mjs` son **solo para una base local vacía de pruebas**, nunca para la base comercial. El workflow de GitHub prepara su propio PostgreSQL temporal.

## Base de datos y seguridad

Las migraciones se conservan porque sirven para mantener y recuperar el proyecto. No ejecutarlas indiscriminadamente: algunas cambian permisos y presuponen la estructura existente.

Para la nueva protección de Supabase, revisar primero [el informe de seguridad](docs/AUDITORIA_SEGURIDAD_FITGEAR.md), verificar respaldo y membresía ADMIN y utilizar el diagnóstico `supabase/verificar_auditoria_seguridad.sql`. La migración de auditoría no fue aplicada a producción por el asistente.

## Limpieza del proyecto

Se retiraron las copias generadas, los datos privados de importación, dos scripts históricos de carga/corrección y las pruebas puntuales reemplazadas por las comprobaciones actuales. Se conservan las pruebas utilizadas por GitHub y la prueba de navegador con cabeceras de seguridad.

Antes de retirar esos archivos se creó y verificó un ZIP fuera del proyecto. La limpieza no modifica Supabase, imágenes de Storage ni registros de clientes o máquinas. El informe de auditoría conserva la evidencia histórica: algunas pruebas que cita ya están archivadas y no forman parte del proyecto actual.
