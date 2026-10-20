# Auditoría de seguridad — FitGear Venta y Renta

Fecha: 19 de octubre de 2026, America/Guatemala.

**Nota posterior de mantenimiento:** el proyecto se limpió después de esta auditoría. Las pruebas puntuales de navegador y los scripts históricos de importación/corrección citados como evidencia fueron archivados fuera del repositorio. Se conservan las pruebas unitarias, la integración de seguridad/CRM y `tests/seguridad.browser.mjs`. Este informe documenta las ejecuciones realizadas; no implica que los archivos históricos sigan presentes.
Rama local: `seguridad/auditoria-fitgear`. Base anterior a los cambios: `a297d38`.

## 1. Resumen ejecutivo y alcance real

Se revisó el código del catálogo, administrador, CRM, autenticación, Storage, SQL, Git y generación de los dos sitios. Se implementaron correcciones locales y una migración adicional de seguridad, probada únicamente en PostgreSQL temporal. Se conservaron el diseño funcional, los enlaces y los datos comerciales.

**La revisión local está terminada; producción no queda certificada por estas pruebas.** No se ejecutaron migraciones remotas, no se hizo push, merge ni despliegue, y no se modificaron controles de cuentas GitHub/Vercel/Supabase. No se realizaron pruebas ofensivas sobre producción. No se verificaron respaldos remotos.

Resultado: 25 pruebas unitarias aprobadas; integración SQL y CRM con autorización por membresía aprobadas; pruebas del navegador sobre artefactos locales con CSP y sobre el flujo responsive aprobadas. Persisten riesgos que requieren configuración o un cambio coordinado, especialmente el acceso a todas las columnas de productos publicados y la resistencia a envíos públicos automatizados con teléfonos diferentes.

Las etiquetas se refieren al entorno indicado: **APROBADA**, **FALLIDA**, **NO EJECUTADA**, **REQUIERE CONFIGURACIÓN MANUAL**. Una aprobación local no equivale a una aprobación de Supabase o Vercel en producción.

## 2. Inventario de componentes

| Componente | Archivos / tecnología | Revisión |
| --- | --- | --- |
| Catálogo público | `index.html`, `js/`, `css/style.css`; JavaScript nativo MVC | APROBADA: código, formularios, filtros, DOM y build revisados |
| Administrador | `admin/index.html`, `admin/js/`, `css/admin.css` | APROBADA: autenticación, CRUD, sesión y limpieza local probados |
| Dashboard y CRM | Clientes, solicitudes, oportunidades, seguimientos, cotizaciones, ventas y pagos | APROBADA en pruebas locales con datos ficticios |
| Vista previa administrativa | Iframe del mismo origen, `admin/vista-catalogo.html` | APROBADA: origen del mensaje, galería, CSP y eliminación al salir |
| Autenticación | Supabase Auth REST; token de acceso solo en memoria | APROBADA local; configuración remota pendiente |
| Base de datos | PostgreSQL; migraciones SQL y RPC `SECURITY DEFINER` | APROBADA en PostgreSQL 16.15 temporal; esquema real no inventariado |
| Storage | Bucket `maquinas`; imágenes de catálogo públicas | Validación del cliente APROBADA; configuración remota REQUIERE CONFIGURACIÓN MANUAL |
| Despliegue | Vercel estático; `scripts/build-static.mjs catalogo/admin` | Dos salidas locales APROBADAS; publicación remota NO EJECUTADA |
| Repositorio | Git; 17 commits alcanzables revisados por patrones | APROBADA dentro del alcance del escáner; reglas GitHub pendientes |
| Dependencias | Sin `package.json`, lockfile, React, Next.js ni librerías de ejecución instaladas en el proyecto | Inventario APROBADO; no hay árbol npm de la aplicación que auditar |
| QA | Node `node:test`, SQL, Playwright/Chrome instalado temporalmente fuera del repositorio | Pruebas locales ejecutadas; no añade dependencia al sitio |

No se encontraron funciones server-side de Vercel ni un servidor Node de producción. El servidor Node añadido en `tests/servidor-seguridad.mjs` es exclusivamente de pruebas locales. El JavaScript que recibe el navegador es público por naturaleza; ocultar la URL del administrador o minificar código no sustituye a la autorización de la base.

## 3. Hallazgos y criticidad

