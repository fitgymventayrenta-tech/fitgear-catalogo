-- SOLO para PostgreSQL temporal de pruebas. NO ejecutar en Supabase.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id bigint GENERATED ALWAYS AS IDENTITY,bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.productos(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nombre text NOT NULL,marca text NOT NULL,categoria text NOT NULL,area text NOT NULL,
 descripcion text,precio numeric,moneda text NOT NULL DEFAULT 'GTQ',existencias integer NOT NULL DEFAULT 0,
 color text,peso_kg numeric,dimensiones text,imagen_url text,
 estado text NOT NULL DEFAULT 'disponible',publicado boolean NOT NULL DEFAULT true,
 creado_en timestamptz NOT NULL DEFAULT now(),modelo text
);
CREATE FUNCTION public.es_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(current_setting('fitgear.test_admin',true),'false')='true'
$$;
