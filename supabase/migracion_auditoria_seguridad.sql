-- Ejecutar DESPUÉS de todas las migraciones funcionales. No cambia datos comerciales.
-- Revisar y respaldar primero. Solo SQL Editor/rol propietario gestiona administradores.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.administradores (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.administradores FROM PUBLIC,anon,authenticated;
-- Una política restrictiva también neutraliza políticas permisivas antiguas.
DROP POLICY IF EXISTS fitgear_membership_solo_propietario ON public.administradores;
CREATE POLICY fitgear_membership_solo_propietario ON public.administradores
 AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.administradores a WHERE a.user_id=(SELECT auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_admin() TO anon,authenticated;

-- No basta añadir otra política permisiva: las antiguas se combinan con OR.
DO $$
DECLARE tabla text;
BEGIN
 FOREACH tabla IN ARRAY ARRAY['clientes','clientes_fuentes','solicitudes','solicitud_productos','seguimientos','cotizaciones','ventas','pagos'] LOOP
  IF to_regclass('public.'||tabla) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tabla);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',tabla);
   IF tabla='clientes_fuentes' THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',tabla);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tabla);
   END IF;
   EXECUTE format('DROP POLICY IF EXISTS fitgear_guardia_admin ON public.%I',tabla);
   EXECUTE format('CREATE POLICY fitgear_guardia_admin ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING((SELECT public.es_admin())) WITH CHECK((SELECT public.es_admin()))',tabla);
  END IF;
 END LOOP;
END $$;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fitgear_guardia_lectura ON public.productos;
CREATE POLICY fitgear_guardia_lectura ON public.productos AS RESTRICTIVE
 FOR SELECT TO PUBLIC USING(publicado=true OR (SELECT public.es_admin()));
DROP POLICY IF EXISTS fitgear_guardia_insert ON public.productos;
CREATE POLICY fitgear_guardia_insert ON public.productos AS RESTRICTIVE
 FOR INSERT TO PUBLIC WITH CHECK((SELECT public.es_admin()));
DROP POLICY IF EXISTS fitgear_guardia_update ON public.productos;
CREATE POLICY fitgear_guardia_update ON public.productos AS RESTRICTIVE
 FOR UPDATE TO PUBLIC USING((SELECT public.es_admin())) WITH CHECK((SELECT public.es_admin()));
DROP POLICY IF EXISTS fitgear_guardia_delete ON public.productos;
CREATE POLICY fitgear_guardia_delete ON public.productos AS RESTRICTIVE
 FOR DELETE TO PUBLIC USING((SELECT public.es_admin()));
-- Revoca permisos por columna heredados: REVOKE sobre tabla no los elimina.
DO $$
DECLARE tabla text; columna record;
BEGIN
 FOREACH tabla IN ARRAY ARRAY['administradores','productos','clientes','clientes_fuentes','solicitudes','solicitud_productos','seguimientos','cotizaciones','ventas','pagos'] LOOP
  FOR columna IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=tabla LOOP
   EXECUTE format('REVOKE ALL (%I) ON public.%I FROM PUBLIC,anon,authenticated',columna.column_name,tabla);
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON public.productos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.productos TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.productos TO authenticated;
REVOKE ALL ON public.solicitudes,public.solicitud_productos,public.clientes,public.seguimientos,public.cotizaciones,public.ventas,public.pagos FROM authenticated;
GRANT SELECT ON public.solicitudes,public.solicitud_productos,public.clientes,public.seguimientos,public.cotizaciones,public.ventas,public.pagos TO authenticated;
GRANT INSERT,UPDATE ON public.clientes TO authenticated;
GRANT UPDATE(estado,estado_comercial,asesor) ON public.solicitudes TO authenticated;
GRANT UPDATE(estado_entrega) ON public.ventas TO authenticated;

-- Solo limita el bucket de máquinas; no altera políticas de otros buckets.
DROP POLICY IF EXISTS fitgear_storage_guardia_insert ON storage.objects;
CREATE POLICY fitgear_storage_guardia_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
 WITH CHECK(bucket_id<>'maquinas' OR (SELECT public.es_admin()));
DROP POLICY IF EXISTS fitgear_storage_guardia_update ON storage.objects;
CREATE POLICY fitgear_storage_guardia_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
 USING(bucket_id<>'maquinas' OR (SELECT public.es_admin()))
 WITH CHECK(bucket_id<>'maquinas' OR (SELECT public.es_admin()));
DROP POLICY IF EXISTS fitgear_storage_guardia_delete ON storage.objects;
CREATE POLICY fitgear_storage_guardia_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
 USING(bucket_id<>'maquinas' OR (SELECT public.es_admin()));

-- Registro de operaciones: no copia nombres, teléfonos, correos, notas ni tokens.
CREATE TABLE IF NOT EXISTS public.auditoria_operaciones (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 fecha timestamptz NOT NULL DEFAULT now(), actor uuid,
 tabla text NOT NULL, operacion text NOT NULL CHECK(operacion IN ('INSERT','UPDATE','DELETE')),
 registro_id text, columnas text[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.auditoria_operaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_operaciones FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.auditoria_operaciones TO authenticated;
DROP POLICY IF EXISTS fitgear_auditoria_lectura ON public.auditoria_operaciones;
CREATE POLICY fitgear_auditoria_lectura ON public.auditoria_operaciones FOR SELECT TO authenticated USING((SELECT public.es_admin()));
DROP POLICY IF EXISTS fitgear_auditoria_guardia ON public.auditoria_operaciones;
CREATE POLICY fitgear_auditoria_guardia ON public.auditoria_operaciones AS RESTRICTIVE FOR ALL TO PUBLIC USING((SELECT public.es_admin())) WITH CHECK((SELECT public.es_admin()));
CREATE OR REPLACE FUNCTION public.fitgear_auditar_operacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE anterior jsonb; nuevo jsonb; campos text[];
BEGIN
 IF TG_OP<>'INSERT' THEN anterior:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN nuevo:=to_jsonb(NEW); END IF;
 SELECT coalesce(array_agg(key ORDER BY key),'{}'::text[]) INTO campos
 FROM jsonb_object_keys(coalesce(nuevo,anterior)) AS k(key)
 WHERE TG_OP<>'UPDATE' OR nuevo->key IS DISTINCT FROM anterior->key;
 INSERT INTO public.auditoria_operaciones(actor,tabla,operacion,registro_id,columnas)
 VALUES(auth.uid(),TG_TABLE_NAME,TG_OP,coalesce(nuevo->>'id',anterior->>'id',nuevo->>'user_id',anterior->>'user_id'),campos);
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.fitgear_auditar_operacion() FROM PUBLIC,anon,authenticated;
DO $$
DECLARE tabla text;
BEGIN
 FOREACH tabla IN ARRAY ARRAY['administradores','productos','clientes','solicitudes','seguimientos','cotizaciones','ventas','pagos'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS fitgear_auditoria ON public.%I',tabla);
  EXECUTE format('CREATE TRIGGER fitgear_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fitgear_auditar_operacion()',tabla);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