| ID | Riesgo observado | Criticidad | Resolución / estado |
| --- | --- | --- | --- |
| S01 | Las políticas permisivas heredadas pueden sumarse con OR y permitir acceso no previsto a tablas privadas | Alta | Guardas RLS restrictivas preparadas y probadas, incluyendo políticas antiguas artificialmente permisivas. APROBADA local; REQUIERE CONFIGURACIÓN MANUAL en Supabase |
| S02 | La definición de `es_admin()` usada en producción no era reproducible en los SQL del proyecto | Alta potencial | Nueva definición con `auth.uid()` y tabla de membresía protegida. No usa roles editables de `user_metadata`. APROBADA local; definición anterior remota NO EJECUTADA/verificada |
| S03 | Permisos heredados por columna sobreviven a un REVOKE de permisos de tabla | Alta | Revocación explícita por columna y concesiones mínimas. APROBADA local |
| S04 | Logout, expiración y 401 no garantizaban la eliminación de todas las vistas privadas; el iframe podía retener tarjetas al ocultarse | Media | Reproducido en navegador. Se destruye el iframe, se limpia CRM/galerías, se descartan respuestas y errores tardíos y se oculta ADMIN. APROBADA tras corrección |
| S05 | Logout solo local, sin solicitar revocación de la sesión de Auth | Media | Revocación remota solicitada y limpieza local inmediata. APROBADA con transporte simulado. Un JWT ya emitido puede seguir válido hasta su expiración; no se promete revocación instantánea del JWT |
| S06 | Ausencia de cabeceras de seguridad y CSP en el repositorio | Media | `vercel.json` con CSP sin ejecución inline/eval, nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy, HSTS y no-store para documentos/ADMIN. APROBADA en HTTP local; REQUIERE CONFIGURACIÓN MANUAL para desplegar y comprobar Vercel |
| S07 | `select=*` y permiso SELECT de tabla exponen todas las columnas de productos publicados, incluyendo `codigo_interno` si existe y cualquier columna privada futura | Media; alta si contiene datos confidenciales | **FALLIDA por minimización de datos, pendiente.** Hace falta vista/proyección pública y limitar acceso directo a tabla. No se cambió el contrato del frontend desplegado sin coordinación |
| S08 | El límite de solicitudes está ligado al teléfono: se puede eludir variando el número | Media | Límite existente, bloqueo de concurrencia y honeypot comprobados, pero no equivalen a protección por IP/CAPTCHA. REQUIERE CONFIGURACIÓN MANUAL/diseño de endpoint servidor |
| S09 | Errores de Auth mostraban el mensaje específico del proveedor | Baja | Mensaje genérico para credenciales; 429 se trata explícitamente. APROBADA local |
| S10 | Ruta de borrado de imagen aceptaba cualquier sufijo del prefijo del bucket | Baja | Rechazo de traversal, rutas anidadas y query strings. APROBADA por pruebas unitarias |
| S11 | Ausencia de auditoría técnica de mutaciones comerciales en los SQL revisados | Media | Registro por trigger: fecha, actor/registro técnico, operación y columnas cambiadas; no copia nombres, teléfonos, correos, notas, tokens ni valores de negocio. Solo ADMIN puede leer. APROBADA local |
| S12 | Publicar la raíz del repositorio en vez de `dist` puede servir SQL, pruebas y otros archivos internos | Media | Build con lista de recursos permitidos, rechazo de symlinks/archivos inesperados/secretos, salida pública sin ADMIN. APROBADA en artefactos. Configuración real de los dos proyectos REQUIERE CONFIGURACIÓN MANUAL |
| S13 | Las fotos de máquinas ocultas siguen siendo accesibles conociendo su URL en un bucket público | Media si las fotos son confidenciales | Comportamiento actual documentado, no corregido cambiando URLs sin coordinación. No subir documentos privados de clientes a `maquinas` |
| S14 | Límites de Auth, altas públicas, MFA, reglas de GitHub y protección de previews desconocidos | Alta potencial según configuración real | REQUIERE CONFIGURACIÓN MANUAL. No se declara vulnerabilidad explotada ni control aprobado sin acceso |

No se detectaron claves privadas o `service_role` mediante los patrones/JWT revisados. La clave `sb_publishable_…` del cliente es pública y debe quedar protegida por RLS. El escáner no demuestra ausencia absoluta de secretos ni cubre objetos Git no alcanzables, servicios externos o máquinas ajenas.

