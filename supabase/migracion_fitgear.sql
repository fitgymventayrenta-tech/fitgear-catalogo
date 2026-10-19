-- FitGear: ejecutar en SQL Editor del proyecto EXISTENTE, con respaldo previo.
-- Mantiene administradores, productos y campos heredados. NO volver a ejecutar
-- el script inicial del usuario (contiene INSERT de prueba).
BEGIN;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS oferta boolean NOT NULL DEFAULT false;
ALTER TABLE public.productos ALTER COLUMN categoria DROP NOT NULL;
ALTER TABLE public.productos ALTER COLUMN area DROP NOT NULL;
ALTER TABLE public.productos ALTER COLUMN estado SET DEFAULT 'disponible';
-- Se conservan los registros; se normalizan los estados heredados.
UPDATE public.productos SET estado = CASE
 WHEN existencias=0 THEN 'vendida'
 WHEN estado='reservada' THEN 'reservada'
 ELSE 'disponible' END
WHERE estado IS DISTINCT FROM CASE WHEN existencias=0 THEN 'vendida' WHEN estado='reservada' THEN 'reservada' ELSE 'disponible' END;

CREATE OR REPLACE FUNCTION public.fitgear_validar_inventario()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.existencias IS NULL OR NEW.existencias<0 THEN RAISE EXCEPTION 'Existencias inválidas'; END IF;
 IF NEW.precio IS NOT NULL AND NEW.precio<0 THEN RAISE EXCEPTION 'Precio inválido'; END IF;
 IF NEW.estado NOT IN ('disponible','reservada','vendida') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF NEW.existencias=0 THEN NEW.estado:='vendida'; END IF;
 IF NEW.existencias>0 AND NEW.estado='vendida' THEN
   RAISE EXCEPTION 'Para marcar vendida la máquina, las existencias deben ser cero';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fitgear_inventario ON public.productos;
CREATE TRIGGER fitgear_inventario BEFORE INSERT OR UPDATE ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.fitgear_validar_inventario();

CREATE TABLE IF NOT EXISTS public.solicitudes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nombre text NOT NULL,
 telefono text NOT NULL,
 correo text NOT NULL,
 mensaje text NOT NULL DEFAULT '',
 estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','contactado','finalizado')),
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.solicitud_productos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 solicitud_id bigint NOT NULL REFERENCES public.solicitudes(id) ON DELETE CASCADE,
 producto_id bigint REFERENCES public.productos(id) ON DELETE SET NULL,
 nombre_producto text NOT NULL,
 UNIQUE(solicitud_id,producto_id)
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON public.solicitudes(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_solicitud_productos_id ON public.solicitud_productos(producto_id);
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitud_productos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitudes,public.solicitud_productos FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.solicitudes TO authenticated;
GRANT SELECT ON public.solicitud_productos TO authenticated;
DROP POLICY IF EXISTS fitgear_admin_solicitudes_select ON public.solicitudes;
DROP POLICY IF EXISTS fitgear_admin_solicitudes_update ON public.solicitudes;
DROP POLICY IF EXISTS fitgear_admin_solicitud_productos ON public.solicitud_productos;
CREATE POLICY fitgear_admin_solicitudes_select ON public.solicitudes FOR SELECT TO authenticated USING ((SELECT public.es_admin()));
CREATE POLICY fitgear_admin_solicitudes_update ON public.solicitudes FOR UPDATE TO authenticated USING ((SELECT public.es_admin())) WITH CHECK ((SELECT public.es_admin()));
CREATE POLICY fitgear_admin_solicitud_productos ON public.solicitud_productos FOR SELECT TO authenticated USING ((SELECT public.es_admin()));

-- Escritura pública exclusivamente por RPC; sin permisos públicos de lectura.
CREATE OR REPLACE FUNCTION public.registrar_solicitud(
 p_nombre text,p_telefono text,p_correo text,p_mensaje text,p_productos bigint[]
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nueva_id bigint; total integer;
BEGIN
 IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
 IF p_telefono IS NULL OR length(btrim(p_telefono)) NOT BETWEEN 8 AND 22 OR
    btrim(p_telefono) !~ '^\+?[0-9 ()-]+$' OR
    length(regexp_replace(p_telefono,'[^0-9]','','g'))<8 THEN RAISE EXCEPTION 'Teléfono inválido'; END IF;
 IF p_correo IS NULL OR length(p_correo)>254 OR
    btrim(p_correo) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Correo inválido'; END IF;
 IF length(coalesce(p_mensaje,''))>2000 THEN RAISE EXCEPTION 'Mensaje demasiado largo'; END IF;
 IF p_productos IS NULL OR cardinality(p_productos) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selecciona entre 1 y 20 máquinas'; END IF;
 -- Conserva las máquinas elegidas mientras se registra la relación.
 PERFORM id FROM public.productos WHERE id=ANY(p_productos) AND publicado=true FOR SHARE;
 SELECT count(*) INTO total FROM public.productos WHERE id=ANY(p_productos) AND publicado=true;
 IF total<>cardinality(p_productos) OR total<>(SELECT count(DISTINCT x) FROM unnest(p_productos) AS x)
 THEN RAISE EXCEPTION 'La selección de máquinas no es válida'; END IF;
 INSERT INTO public.solicitudes(nombre,telefono,correo,mensaje)
 VALUES(btrim(p_nombre),btrim(p_telefono),lower(btrim(p_correo)),btrim(coalesce(p_mensaje,'')))
 RETURNING id INTO nueva_id;
 INSERT INTO public.solicitud_productos(solicitud_id,producto_id,nombre_producto)
 SELECT nueva_id,id,nombre FROM public.productos WHERE id=ANY(p_productos) AND publicado=true;
 RETURN nueva_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_solicitud(text,text,text,text,bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_solicitud(text,text,text,text,bigint[]) TO anon,authenticated;

-- Imágenes persistentes y públicamente legibles. Escritura solo administrador.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('maquinas','maquinas',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS fitgear_admin_storage_insert ON storage.objects;
DROP POLICY IF EXISTS fitgear_admin_storage_delete ON storage.objects;
CREATE POLICY fitgear_admin_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='maquinas' AND (SELECT public.es_admin()));
CREATE POLICY fitgear_admin_storage_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='maquinas' AND (SELECT public.es_admin()));
COMMIT;
