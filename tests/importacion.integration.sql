-- SOLO en PostgreSQL temporal con las migraciones y la lista inicial ya aplicadas.
-- No ejecutar esta prueba en Supabase: simula una venta para comprobar la recarga.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF (SELECT count(*) FROM public.productos)<>39 THEN RAISE EXCEPTION 'Se esperaban 39 fichas en la base de pruebas vacía'; END IF;
 IF (SELECT count(*) FROM public.productos WHERE marca='Hammer Strength')<>23 THEN RAISE EXCEPTION 'Conteo Hammer incorrecto'; END IF;
 IF (SELECT count(*) FROM public.productos WHERE marca='Life Fitness Signature')<>11 THEN RAISE EXCEPTION 'Conteo Life Fitness incorrecto'; END IF;
 IF (SELECT count(*) FROM public.productos WHERE marca='Nautilus Inspiration')<>4 THEN RAISE EXCEPTION 'Conteo Nautilus incorrecto'; END IF;
 IF (SELECT count(*) FROM public.productos WHERE marca='Matrix')<>1 THEN RAISE EXCEPTION 'Matrix debe ser una sola ficha'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.productos WHERE marca='Matrix' AND existencias=6) THEN RAISE EXCEPTION 'Se esperaban seis caminadoras'; END IF;
 IF EXISTS(SELECT 1 FROM public.productos WHERE NOT publicado OR precio IS NOT NULL OR imagen_url IS NOT NULL) THEN RAISE EXCEPTION 'La carga debe publicar sin inventar precio/foto'; END IF;
END $$;
UPDATE public.productos SET existencias=5 WHERE marca='Matrix';
\ir ../supabase/importar_inventario_inicial.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM public.productos)<>39 THEN RAISE EXCEPTION 'Repetir la carga duplicó fichas'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.productos WHERE marca='Matrix' AND existencias=5) THEN RAISE EXCEPTION 'La recarga repuso unidades vendidas'; END IF;

END $$;
UPDATE public.productos SET existencias=6 WHERE marca='Matrix';
SELECT 'OK: 39 fichas, seis Matrix en un registro, sin duplicados ni reposición de unidades; publicación correcta' AS resultado;