## 4. Cambios implementados

- `.gitignore` y `.vercelignore`: exclusión de datos privados, entornos, certificados, dumps, respaldos y artefactos locales.
- `scripts/build-static.mjs`: mantiene salidas separadas, comprueba extensiones, rechaza enlaces simbólicos, archivos sensibles y patrones de claves privilegiadas; incluye la hoja CSS externa de la vista previa y genera `robots.txt` apropiado para ADMIN.
- `vercel.json`: cabeceras para ambos proyectos. `frame-ancestors 'self'` permite el iframe interno y bloquea el encuadre desde otros orígenes; no se usa DENY porque rompería esa vista.
- `admin/vista-catalogo.html` y `css/vista-catalogo.css`: CSS inline trasladado a archivo para hacer compatible una CSP estricta.
- `admin/js/AdminModel.js`: mensajes genéricos de login, expiración automática, callback de cierre, revocación remota y comprobación de rutas.
- `admin/js/AdminController.js`: limpieza única para salir/expirar/401, eliminación del documento del iframe y prevención de repoblación por respuestas tardías.
- Entradas HTML y módulos de `admin/js/` y `js/`: versión de caché actualizada a 18.
- `supabase/migracion_auditoria_seguridad.sql`: membresía, políticas restrictivas, permisos por columna, protección de Storage y registro técnico de auditoría. Preparada; **no aplicada a producción**.
- `supabase/verificar_auditoria_seguridad.sql`: diagnóstico de solo lectura que lista políticas, funciones privilegiadas, vistas y permisos sin consultar filas comerciales.
- `scripts/check-security.mjs`: secretos por patrones/JWT, archivos privados, sintaxis Node y sumideros DOM/ejecución inseguros. Incluye archivos nuevos no ignorados.
- `.github/workflows/seguridad.yml`: CI con permisos `contents: read`, Actions fijadas por commit, sin credenciales persistidas, pruebas Node, builds y PostgreSQL temporal.
- Nuevas pruebas: `tests/seguridad.test.mjs`, `tests/seguridad.integration.sql`, `tests/seguridad.setup.sql`, `tests/supabase_auth_local.sql`, `tests/seguridad.browser.mjs`, `tests/servidor-seguridad.mjs` y `scripts/test-crm-auth.mjs`.

No se borraron imágenes, productos, clientes, tablas ni historiales comerciales. No se cambiaron dominios, no se agregaron servicios de pago y no se reescribió Git.

## 5. Pruebas ejecutadas y evidencia

