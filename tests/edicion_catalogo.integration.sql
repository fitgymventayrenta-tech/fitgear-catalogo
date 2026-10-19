-- SOLO PostgreSQL temporal, con corregir_edicion_catalogo.sql aplicado.
\set ON_ERROR_STOP on
BEGIN;
SET fitgear.test_admin='true';
INSERT INTO public.productos(nombre,marca,descripcion,existencias,estado,precio,publicado)
 VALUES('Edición local de máquina importada','Prueba','',0,'vendida',NULL,false) RETURNING id AS prueba \gset
SET ROLE authenticated;
UPDATE public.productos SET nombre='Nombre corregido',descripcion='Descripción corregida',precio=NULL,publicado=true WHERE id=:prueba;
RESET ROLE;
SET ROLE anon;
SELECT count(*)=1 AS visible_sin_precio FROM public.productos WHERE id=:prueba AND publicado AND precio IS NULL \gset
\if :visible_sin_precio
\else
 \quit 1
\endif
RESET ROLE;
SET ROLE authenticated;
-- El estado heredado vendida no bloquea el ingreso de unidades.
UPDATE public.productos SET existencias=2 WHERE id=:prueba;
UPDATE public.productos SET precio=1500,oferta=true WHERE id=:prueba;
RESET ROLE;
SET ROLE anon;
SELECT count(*)=1 AS datos_actualizados FROM public.productos WHERE id=:prueba AND nombre='Nombre corregido' AND estado='disponible' AND existencias=2 AND precio=1500 AND oferta \gset
\if :datos_actualizados
\else
 \quit 1
\endif
RESET ROLE;
SET ROLE authenticated;
UPDATE public.productos SET publicado=false WHERE id=:prueba;
RESET ROLE;
SET ROLE anon;
SELECT count(*)=0 AS borrador_oculto FROM public.productos WHERE id=:prueba \gset
\if :borrador_oculto
\else
 \quit 1
\endif
RESET ROLE;
SELECT 'OK: editar importada sin precio, publicar, actualizar stock/precio y volver a borrador conserva RLS' AS resultado;
ROLLBACK;
