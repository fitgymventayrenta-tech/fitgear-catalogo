-- Ejecutar después de migracion_modulo_clientes.sql. No modifica inventario ni ventas.
BEGIN;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ubicacion_original text NOT NULL DEFAULT '' CHECK(length(ubicacion_original)<=500);
ALTER TABLE public.clientes ALTER COLUMN telefono DROP NOT NULL,
 ALTER COLUMN telefono_normalizado DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.fitgear_validar_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.nombre:=btrim(NEW.nombre);
 NEW.telefono:=nullif(btrim(NEW.telefono),'');
 NEW.telefono_normalizado:=CASE WHEN NEW.telefono IS NULL THEN NULL ELSE public.fitgear_telefono(NEW.telefono) END;
 IF NEW.telefono IS NOT NULL AND (NEW.telefono !~ '^\+?[0-9 ()-]{8,22}$' OR length(NEW.telefono_normalizado) NOT BETWEEN 8 AND 15)
 THEN RAISE EXCEPTION 'Teléfono inválido'; END IF;
 IF NEW.whatsapp<>'' AND (NEW.whatsapp !~ '^\+?[0-9 ()-]{8,22}$' OR length(public.fitgear_telefono(NEW.whatsapp)) NOT BETWEEN 8 AND 15)
 THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
 IF NEW.correo<>'' AND (length(NEW.correo)>254 OR NEW.correo !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 THEN RAISE EXCEPTION 'Correo inválido'; END IF;
 IF length(NEW.empresa)>160 OR length(NEW.observaciones)>5000 OR
 length(NEW.departamento)>100 OR length(NEW.municipio)>100 OR length(NEW.asesor)>120 OR
 length(NEW.tipo)>80 OR length(NEW.origen)>80 THEN RAISE EXCEPTION 'Datos de cliente demasiado largos'; END IF;
 RETURN NEW;
END $$;
CREATE TABLE IF NOT EXISTS public.clientes_fuentes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 documento text NOT NULL,
 documento_sha256 text NOT NULL CHECK(length(documento_sha256)=64),
 pagina integer NOT NULL CHECK(pagina>0), fila integer NOT NULL CHECK(fila>0),
 datos_originales jsonb NOT NULL CHECK(jsonb_typeof(datos_originales)='object'),
 cliente_id bigint REFERENCES public.clientes(id),
 estado text NOT NULL CHECK(estado IN ('importado','duplicado','pendiente')),
 observaciones text NOT NULL DEFAULT '',
 creado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(documento_sha256,pagina,fila)
);
ALTER TABLE public.clientes_fuentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clientes_fuentes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.clientes_fuentes TO authenticated;
DROP POLICY IF EXISTS fitgear_fuentes_admin ON public.clientes_fuentes;
CREATE POLICY fitgear_fuentes_admin ON public.clientes_fuentes FOR SELECT TO authenticated USING((SELECT public.es_admin()));
CREATE INDEX IF NOT EXISTS fitgear_fuentes_cliente ON public.clientes_fuentes(cliente_id);
NOTIFY pgrst,'reload schema';
COMMIT;