| Comprobación | Estado final | Evidencia / límites |
| --- | --- | --- |
| Pruebas unitarias funcionales y seguridad | APROBADA | `node --test tests/fitgear.test.mjs tests/seguridad.test.mjs`: 25/25, sin fallos |
| Análisis de secretos y sintaxis | APROBADA dentro del alcance | `node scripts/check-security.mjs --history`: 17 commits, cero hallazgos bloqueantes por los patrones revisados; `node --check` para JS/MJS |
| Construcción de ambos sitios | APROBADA | Comandos `node scripts/build-static.mjs catalogo` y `admin` terminan con código 0 |
| Acceso sin sesión / usuario común / sesión expirada | APROBADA local | ADMIN oculto al entrar; cuenta sin membresía rechazada; token descartado; expiración limpia UI |
| 401 / logout / petición tardía del CRM | APROBADA local | Unitarias y `tests/seguridad.browser.mjs`; no sobreviven tarjetas, datos del CRM ni reaparición por respuestas tardías |
| Protección RLS y escalamiento de privilegios | APROBADA local | `tests/seguridad.integration.sql`: anon solo publicados; usuario común sin CRM; `user_metadata.role=admin` no habilita; autoalta ADMIN rechazada; revocación de membresía niega el acceso con el mismo claim |
| Cambiar precios / eliminar / subir sin ADMIN | APROBADA local | DML real en PostgreSQL temporal, incluso con políticas permisivas heredadas artificiales. Storage API real no utilizado |
| Privacidad del registro de auditoría | APROBADA local | Solo IDs técnicos y nombres de columnas; lectura restringida y borrado desde authenticated denegado |
| Entradas nulas, vacías, NaN, Infinity | APROBADA local | Integración SQL y unitarias rechazan entradas inválidas antes de producir registros incorrectos |
| Texto con sintaxis SQL inocua | APROBADA local | Se envía mediante la RPC y se comprueba que queda almacenado literalmente como dato; no se ejecuta SQL destructivo |
| XSS inocuo | APROBADA local | Nombre con etiqueta y manejador mostrado como texto; marcador JS no se ejecuta |
| Cabeceras, CSP, imágenes y galería | APROBADA local | Navegador real contra servidor HTTP local que aplica `vercel.json`; carga de imagen y galería administrativa bajo CSP |
| Archivos privados fuera del sitio | APROBADA local | Peticiones al catálogo compilado de `/datos_privados/…`, `/supabase/…`, `/.env`, `/.git/config`, `/admin/` devuelven 404 |
| CORS local | APROBADA en alcance estático | Sin cabecera comodín ni credenciales cruzadas en las respuestas locales; no certifica CORS de Supabase/Vercel |
| Formularios y responsive | APROBADA con transporte simulado | `tests/comercial.browser.mjs`: 320, 360, 390, 430, 768, 844×390, 1024 y 1440 px; catálogo, búsquedas, formularios, dashboard, CRM y modales |
| Editar/publicar/ocultar y sincronizar | APROBADA con transporte simulado | `tests/edicion_catalogo.browser.mjs`: cambios de precio, stock, oferta y publicación entre pestañas |
| Inventario, vista previa y publicadas | APROBADA con transporte simulado | `tests/vista_catalogo.browser.mjs`: cuatro anchos; borradores solo en la vista administrativa; consulta sin mutaciones |
| Cotización, pedido, pagos y stock con nueva membresía | APROBADA local | `scripts/test-crm-auth.mjs`: reutiliza integración CRM con claims y tabla real de ADMIN; sobrepago, doble venta y stock insuficiente se rechazan; finaliza ROLLBACK |
| Validación de imágenes en cliente | APROBADA en alcance probado | Tipos, límite 5 MB, contenido inicial incompatible, nombres UUID y ruta de eliminación; no es antivirus ni validación completa del formato en servidor |
| Migración repetible | APROBADA local | Aplicada más de una vez sobre base temporal sin borrar registros ni fallos |
| Rate limit existente de recepción | APROBADA solo por contacto | Integración CRM comprueba el límite existente; no prueba resistencia distribuida o por IP |
| Dependency audit npm | NO EJECUTADA | No hay manifest ni lockfile ni dependencias npm de ejecución; no se inventa un resultado `npm audit` |
| Type checking completo | NO EJECUTADA | Proyecto JS sin TypeScript/tsconfig ni compilador tsc instalado. Sintaxis y validación de entradas sí se probaron; no se afirma verificación estática completa de tipos |
| Lint de workflow en GitHub / ejecución cloud | NO EJECUTADA | Workflow preparado, sin push. No hay actionlint instalado; no se declara CI remoto aprobado |
| Supabase Auth/Storage reales, CORS y RLS reales | NO EJECUTADA | Pruebas controladas locales y mocks; no hubo sesión ADMIN remota ni conexión SQL de producción |
| Headers/HTTPS/protección de dominios Vercel reales | NO EJECUTADA | No se desplegó la configuración ni se probaron recursos remotos durante esta auditoría |
| Backup remoto, restauración y recuperación de Storage | NO EJECUTADA | No hay acceso de infraestructura para crearlos o verificarlos |

Se detectaron y corrigieron dos fallos durante las pruebas: iframe oculto reteniendo tarjetas y un error tardío que volvía a modificar el mensaje del CRM después de salir. El resultado final del caso de navegador es APROBADA. Los primeros fallos no se presentan como aprobaciones anteriores.

## 6. Reproducción local

No apuntar los tests SQL a Supabase ni a una base comercial. Los fixtures crean roles/esquemas de prueba y solo deben usarse en una base local vacía con permisos de creación de roles.

```sh
node scripts/check-security.mjs --history
node --test tests/fitgear.test.mjs tests/seguridad.test.mjs
node scripts/build-static.mjs catalogo
node scripts/build-static.mjs admin
```

En PostgreSQL aislado y vacío:

```sh
psql -v ON_ERROR_STOP=1 -d BASE_LOCAL_VACIA -f tests/seguridad.setup.sql
```

Después, en esa misma base local, establecer `PGHOST`, `PGPORT`, `PGDATABASE` y las credenciales temporales necesarias, y ejecutar:

