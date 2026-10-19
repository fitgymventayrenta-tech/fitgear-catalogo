-- SOLO base temporal: fixture base + fixture auth + migraciones + auditoría.
-- No producción. Todos los datos inventados de esta prueba se revierten.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.verificar(ok boolean,mensaje text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'PRUEBA FALLIDA: %',mensaje; END IF; END $$;
INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO public.administradores(user_id) VALUES('00000000-0000-4000-8000-000000000001');
-- Se simulan políticas antiguas demasiado permisivas: las guardas deben prevalecer.
CREATE POLICY prueba_heredada ON public.clientes FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY prueba_heredada ON public.productos FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY prueba_heredada ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE storage.objects_id_seq TO authenticated;
INSERT INTO public.productos(nombre,marca,precio,existencias,publicado) VALUES('Equipo público test','Marca test',123,2,true),('Equipo oculto test','Marca test',100,1,false);
SET ROLE anon;
SELECT pg_temp.verificar(NOT public.es_admin(),'anónimo no es ADMIN');
SELECT pg_temp.verificar((SELECT count(*)=1 FROM public.productos),'anónimo solo ve publicado');
DO $$ BEGIN
 BEGIN PERFORM * FROM public.clientes; RAISE EXCEPTION 'Lectura privada permitida'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.productos SET precio=1; RAISE EXCEPTION 'Precio público editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.confirmar_venta(1,0); RAISE EXCEPTION 'RPC privada pública'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Entradas nulas y vacías fallan antes de insertar contactos o solicitudes.
DO $$ DECLARE entrada jsonb; BEGIN
 FOREACH entrada IN ARRAY ARRAY[NULL::jsonb,'null'::jsonb,'{}'::jsonb,'[]'::jsonb] LOOP
  BEGIN PERFORM public.registrar_solicitud_comercial(entrada); RAISE EXCEPTION 'Entrada inválida aceptada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Entrada inválida aceptada' THEN RAISE; END IF; END;
 END LOOP;
END $$;
-- Formulario legítimo sigue funcionando sin exponer los clientes por REST.
SELECT public.registrar_solicitud_comercial(jsonb_build_object('nombre','Contacto prueba local','telefono','5555 9876','correo','','tipo','catalogo','productos',jsonb_build_array(jsonb_build_object('producto_id',(SELECT id FROM public.productos LIMIT 1),'cantidad',1))));
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
SET request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","user_metadata":{"role":"admin"}}';
SELECT pg_temp.verificar(NOT public.es_admin(),'user_metadata admin no escala privilegios');
SELECT pg_temp.verificar(NOT has_schema_privilege('authenticated','public','CREATE'),'usuario no crea objetos públicos');
SELECT pg_temp.verificar(NOT has_column_privilege('authenticated','public.solicitudes','nombre','UPDATE'),'sin permiso columna privada heredado');
SELECT pg_temp.verificar(has_column_privilege('authenticated','public.solicitudes','estado_comercial','UPDATE'),'seguimiento conserva permiso por columna');
SELECT pg_temp.verificar((SELECT count(*)=0 FROM public.clientes),'usuario común no ve clientes aun con política heredada');
SELECT pg_temp.verificar((SELECT count(*)=1 FROM public.productos),'usuario común no ve borradores aun con política heredada');
DO $$ DECLARE n integer; BEGIN
 UPDATE public.productos SET precio=1; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Usuario común modificó precios'; END IF;
 DELETE FROM public.productos; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Usuario común eliminó productos'; END IF;
 BEGIN INSERT INTO public.administradores(user_id) VALUES(auth.uid()); RAISE EXCEPTION 'Autoalta ADMIN permitida'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO storage.objects(bucket_id) VALUES('maquinas'); RAISE EXCEPTION 'Upload no ADMIN permitido'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.guardar_seguimiento('{}'); RAISE EXCEPTION 'RPC aceptó no ADMIN'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Acceso ADMIN requerido' THEN RAISE; END IF; END;
 BEGIN UPDATE public.solicitudes SET nombre='Manipulado'; RAISE EXCEPTION 'Datos privados modificables'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT pg_temp.verificar(public.es_admin(),'membresía real da ADMIN');
SELECT pg_temp.verificar((SELECT count(*)=2 FROM public.productos),'ADMIN ve todas');
SELECT pg_temp.verificar((SELECT count(*)=1 FROM public.clientes),'ADMIN ve contacto recibido');
DO $$ BEGIN
 BEGIN UPDATE public.productos SET precio='NaN'::numeric; RAISE EXCEPTION 'NaN aceptado';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Precio inválido' THEN RAISE; END IF; END;
 BEGIN UPDATE public.productos SET precio='Infinity'::numeric; RAISE EXCEPTION 'Infinito aceptado';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Precio inválido' THEN RAISE; END IF; END;
END $$;
UPDATE public.productos SET precio=222 WHERE nombre='Equipo público test';
INSERT INTO storage.objects(bucket_id) VALUES('maquinas');
SELECT pg_temp.verificar(EXISTS(SELECT 1 FROM public.auditoria_operaciones WHERE tabla='productos' AND operacion='UPDATE' AND columnas=ARRAY['precio']),'auditoría guarda nombres de columnas, no datos');
DO $$ BEGIN
 BEGIN DELETE FROM public.auditoria_operaciones; RAISE EXCEPTION 'Auditoría borrable por navegador'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Revocar membresía invalida acceso con el mismo JWT en la siguiente consulta.
RESET ROLE;
DELETE FROM public.administradores WHERE user_id='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT pg_temp.verificar(NOT public.es_admin(),'revocación inmediata sin renovar token');
SELECT pg_temp.verificar((SELECT count(*)=0 FROM public.clientes),'ADMIN revocado sin acceso CRM');
RESET ROLE;
SET ROLE anon;
SELECT public.registrar_solicitud_comercial(jsonb_build_object(
 'nombre',$literal$QA ' OR '1'='1 --$literal$,'telefono','5555 9877','tipo','personalizada',
 'personalizada',jsonb_build_object('maquina','Equipo de prueba SQL literal','cantidad',1)));
RESET ROLE;
SELECT pg_temp.verificar(EXISTS(SELECT 1 FROM public.clientes WHERE nombre=$literal$QA ' OR '1'='1 --$literal$),'caracteres SQL se conservan como datos, sin ejecutar una consulta');
ROLLBACK;
