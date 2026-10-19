-- Aplicar DESPUÉS de migracion_fitgear.sql y migracion_galeria_detalles.sql.
-- No borra máquinas, fotos, usuarios ni solicitudes.
BEGIN;

-- Sustituye las políticas de productos para evitar que una política permisiva
-- heredada permita escrituras públicas (las políticas permisivas se suman con OR).
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE politica record;
BEGIN
 FOR politica IN SELECT policyname FROM pg_policies
   WHERE schemaname='public' AND tablename='productos'
 LOOP
   EXECUTE format('DROP POLICY %I ON public.productos', politica.policyname);
 END LOOP;
END $$;
REVOKE ALL ON public.productos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.productos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.productos TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;
CREATE POLICY fitgear_catalogo_publico ON public.productos
 FOR SELECT TO anon, authenticated USING (publicado=true);
CREATE POLICY fitgear_productos_admin ON public.productos
 FOR ALL TO authenticated USING ((SELECT public.es_admin()))
 WITH CHECK ((SELECT public.es_admin()));
-- Compatible tanto con serial como con identity, sin asumir el nombre de secuencia.
DO $$
DECLARE secuencia text;
BEGIN
 secuencia := pg_get_serial_sequence('public.productos','id');
 IF secuencia IS NOT NULL THEN
   EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', secuencia);
 END IF;
END $$;

-- El seguimiento no permite cambiar los datos privados enviados por el cliente.
REVOKE UPDATE ON public.solicitudes FROM authenticated;
GRANT UPDATE(estado) ON public.solicitudes TO authenticated;

CREATE OR REPLACE FUNCTION public.fitgear_validar_inventario()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.nombre IS NULL OR length(btrim(NEW.nombre)) NOT BETWEEN 1 AND 160
 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
 IF NEW.marca IS NULL OR length(btrim(NEW.marca)) NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'Marca inválida'; END IF;
 IF length(coalesce(NEW.descripcion,''))>5000 THEN RAISE EXCEPTION 'Descripción demasiado larga'; END IF;
 IF NEW.existencias IS NULL OR NEW.existencias<0 OR NEW.existencias<>trunc(NEW.existencias)
 THEN RAISE EXCEPTION 'Existencias inválidas'; END IF;
 IF NEW.precio IS NULL OR NEW.precio<0 OR NEW.precio>9999999999
 THEN RAISE EXCEPTION 'Precio inválido'; END IF;
 IF NEW.estado IS NULL OR NEW.estado NOT IN ('disponible','reservada','vendida')
 THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF NEW.existencias=0 THEN NEW.estado:='vendida'; END IF;
 IF NEW.existencias>0 AND NEW.estado='vendida' THEN
   RAISE EXCEPTION 'Si quedan unidades, reduce las existencias sin marcar toda la máquina como vendida';
 END IF;
 NEW.nombre:=btrim(NEW.nombre);
 NEW.marca:=btrim(NEW.marca);
 NEW.moneda:='GTQ';
 RETURN NEW;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