```sh
FITGEAR_TEST_DATABASE=1 node scripts/test-crm-auth.mjs
```

Navegador sobre los dos artefactos compilados (necesita Playwright y Chrome locales):

```sh
FITGEAR_PLAYWRIGHT=/ruta/playwright-core/index.mjs node tests/seguridad.browser.mjs
```

Este último test inicia servidores solo en `127.0.0.1`, en puertos temporales, y los cierra al terminar. Todas las llamadas Supabase se interceptan; no usa cuentas ni datos reales. La prueba de la política HTTP local no reemplaza verificar la configuración efectiva de Vercel.

## 7. Acciones manuales necesarias: Supabase

Estado: **REQUIERE CONFIGURACIÓN MANUAL**.

1. Antes de aplicar nada, verificar respaldo/posibilidad de restauración y guardar las definiciones actuales de políticas, privilegios y funciones. No se ha comprobado que exista un backup.
2. Ejecutar primero `supabase/verificar_auditoria_seguridad.sql` como diagnóstico de solo lectura y revisar funciones/vistas adicionales no incluidas en el repositorio. Antes de la migración puede no existir la tabla de auditoría; el diagnóstico enumera lo que encuentre.
3. Confirmar que la cuenta ADMIN real ya está en `public.administradores` y que esa tabla corresponde al modelo de roles utilizado. La migración conserva membresías existentes, pero si el sistema real obtiene roles de otro lugar, la nueva `es_admin()` puede bloquear el acceso administrativo. **No aplicar hasta revisar esta condición.**
4. Con respaldo verificado y la membresía confirmada, revisar y aplicar `supabase/migracion_auditoria_seguridad.sql` después de las migraciones funcionales. No ejecutar `tests/supabase_*.sql` ni `tests/seguridad.setup.sql` en Supabase.
5. Repetir el diagnóstico. Comprobar de forma controlada con una cuenta ADMIN y otra sin privilegios antes de dar por protegida producción.
6. Revisar Auth: deshabilitar altas públicas si solo se crean administradores por invitación; límites de intentos; política de contraseñas; sesiones; MFA y CAPTCHA según disponibilidad y necesidad. No basta un límite en el JavaScript del navegador. La integración CAPTCHA exige verificación real compatible con Auth/servidor, no solo mostrar un widget.
7. Para impedir que el formulario público sea abusado cambiando teléfonos, planificar un endpoint con CAPTCHA/rate limit de servidor y cerrar la vía de RPC directa que lo eluda. No se implementó un CAPTCHA falso ni un secreto en el cliente.
8. Revisar el bucket `maquinas`, tipos MIME, tamaño y políticas reales. Las imágenes actuales son recursos públicos. Separar documentos privados en otro bucket privado con RLS y URLs firmadas si se incorporan; no mezclar documentos CRM con las fotos del catálogo.
9. Definir retención y supervisión del registro `auditoria_operaciones`. Los IDs del actor/registro son identificadores técnicos, siguen siendo información de acceso restringido y no deben publicarse.

### Cambio pendiente que requiere coordinación y autorización

Para S07, inventariar qué columnas son públicas y cuáles internas; crear una vista pública de solo esas columnas o un endpoint equivalente; actualizar las lecturas del catálogo; después retirar el SELECT público directo a la tabla y probar el CRUD ADMIN. Cambiar solo el SELECT de JavaScript no impide consultar columnas por REST. Cambiar solo el GRANT/RLS puede dejar vacío el catálogo actual. Por ello no se aplicó ninguno de esos cambios parciales sin coordinar el despliegue.

Para S13, si las fotos de borradores deben ser confidenciales, se necesita bucket privado y entrega de URLs firmadas mediante permisos; esto cambia el contrato de imágenes y no debe aplicarse sin revisar los enlaces existentes.

## 8. Acciones manuales necesarias: GitHub y Vercel

Estado: **REQUIERE CONFIGURACIÓN MANUAL**.

GitHub:

- Revisar los cambios de la rama local. No se hizo commit ni push por esta auditoría.
- Activar protección de `main`, revisión de cambios y los checks de seguridad antes de fusionar, según opciones disponibles en la cuenta.
- Activar detección/protección de secretos y revisión de dependencias cuando estén disponibles. El escáner del repositorio complementa esos controles, no los reemplaza.
- Mantener Actions con permisos mínimos y commits fijados. La contraseña del servicio PostgreSQL del workflow es ficticia, exclusiva del contenedor temporal y no reutilizable en producción.
- Si se encuentra una clave real expuesta después: revocar/rotar primero en el proveedor, revisar uso, actualizar configuración y validar; no reescribir historial automáticamente. No se detectó una clave privilegiada que justificara una rotación durante estas pruebas.

