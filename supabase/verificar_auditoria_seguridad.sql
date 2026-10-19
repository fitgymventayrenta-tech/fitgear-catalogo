-- SOLO diagnóstico. Ejecutar en SQL Editor tras la migración de auditoría.
-- No devuelve filas de clientes, usuarios, productos ni valores privados.
SELECT c.relname AS tabla,c.relrowsecurity AS rls,
 count(p.polname) AS politicas,
 count(p.polname) FILTER(WHERE NOT p.polpermissive) AS restrictivas
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid=c.oid
WHERE n.nspname='public' AND c.relname IN
 ('administradores','productos','clientes','clientes_fuentes','solicitudes','solicitud_productos','seguimientos','cotizaciones','ventas','pagos','auditoria_operaciones')
GROUP BY c.relname,c.relrowsecurity ORDER BY c.relname;
SELECT n.nspname AS esquema,p.proname AS funcion,p.prosecdef AS security_definer,
 p.proconfig AS configuracion,
 has_function_privilege('anon',p.oid,'EXECUTE') AS ejecutable_anon
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef ORDER BY p.proname;
-- Cualquier vista adicional expuesta se debe revisar explícitamente:
-- una vista creada por propietario puede omitir RLS de tablas subyacentes.
SELECT table_schema,table_name FROM information_schema.views WHERE table_schema='public';
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;
SELECT table_schema,table_name,grantee,privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('public','storage') AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_schema,table_name,grantee,privilege_type;
SELECT table_schema,table_name,column_name,grantee,privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_name,column_name,grantee,privilege_type;
SELECT routine_schema,routine_name,grantee,privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema='public' AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY routine_name,grantee;
