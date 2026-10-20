-- SOLO en la base temporal creada con tests/supabase_local.sql.
-- Toda la prueba termina en ROLLBACK. Nunca apuntar estos tests a producción.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.verificar(ok boolean,mensaje text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'PRUEBA FALLIDA: %',mensaje; END IF; END $$;
SET fitgear.test_admin='true';
INSERT INTO public.productos(nombre,marca,descripcion,precio,existencias) VALUES('Prensa de prueba local','Pruebas','Solo test local',1000,3) RETURNING id AS producto \gset
SELECT set_config('fitgear.producto',:'producto',true);
SET ROLE anon;
SET fitgear.test_admin='false';
SELECT public.registrar_solicitud_comercial(jsonb_build_object('nombre','Cliente local prueba','telefono','5555 1234','correo','','operacion','compra','productos',jsonb_build_array(jsonb_build_object('producto_id',:producto,'cantidad',2)))) AS solicitud \gset
RESET ROLE;
SELECT pg_temp.verificar((SELECT existencias=3 FROM public.productos WHERE id=:producto),'una solicitud no descuenta inventario');
SELECT pg_temp.verificar((SELECT cantidad=2 FROM public.solicitud_productos WHERE solicitud_id=:solicitud),'cantidades persistidas');
SELECT cliente_id AS cliente FROM public.solicitudes WHERE id=:solicitud \gset
SELECT pg_temp.verificar((SELECT count(*)=1 FROM public.clientes WHERE id=:cliente),'cliente creado');
SET ROLE anon;
DO $$
BEGIN
 BEGIN PERFORM count(*) FROM public.clientes;RAISE EXCEPTION 'Lectura anónima de clientes permitida';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM count(*) FROM public.solicitudes;RAISE EXCEPTION 'Lectura anónima de solicitudes permitida';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE public.productos SET existencias=100;RAISE EXCEPTION 'Escritura anónima de inventario permitida';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM public.registrar_solicitud_comercial(jsonb_build_object('nombre','Segundo intento','telefono','+50255551234','productos',jsonb_build_array(jsonb_build_object('producto_id',current_setting('fitgear.producto')::bigint,'cantidad',1))));
  RAISE EXCEPTION 'Límite de frecuencia no aplicado';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Espera un minuto%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
UPDATE public.solicitudes SET creado_en=now()-interval '2 minutes' WHERE id=:solicitud;
SET ROLE anon;
SELECT public.registrar_solicitud_comercial(jsonb_build_object('nombre','Nombre público diferente','telefono','+50255551234','productos',jsonb_build_array(jsonb_build_object('producto_id',:producto,'cantidad',1)))) AS segunda \gset
RESET ROLE;
SELECT pg_temp.verificar((SELECT cliente_id=:cliente FROM public.solicitudes WHERE id=:segunda),'teléfono local e internacional reutilizan cliente');
SELECT pg_temp.verificar((SELECT nombre='Cliente local prueba' FROM public.clientes WHERE id=:cliente),'el público no sobrescribe la ficha privada');
SET ROLE authenticated;
SET fitgear.test_admin='false';
SELECT pg_temp.verificar((SELECT count(*)=0 FROM public.clientes),'cuenta sin ADMIN no lee clientes');
DO $$
BEGIN
 BEGIN PERFORM public.confirmar_venta(1,0);RAISE EXCEPTION 'Venta permitida sin ADMIN';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Acceso ADMIN requerido' THEN RAISE; END IF; END;
END $$;
SET fitgear.test_admin='true';
UPDATE public.solicitudes SET estado='contactado' WHERE id=:solicitud;
UPDATE public.clientes SET observaciones='Conversación y preferencias de prueba' WHERE id=:cliente;
SELECT pg_temp.verificar((SELECT count(*)=0 FROM public.ventas WHERE cliente_id=:cliente),'atender y guardar notas no registra ventas');
SELECT public.guardar_seguimiento(jsonb_build_object('cliente_id',:cliente,'solicitud_id',:solicitud,'medio','llamada','responsable','Prueba local','resumen','Contacto sin cerrar venta','proxima_accion','Enviar cotización','siguiente_contacto',now()+interval '1 day')) AS seguimiento \gset
SELECT pg_temp.verificar((SELECT estado_comercial='en_seguimiento' FROM public.solicitudes WHERE id=:solicitud),'el seguimiento conserva la etapa comercial');
SELECT public.completar_seguimiento(:seguimiento);
SELECT pg_temp.verificar((SELECT completado AND completado_en IS NOT NULL FROM public.seguimientos WHERE id=:seguimiento),'completar conserva historial');
SELECT public.guardar_cotizacion(jsonb_build_object('solicitud_id',:solicitud,'items',jsonb_build_array(jsonb_build_object('producto_id',:producto,'cantidad',2,'precio',900)))) AS cotizacion \gset
SELECT pg_temp.verificar((SELECT total=1800 FROM public.cotizaciones WHERE id=:cotizacion),'total calculado en servidor');
SELECT public.cambiar_cotizacion(:cotizacion,'aceptada');
SELECT public.confirmar_venta(:cotizacion,500) AS venta \gset
SELECT pg_temp.verificar((SELECT estado='contactado' FROM public.solicitudes WHERE id=:solicitud),'confirmar venta no modifica estado de atención');
SELECT pg_temp.verificar((SELECT observaciones='Conversación y preferencias de prueba' FROM public.clientes WHERE id=:cliente),'notas conservadas al registrar venta');
SELECT pg_temp.verificar((SELECT estado='pendiente' FROM public.solicitudes WHERE id=:segunda),'otra solicitud del mismo comprador conserva atención pendiente');
SELECT pg_temp.verificar((SELECT count(*)=1 FROM public.ventas WHERE cliente_id=:cliente),'historial único de ventas del cliente');
SELECT pg_temp.verificar((SELECT existencias=1 AND estado='disponible' FROM public.productos WHERE id=:producto),'venta parcial conserva unidad disponible');
SELECT public.registrar_pago(:venta,1300,'transferencia','Prueba local');
SELECT pg_temp.verificar((SELECT sum(monto)=1800 FROM public.pagos WHERE venta_id=:venta),'anticipo y pago completan saldo');
SELECT set_config('fitgear.venta',:'venta',true),set_config('fitgear.cotizacion',:'cotizacion',true);
DO $$
BEGIN
 BEGIN PERFORM public.registrar_pago(current_setting('fitgear.venta')::bigint,1,'efectivo','');RAISE EXCEPTION 'Se permitió sobrepago';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'El pago debe%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.confirmar_venta(current_setting('fitgear.cotizacion')::bigint,0);RAISE EXCEPTION 'Se duplicó venta';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Primero marca la cotización como aceptada' THEN RAISE;END IF;END;
END $$;
-- Cotización por más unidades de las disponibles: no debe producir descuentos parciales.
SELECT public.guardar_cotizacion(jsonb_build_object('solicitud_id',:segunda,'items',jsonb_build_array(jsonb_build_object('producto_id',:producto,'cantidad',2,'precio',900)))) AS sinstock \gset
SELECT public.cambiar_cotizacion(:sinstock,'aceptada');
SELECT set_config('fitgear.sinstock',:'sinstock',true);
DO $$
BEGIN
 BEGIN PERFORM public.confirmar_venta(current_setting('fitgear.sinstock')::bigint,0);RAISE EXCEPTION 'Venta sin inventario permitida';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Existencias insuficientes%' THEN RAISE;END IF;END;
END $$;
SELECT pg_temp.verificar((SELECT existencias=1 FROM public.productos WHERE id=:producto),'fallo de venta no altera stock');
RESET ROLE;
UPDATE public.solicitudes SET creado_en=now()-interval '2 minutes' WHERE id=:segunda;
SET ROLE anon;
SELECT public.registrar_solicitud_comercial('{"nombre":"Cliente local prueba","telefono":"55551234","tipo":"personalizada","operacion":"renta","personalizada":{"maquina":"Equipo solicitado fuera de inventario","marca":"Marca de prueba","cantidad":3,"presupuesto":"2500"}}') AS personalizada \gset
RESET ROLE;
SELECT pg_temp.verificar((SELECT tipo='personalizada' AND cliente_id=:cliente FROM public.solicitudes WHERE id=:personalizada),'personalizada reutiliza el cliente sin exigir producto');
SET fitgear.test_admin='true';
UPDATE public.productos SET nombre='Nombre actualizado' WHERE id=:producto;
SELECT pg_temp.verificar((SELECT nombre_producto='Prensa de prueba local' FROM public.solicitud_productos WHERE solicitud_id=:solicitud),'el historial conserva nombre original');
SET ROLE authenticated;
SET fitgear.test_admin='true';
INSERT INTO public.clientes(nombre,telefono,telefono_normalizado,origen,asesor)
 VALUES('Cliente manual local','55559999','50255559999','instagram','Asesor local') RETURNING id AS manual \gset
SELECT public.registrar_solicitud_interna(:manual,'{"tipo":"personalizada","operacion":"compra","mensaje":"Consulta manual local","personalizada":{"maquina":"Equipo a suministrar","cantidad":1}}') AS interna \gset
SELECT pg_temp.verificar((SELECT origen='instagram' AND asesor='Asesor local' AND cliente_id=:manual FROM public.solicitudes WHERE id=:interna),'solicitud interna conserva cliente origen y asesor');
SELECT public.guardar_cotizacion(jsonb_build_object('solicitud_id',:interna,'items',jsonb_build_array(jsonb_build_object('nombre','Equipo a suministrar','cantidad',1,'precio',500)))) AS cotpersonal \gset
SELECT public.cambiar_cotizacion(:cotpersonal,'aceptada');
SELECT public.confirmar_venta(:cotpersonal,0) AS ventapersonal \gset
SELECT pg_temp.verificar((SELECT existencias=1 FROM public.productos WHERE id=:producto),'pedido personalizado no descuenta máquinas ajenas');
RESET ROLE;
SELECT 'OK: recepción pública, RLS, deduplicación, seguimiento, cotización, venta, pagos y conservación de stock' AS resultado;
ROLLBACK;
