-- Ejecutar una vez en el SQL Editor de Supabase. Conserva los datos existentes.
BEGIN;
ALTER TABLE public.productos
 ADD COLUMN IF NOT EXISTS imagenes jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMIT;