Vercel:

| Proyecto | Root Directory | Build Command | Output Directory |
| --- | --- | --- | --- |
| Catálogo | Raíz del repositorio | `node scripts/build-static.mjs catalogo` | `dist/catalogo` |
| ADMIN | Raíz del repositorio | `node scripts/build-static.mjs admin` | `dist/admin` |

- Framework `Other`. Mantener los dos dominios actuales. No seleccionar solo la carpeta `admin`, porque necesita módulos compartidos.
- No publicar la raíz del repositorio como Output Directory. `.vercelignore` ayuda con el CLI, pero no sustituye configurar correctamente la salida de los proyectos conectados a GitHub.
- Revisar variables de entorno y protección de previews. Ninguna clave `service_role`, contraseña SQL o secreto privado debe terminar en archivos estáticos.
- Revisar/aplicar la configuración solo en un despliegue autorizado; después comprobar las cabeceras, HTTPS y el login reales de cada dominio.
- El login HTML y el JavaScript ADMIN siguen siendo archivos públicos. Los datos no se incluyen en el build y las operaciones se autorizan en Supabase. Si se desea además impedir servir el HTML sin sesión, hace falta una capa de servidor/proxy o control de acceso de plataforma; no se afirma que ocultar botones proteja una ruta HTTP.
- No se activaron funciones de pago ni se cambiaron variables, dominios o proyectos remotos.

## 9. Backup y recuperación

Estado de respaldo de producción: **NO EJECUTADA / NO VERIFICADO**.

- Código: el commit `a297d38` queda conservado y los cambios se prepararon en una rama de seguridad local. No se ejecutó `reset --hard` ni se sobrescribió la rama principal.
- Antes del rollout, guardar un respaldo de PostgreSQL y sus definiciones de permisos/políticas en una ubicación privada; verificar que pueda restaurarse en una base aislada. Usar las opciones disponibles en la cuenta, sin asumir PITR/backup automático.
- Storage: inventariar los objetos, permisos y una copia de recuperación fuera del sitio público. No se descargaron ni probaron archivos comerciales durante la auditoría.
- Si falla el frontend tras un despliegue autorizado, restaurar el despliegue anterior aprobado en Vercel o preparar una rama desde el commit anterior; no borrar el trabajo de seguridad.
- Si falla una política, restaurar su definición desde el respaldo validado, usando el propietario y manteniendo RLS habilitada. No solucionar una incidencia dando permisos anónimos ni deshabilitando RLS.
- No se prepara un rollback SQL automático a ciegas: faltan las definiciones reales anteriores de producción. Restaurar exactamente esos permisos requiere el respaldo del punto anterior.
- Guardar dumps, exports y respaldos fuera de `dist`, del alojamiento web y de Git. Las exclusiones se añadieron, pero no sustituyen la revisión de lo que ya esté subido a servicios externos.

## 10. Estado final por superficie

| Superficie | Estado |
| --- | --- |
| Catálogo local compilado | APROBADA para los casos ejecutados. Pendientes S07 y S08; configuración de producción no certificada |
| ADMIN local compilado | APROBADA para los casos ejecutados: rechazo de no ADMIN, expiración, logout, limpieza de datos y CSP |
| PostgreSQL temporal | APROBADA: RLS y permisos, membresía real, auditoría e integración comercial. Claims de identidad simulados exclusivamente en fixture local |
| Supabase de producción | REQUIERE CONFIGURACIÓN MANUAL; permisos, vistas, funciones adicionales, Auth, Storage y backups no verificados |
| GitHub | Workflow preparado. Reglas, escáneres de cuenta y ejecución remota NO EJECUTADA |
| Vercel | Configuración preparada. Publicación y comprobación de los dos despliegues reales NO EJECUTADA |

Referencias oficiales utilizadas: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [límites de Auth](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA en Auth](https://supabase.com/docs/guides/auth/auth-captcha), [configuración estática de Vercel](https://vercel.com/docs/project-configuration/vercel-json).
