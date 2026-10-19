-- SOLO PostgreSQL temporal, después de ejecutar el SQL privado de Libro2.pdf.
-- No contiene nombres ni teléfonos del documento.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.verificar(ok boolean,mensaje text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',mensaje; END IF; END $$;
SELECT pg_temp.verificar((SELECT count(*)=163 FROM public.clientes_fuentes WHERE documento='Libro2.pdf'),'Deben conservarse las 163 filas originales');
SELECT pg_temp.verificar((SELECT count(*)=160 FROM public.clientes_fuentes WHERE documento='Libro2.pdf' AND estado='importado'),'160 fichas seguras');
SELECT pg_temp.verificar((SELECT count(*)=3 FROM public.clientes_fuentes WHERE documento='Libro2.pdf' AND estado='duplicado'),'Tres repeticiones vinculadas sin duplicar fichas');
SELECT pg_temp.verificar((SELECT count(*)=0 FROM public.clientes_fuentes WHERE documento='Libro2.pdf' AND estado='pendiente' AND cliente_id IS NULL),'No quedan identidades pendientes tras la confirmación');
SELECT pg_temp.verificar((SELECT count(*)=6 FROM public.clientes_fuentes f JOIN public.clientes c ON c.id=f.cliente_id WHERE f.documento='Libro2.pdf' AND f.estado='importado' AND c.telefono IS NULL AND c.telefono_normalizado IS NULL),'Seis contactos sin números inventados');
SELECT pg_temp.verificar(NOT EXISTS(SELECT 1 FROM public.clientes_fuentes f JOIN public.clientes c ON c.id=f.cliente_id WHERE f.documento='Libro2.pdf' AND f.estado='importado' AND (c.nombre IS DISTINCT FROM f.datos_originales->>'nombre' OR c.empresa IS DISTINCT FROM f.datos_originales->>'gym_proyecto' OR c.ubicacion_original IS DISTINCT FROM f.datos_originales->>'ubicacion' OR c.telefono IS DISTINCT FROM nullif(f.datos_originales->>'telefono','') OR c.telefono_normalizado IS DISTINCT FROM nullif(f.datos_originales->>'telefono_normalizado',''))),'Los campos importados coinciden fila por fila con el documento transcrito');
SELECT pg_temp.verificar(NOT EXISTS(SELECT 1 FROM public.clientes_fuentes f JOIN public.clientes c ON c.id=f.cliente_id WHERE f.documento='Libro2.pdf' AND (c.whatsapp<>'' OR c.correo<>'' OR c.departamento<>'' OR c.municipio<>'' OR c.tipo<>'')),'No se infieren WhatsApp, correo, tipo ni departamentos');
SET ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM count(*) FROM public.clientes_fuentes;RAISE EXCEPTION 'Acceso público a datos privados';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET fitgear.test_admin='false';
SET ROLE authenticated;
SELECT pg_temp.verificar((SELECT count(*)=0 FROM public.clientes_fuentes),'Una cuenta sin rol ADMIN no ve fuentes');
RESET ROLE;
SET fitgear.test_admin='true';
SET ROLE authenticated;
SELECT pg_temp.verificar((SELECT count(*)=163 FROM public.clientes_fuentes WHERE documento='Libro2.pdf'),'ADMIN puede auditar las fuentes');
INSERT INTO public.clientes(nombre,telefono) VALUES('Prueba sin teléfono uno',NULL),('Prueba sin teléfono dos','');
SELECT pg_temp.verificar((SELECT count(*)=2 FROM public.clientes WHERE nombre LIKE 'Prueba sin teléfono %' AND telefono IS NULL AND telefono_normalizado IS NULL),'Varios contactos sin teléfono admitidos sin falsa deduplicación');
DO $$ BEGIN
 BEGIN INSERT INTO public.clientes(nombre,telefono) VALUES('Número inválido','abc');RAISE EXCEPTION 'Teléfono inválido aceptado';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Teléfono inválido' THEN RAISE; END IF;END;
END $$;
RESET ROLE;
ROLLBACK;
