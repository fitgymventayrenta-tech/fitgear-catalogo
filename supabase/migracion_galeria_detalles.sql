-- Ejecutar una vez en el SQL Editor de Supabase. Conserva los datos existentes.
BEGIN;
ALTER TABLE public.productos
 ADD COLUMN IF NOT EXISTS imagenes jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS clasificacion text,
 ADD COLUMN IF NOT EXISTS caracteristicas text,
 ADD COLUMN IF NOT EXISTS grupo_muscular text,
 ADD COLUMN IF NOT EXISTS caracteristicas_tecnicas text,
 ADD COLUMN IF NOT EXISTS materiales text,
 ADD COLUMN IF NOT EXISTS capacidad_carga text;
COMMIT;
