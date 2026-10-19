# FitGear — catálogo actualizado

Se conserva el proyecto HTML/CSS/JavaScript MVC, Supabase Auth/PostgREST y GitHub Pages.

## Aplicación (sin borrar registros)

1. Realizar respaldo de la base de datos Supabase y descargar el ZIP anterior de GitHub.
2. En **Supabase → SQL Editor**, ejecutar **solo** `supabase/migracion_fitgear.sql`. **No** ejecutar nuevamente el script inicial que contiene un `INSERT` de prueba y alta de administrador.
3. Verificar que la función `public.es_admin()` siga devolviendo `true` para el usuario autorizado; la migración no modifica usuarios.
4. Sustituir los archivos existentes del repositorio por los del ZIP actualizado, conservando `js/config/supabase.js` con la Project URL correcta y la Publishable key. No subir claves `secret`/`service_role` ni contraseñas.
5. Hacer Commit/Push y esperar GitHub Pages → Actions en verde. Forzar recarga en el navegador.

## Cambios de base de datos

- `productos`: se agrega `oferta boolean`; se permite `categoria`/`area` nulos para altas nuevas, pero **se conservan** sus valores y los demás campos heredados. Se normalizan estados antiguos a `disponible`, `reservada` o `vendida` según existencias. La regla de inventario también se valida con trigger PostgreSQL.
- `solicitudes`: datos privados, fecha y estado de seguimiento. RLS: solo ADMIN puede leer y actualizar.
- `solicitud_productos`: relación entre solicitudes y productos; conserva nombre histórico si se elimina una máquina.
- RPC `registrar_solicitud`: única vía pública de escritura, con validaciones de longitud, teléfono, correo y productos publicados. Los visitantes no tienen acceso SELECT/UPDATE/DELETE a solicitudes.
- Storage bucket `maquinas`: lectura pública para mostrar fotos, escritura y borrado solo ADMIN; máximo 5 MB y tipos JPEG/PNG/WEBP/GIF/AVIF. Se excluye SVG por seguridad.

## Pruebas sugeridas

1. Iniciar sesión ADMIN. Editar `Linear Leg Press` asignándole un precio y existencias válidas, guardar y recargar.
2. Crear máquina nueva con foto JPG/PNG; verificar vista previa, guardado, foto persistente tras recarga y visibilidad pública.
3. Reemplazar imagen, cambiar precio, marcar oferta y verificar tarjeta pública.
4. Marcar una máquina con 0 existencias y comprobar que aparece vendida, nunca disponible. Con varias unidades, reducir solo el número vendido y mantener `disponible` si quedan unidades.
5. Desde una ventana incógnita, seleccionar dos máquinas y enviar formulario. Ver confirmación y abrir ADMIN → Clientes interesados para revisar, actualizar seguimiento y contactar.
6. Intentar un archivo SVG, un archivo de más de 5 MB, existencias negativas y una solicitud sin máquinas: deben rechazarse.
7. Verificar en incógnito que el visitante no puede leer `solicitudes` por REST ni escribir `productos`.

## Consideraciones

- El ZIP contiene el código y migración **preparados**, no cambios aplicados a tu proyecto remoto. La verificación de Supabase en producción depende de ejecutar la migración y publicar los archivos.
- No hay notificación automática por correo al administrador; las solicitudes se consultan en el panel. Los enlaces WhatsApp/correo abren las aplicaciones del administrador.
- El formulario público no incorpora CAPTCHA/rate limiting por IP: para tráfico real conviene configurar protección antiabuso mediante Edge Function con rate limiting y CAPTCHA.
- No se borran automáticamente imágenes antiguas al reemplazarlas o eliminar máquinas para evitar pérdida accidental de fotografías compartidas. Puede hacerse limpieza manual del bucket más adelante.
- Una reserva se aplica al estado de la ficha de máquina completa; para reservas de **unidades individuales** haría falta un módulo de movimientos de inventario distinto.

## Galería y ficha de detalles

Ejecutar `supabase/migracion_galeria_detalles.sql` en el SQL Editor del proyecto existente antes de guardar con el administrador actualizado. Agrega los campos nuevos sin borrar registros; utiliza los campos heredados de categoría, área, peso, dimensiones y color.

En ADMIN se pueden agregar fotos en varias selecciones, quitar fotos y elegir la portada. Los cambios se aplican al guardar; la primera imagen queda también en `imagen_url` por compatibilidad. Las imágenes antiguas se conservan en Storage. Si falla una subida o el guardado, se intenta retirar las nuevas subidas sin alterar la ficha anterior.

Cada tarjeta ofrece «Ver detalles y fotos»: galería completa, ampliación, características, precio y existencias. No se fija un máximo de fotos por máquina; cada archivo admite hasta 5 MB.
