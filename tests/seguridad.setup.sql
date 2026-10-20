-- SOLO una base PostgreSQL temporal VACÍA. NUNCA ejecutar en Supabase.
-- psql -v ON_ERROR_STOP=1 -d BASE_TEMPORAL -f tests/seguridad.setup.sql
\set ON_ERROR_STOP on
\ir supabase_local.sql
\ir supabase_auth_local.sql
\ir ../supabase/migracion_fitgear.sql
\ir ../supabase/migracion_galeria_detalles.sql
\ir ../supabase/migracion_seguridad_catalogo.sql
\ir ../supabase/migracion_modulo_clientes.sql
\ir ../supabase/migracion_importacion_clientes.sql
\ir ../supabase/migracion_auditoria_seguridad.sql
\ir seguridad.integration.sql
