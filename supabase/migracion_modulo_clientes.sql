-- Ejecutar DESPUÉS de las tres migraciones anteriores.
-- Amplía las solicitudes existentes. No elimina productos ni historiales.
BEGIN;

CREATE OR REPLACE FUNCTION public.fitgear_telefono(valor text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN length(regexp_replace(coalesce(valor,''),'[^0-9]','','g'))=8
 THEN '502'||regexp_replace(valor,'[^0-9]','','g')
 ELSE regexp_replace(coalesce(valor,''),'[^0-9]','','g') END
$$;

CREATE TABLE IF NOT EXISTS public.clientes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nombre text NOT NULL CHECK(length(btrim(nombre)) BETWEEN 3 AND 120),
 empresa text NOT NULL DEFAULT '', telefono text NOT NULL,
 telefono_normalizado text NOT NULL UNIQUE CHECK(length(telefono_normalizado) BETWEEN 8 AND 15),
 whatsapp text NOT NULL DEFAULT '', correo text NOT NULL DEFAULT '',
 departamento text NOT NULL DEFAULT '', municipio text NOT NULL DEFAULT '',
 tipo text NOT NULL DEFAULT 'particular', origen text NOT NULL DEFAULT 'manual',
 asesor text NOT NULL DEFAULT '', observaciones text NOT NULL DEFAULT '',
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.fitgear_validar_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.nombre:=btrim(NEW.nombre);
 IF NEW.telefono !~ '^\+?[0-9 ()-]{8,22}$' THEN RAISE EXCEPTION 'Teléfono inválido'; END IF;
 NEW.telefono_normalizado:=public.fitgear_telefono(NEW.telefono);
 IF NEW.whatsapp<>'' AND (NEW.whatsapp !~ '^\+?[0-9 ()-]{8,22}$' OR length(public.fitgear_telefono(NEW.whatsapp)) NOT BETWEEN 8 AND 15)
 THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
 IF NEW.correo<>'' AND (length(NEW.correo)>254 OR NEW.correo !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 THEN RAISE EXCEPTION 'Correo inválido'; END IF;
 IF length(NEW.empresa)>160 OR length(NEW.observaciones)>5000 OR
 length(NEW.departamento)>100 OR length(NEW.municipio)>100 OR length(NEW.asesor)>120 OR
 length(NEW.tipo)>80 OR length(NEW.origen)>80 THEN RAISE EXCEPTION 'Datos de cliente demasiado largos'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fitgear_cliente_valido ON public.clientes;
CREATE TRIGGER fitgear_cliente_valido BEFORE INSERT OR UPDATE ON public.clientes
 FOR EACH ROW EXECUTE FUNCTION public.fitgear_validar_cliente();

ALTER TABLE public.solicitudes
 ADD COLUMN IF NOT EXISTS cliente_id bigint REFERENCES public.clientes(id),
 ADD COLUMN IF NOT EXISTS estado_comercial text
 CHECK(estado_comercial IN ('nueva','contactada','en_seguimiento','cotizada','en_negociacion','ganada','perdida')),
 ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'catalogo' CHECK(tipo IN ('catalogo','personalizada')),
 ADD COLUMN IF NOT EXISTS operacion text NOT NULL DEFAULT 'compra' CHECK(operacion IN ('compra','preventa','renta')),
 ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'catalogo_web',
 ADD COLUMN IF NOT EXISTS asesor text NOT NULL DEFAULT '' CHECK(length(asesor)<=120),
 ADD COLUMN IF NOT EXISTS personalizada jsonb;
ALTER TABLE public.solicitud_productos
 ADD COLUMN IF NOT EXISTS cantidad integer NOT NULL DEFAULT 1 CHECK(cantidad BETWEEN 1 AND 999),
 ADD COLUMN IF NOT EXISTS marca_producto text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS modelo_producto text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS imagen_producto text NOT NULL DEFAULT '';

-- Una ficha por teléfono normalizado, incluso para las solicitudes anteriores.
INSERT INTO public.clientes(nombre,telefono,telefono_normalizado,whatsapp,correo,origen)
 SELECT DISTINCT ON (public.fitgear_telefono(telefono)) btrim(nombre),telefono,
 public.fitgear_telefono(telefono),telefono,correo,'catalogo_web'
 FROM public.solicitudes
 WHERE length(public.fitgear_telefono(telefono)) BETWEEN 8 AND 15
 ORDER BY public.fitgear_telefono(telefono),creado_en
 ON CONFLICT(telefono_normalizado) DO NOTHING;
UPDATE public.solicitudes s SET cliente_id=c.id
 FROM public.clientes c WHERE s.cliente_id IS NULL AND c.telefono_normalizado=public.fitgear_telefono(s.telefono);
-- Solo transforma solicitudes heredadas que aún no tengan estado comercial.
UPDATE public.solicitudes SET estado_comercial=CASE estado WHEN 'contactado' THEN 'contactada'
 WHEN 'finalizado' THEN 'en_seguimiento' ELSE 'nueva' END
 WHERE estado_comercial IS NULL;
ALTER TABLE public.solicitudes ALTER COLUMN estado_comercial SET DEFAULT 'nueva',
 ALTER COLUMN estado_comercial SET NOT NULL;
UPDATE public.solicitud_productos sp SET marca_producto=p.marca,
 modelo_producto=coalesce(to_jsonb(p)->>'modelo',''),imagen_producto=coalesce(p.imagen_url,'')
 FROM public.productos p WHERE sp.producto_id=p.id AND sp.marca_producto='';

CREATE TABLE IF NOT EXISTS public.seguimientos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cliente_id bigint NOT NULL REFERENCES public.clientes(id),
 solicitud_id bigint REFERENCES public.solicitudes(id),
 fecha timestamptz NOT NULL DEFAULT now(),
 medio text NOT NULL CHECK(medio IN ('whatsapp','llamada','correo','visita','instagram','facebook','otro')),
 responsable text NOT NULL CHECK(length(btrim(responsable)) BETWEEN 1 AND 120),
 resumen text NOT NULL CHECK(length(btrim(resumen)) BETWEEN 1 AND 5000),
 respuesta text NOT NULL DEFAULT '' CHECK(length(respuesta)<=5000),
 acuerdos text NOT NULL DEFAULT '' CHECK(length(acuerdos)<=5000),
 proxima_accion text NOT NULL DEFAULT '' CHECK(length(proxima_accion)<=2000),
 siguiente_contacto timestamptz,
 completado boolean NOT NULL DEFAULT false,
 completado_en timestamptz,
 CHECK(siguiente_contacto IS NULL OR length(btrim(proxima_accion))>0)
);
CREATE TABLE IF NOT EXISTS public.cotizaciones (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cliente_id bigint NOT NULL REFERENCES public.clientes(id),
 solicitud_id bigint NOT NULL REFERENCES public.solicitudes(id),
 creado_en timestamptz NOT NULL DEFAULT now(),
 vence_en date,
 estado text NOT NULL DEFAULT 'borrador' CHECK(estado IN ('borrador','enviada','aceptada','rechazada','vencida','convertida')),
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),
 total numeric(16,2) NOT NULL CHECK(total>=0),
 notas text NOT NULL DEFAULT '' CHECK(length(notas)<=5000)
);
CREATE TABLE IF NOT EXISTS public.ventas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 cliente_id bigint NOT NULL REFERENCES public.clientes(id),
 solicitud_id bigint NOT NULL REFERENCES public.solicitudes(id),
 cotizacion_id bigint NOT NULL UNIQUE REFERENCES public.cotizaciones(id),
 creado_en timestamptz NOT NULL DEFAULT now(),
 items jsonb NOT NULL,
 total numeric(16,2) NOT NULL CHECK(total>=0),
 estado_entrega text NOT NULL DEFAULT 'pendiente' CHECK(estado_entrega IN ('pendiente','en_preparacion','enviada','entregada'))
);
CREATE TABLE IF NOT EXISTS public.pagos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 venta_id bigint NOT NULL REFERENCES public.ventas(id),
 fecha timestamptz NOT NULL DEFAULT now(),
 monto numeric(16,2) NOT NULL CHECK(monto>0),
 medio text NOT NULL CHECK(length(btrim(medio)) BETWEEN 1 AND 80),
 referencia text NOT NULL DEFAULT '' CHECK(length(referencia)<=200)
);
CREATE INDEX IF NOT EXISTS fitgear_solicitudes_contacto_fecha ON public.solicitudes(public.fitgear_telefono(telefono),creado_en DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fitgear_un_pedido_por_solicitud ON public.ventas(solicitud_id);
CREATE INDEX IF NOT EXISTS fitgear_solicitudes_cliente ON public.solicitudes(cliente_id,creado_en DESC);
CREATE INDEX IF NOT EXISTS fitgear_seguimientos_cliente ON public.seguimientos(cliente_id,fecha DESC);
CREATE INDEX IF NOT EXISTS fitgear_seguimientos_fecha ON public.seguimientos(siguiente_contacto) WHERE NOT completado;
CREATE INDEX IF NOT EXISTS fitgear_cotizaciones_cliente ON public.cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS fitgear_ventas_cliente ON public.ventas(cliente_id);
CREATE INDEX IF NOT EXISTS fitgear_pagos_venta ON public.pagos(venta_id);

-- Toda la información comercial es privada. No se conceden accesos anónimos.
DO $$
DECLARE tabla text;
BEGIN
 FOREACH tabla IN ARRAY ARRAY['clientes','seguimientos','cotizaciones','ventas','pagos'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tabla);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tabla);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tabla);
   EXECUTE format('DROP POLICY IF EXISTS fitgear_admin ON public.%I',tabla);
   EXECUTE format('CREATE POLICY fitgear_admin ON public.%I FOR ALL TO authenticated USING ((SELECT public.es_admin())) WITH CHECK ((SELECT public.es_admin()))',tabla);
 END LOOP;
END $$;
GRANT INSERT,UPDATE ON public.clientes TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.clientes_id_seq TO authenticated;
-- No se amplía el permiso a datos privados ni a inventario desde la recepción pública.
GRANT UPDATE(estado_comercial,asesor) ON public.solicitudes TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_solicitud_comercial(p_datos jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nombre text:=btrim(coalesce(p_datos->>'nombre',''));
 telefono text:=btrim(coalesce(p_datos->>'telefono',''));
 correo text:=lower(btrim(coalesce(p_datos->>'correo','')));
 mensaje text:=btrim(coalesce(p_datos->>'mensaje',''));
 tipo text:=coalesce(p_datos->>'tipo','catalogo');
 operacion text:=coalesce(p_datos->>'operacion','compra');
 normal text; cid bigint; sid bigint; item jsonb; prod public.productos%ROWTYPE;
 cantidad integer; total integer; detalle jsonb:=p_datos->'personalizada';
BEGIN
 IF jsonb_typeof(p_datos)<>'object' OR octet_length(p_datos::text)>30000 OR
 length(nombre) NOT BETWEEN 3 AND 120 OR telefono !~ '^\+?[0-9 ()-]{8,22}$'
 THEN RAISE EXCEPTION 'Revisa nombre y teléfono'; END IF;
 normal:=public.fitgear_telefono(telefono);
 IF length(normal) NOT BETWEEN 8 AND 15 THEN RAISE EXCEPTION 'Teléfono inválido'; END IF;
 IF correo<>'' AND (length(correo)>254 OR correo !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 THEN RAISE EXCEPTION 'Correo inválido'; END IF;
 IF length(mensaje)>2000 OR coalesce(p_datos->>'website','')<>'' OR
 tipo NOT IN ('catalogo','personalizada') OR operacion NOT IN ('compra','preventa','renta')
 THEN RAISE EXCEPTION 'Solicitud inválida'; END IF;
 -- El bloqueo serializa solicitudes del mismo contacto y evita saltar el límite con concurrencia.
 PERFORM pg_advisory_xact_lock(hashtextextended(normal,0));
 IF EXISTS(SELECT 1 FROM public.solicitudes WHERE public.fitgear_telefono(solicitudes.telefono)=normal AND creado_en>now()-interval '60 seconds')
 OR (SELECT count(*) FROM public.solicitudes WHERE public.fitgear_telefono(solicitudes.telefono)=normal AND creado_en>now()-interval '1 day')>=10
 THEN RAISE EXCEPTION 'Espera un minuto antes de enviar otra solicitud. Máximo diez solicitudes por contacto al día.'; END IF;
 IF tipo='catalogo' THEN
   IF jsonb_typeof(p_datos->'productos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Selecciona máquinas'; END IF;
   total:=jsonb_array_length(p_datos->'productos');
   IF total NOT BETWEEN 1 AND 20 OR total<>(SELECT count(DISTINCT value->>'producto_id') FROM jsonb_array_elements(p_datos->'productos'))
   THEN RAISE EXCEPTION 'Selecciona entre una y veinte máquinas distintas'; END IF;
 ELSE
   IF jsonb_typeof(detalle) IS DISTINCT FROM 'object' OR length(btrim(coalesce(detalle->>'maquina',''))) NOT BETWEEN 1 AND 160
   OR length(coalesce(detalle->>'marca',''))>100 OR coalesce(detalle->>'cantidad','') !~ '^[0-9]{1,3}$'
   OR (detalle->>'cantidad')::integer NOT BETWEEN 1 AND 999
   THEN RAISE EXCEPTION 'Completa la máquina y cantidad que necesitas'; END IF;
   IF coalesce(detalle->>'presupuesto','')<>'' AND
     (NOT (detalle->>'presupuesto' ~ '^[0-9]{1,10}(\.[0-9]{1,2})?$'))
   THEN RAISE EXCEPTION 'Presupuesto inválido'; END IF;
 END IF;
 -- Nunca sobrescribe la ficha privada al recibir otro formulario público.
 INSERT INTO public.clientes(nombre,telefono,telefono_normalizado,whatsapp,correo,origen)
 VALUES(nombre,telefono,normal,telefono,correo,'catalogo_web') ON CONFLICT(telefono_normalizado) DO NOTHING;
 SELECT id INTO cid FROM public.clientes WHERE telefono_normalizado=normal;
 INSERT INTO public.solicitudes(nombre,telefono,correo,mensaje,cliente_id,tipo,operacion,origen,personalizada)
 VALUES(nombre,telefono,correo,mensaje,cid,tipo,operacion,'catalogo_web',CASE WHEN tipo='personalizada' THEN detalle ELSE NULL END)
 RETURNING id INTO sid;
 IF tipo='catalogo' THEN
   FOR item IN SELECT value FROM jsonb_array_elements(p_datos->'productos') ORDER BY (value->>'producto_id')::bigint LOOP
     IF coalesce(item->>'cantidad','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
     cantidad:=(item->>'cantidad')::integer;
     IF cantidad NOT BETWEEN 1 AND 999 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
     SELECT * INTO prod FROM public.productos WHERE id=(item->>'producto_id')::bigint AND publicado=true FOR SHARE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Una máquina seleccionada ya no está publicada'; END IF;
     INSERT INTO public.solicitud_productos(solicitud_id,producto_id,nombre_producto,cantidad,marca_producto,modelo_producto,imagen_producto)
     VALUES(sid,prod.id,prod.nombre,cantidad,prod.marca,coalesce(to_jsonb(prod)->>'modelo',''),coalesce(prod.imagen_url,''));
   END LOOP;
 END IF;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.registrar_solicitud_comercial(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_solicitud_comercial(jsonb) TO anon,authenticated;

-- Compatibilidad con versiones anteriores; aplica también límites y deduplicación.
CREATE OR REPLACE FUNCTION public.registrar_solicitud(p_nombre text,p_telefono text,p_correo text,p_mensaje text,p_productos bigint[])
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN public.registrar_solicitud_comercial(jsonb_build_object('nombre',p_nombre,'telefono',p_telefono,'correo',p_correo,'mensaje',p_mensaje,
 'productos',(SELECT jsonb_agg(jsonb_build_object('producto_id',x,'cantidad',1)) FROM unnest(p_productos) x)));
END $$;
REVOKE ALL ON FUNCTION public.registrar_solicitud(text,text,text,text,bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_solicitud(text,text,text,text,bigint[]) TO anon,authenticated;

-- Reutiliza la recepción existente para contactos registrados por el administrador.
CREATE OR REPLACE FUNCTION public.registrar_solicitud_interna(p_cliente bigint,p_datos jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cliente public.clientes%ROWTYPE; nuevo bigint;
BEGIN
 IF NOT coalesce(public.es_admin(),false) THEN RAISE EXCEPTION 'Acceso ADMIN requerido'; END IF;
 SELECT * INTO cliente FROM public.clientes WHERE id=p_cliente;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente inexistente'; END IF;
 nuevo:=public.registrar_solicitud_comercial(p_datos||jsonb_build_object('nombre',cliente.nombre,'telefono',cliente.telefono,'correo',cliente.correo));
 UPDATE public.solicitudes SET origen=cliente.origen,asesor=cliente.asesor WHERE id=nuevo;
 RETURN nuevo;
END $$;
REVOKE ALL ON FUNCTION public.registrar_solicitud_interna(bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_solicitud_interna(bigint,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_seguimiento(p_datos jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nuevo bigint; cid bigint:=(p_datos->>'cliente_id')::bigint; sid bigint:=nullif(p_datos->>'solicitud_id','')::bigint;
BEGIN
 IF NOT coalesce(public.es_admin(),false) THEN RAISE EXCEPTION 'Acceso ADMIN requerido'; END IF;
 IF sid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.solicitudes WHERE id=sid AND cliente_id=cid)
 THEN RAISE EXCEPTION 'La solicitud no pertenece al cliente'; END IF;
 INSERT INTO public.seguimientos(cliente_id,solicitud_id,fecha,medio,responsable,resumen,respuesta,acuerdos,proxima_accion,siguiente_contacto)
 VALUES(cid,sid,coalesce(nullif(p_datos->>'fecha','')::timestamptz,now()),p_datos->>'medio',p_datos->>'responsable',p_datos->>'resumen',
 coalesce(p_datos->>'respuesta',''),coalesce(p_datos->>'acuerdos',''),coalesce(p_datos->>'proxima_accion',''),nullif(p_datos->>'siguiente_contacto','')::timestamptz)
 RETURNING id INTO nuevo;
 -- Una llamada no equivale a ganar o finalizar una oportunidad.
 UPDATE public.solicitudes SET estado_comercial='en_seguimiento' WHERE id=sid AND estado_comercial IN ('nueva','contactada');
 RETURN nuevo;
END $$;
CREATE OR REPLACE FUNCTION public.completar_seguimiento(p_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(public.es_admin(),false) THEN RAISE EXCEPTION 'Acceso ADMIN requerido'; END IF;
 UPDATE public.seguimientos SET completado=true,completado_en=now() WHERE id=p_id AND NOT completado;
 IF NOT FOUND THEN RAISE EXCEPTION 'El seguimiento no existe o ya está completado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guardar_cotizacion(p_datos jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sol public.solicitudes%ROWTYPE; item jsonb; partidas jsonb:='[]'; total numeric:=0;
 cantidad integer; precio numeric; nuevo bigint; pid bigint; nombre text;
BEGIN
 IF NOT coalesce(public.es_admin(),false) THEN RAISE EXCEPTION 'Acceso ADMIN requerido'; END IF;
 SELECT * INTO sol FROM public.solicitudes WHERE id=(p_datos->>'solicitud_id')::bigint FOR UPDATE;
 IF NOT FOUND OR sol.cliente_id IS NULL THEN RAISE EXCEPTION 'Solicitud sin cliente'; END IF;
 IF jsonb_typeof(p_datos->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos->'items') NOT BETWEEN 1 AND 20
 THEN RAISE EXCEPTION 'Agrega entre uno y veinte equipos a la cotización'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_datos->'items') LOOP
   IF coalesce(item->>'cantidad','') !~ '^[0-9]{1,3}$' OR coalesce(item->>'precio','') !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$'
   THEN RAISE EXCEPTION 'Precio o cantidad inválidos'; END IF;
   cantidad:=(item->>'cantidad')::integer;precio:=(item->>'precio')::numeric;pid:=nullif(item->>'producto_id','')::bigint;
   IF cantidad<1 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
   IF pid IS NOT NULL THEN
     SELECT nombre_producto INTO nombre FROM public.solicitud_productos WHERE solicitud_id=sol.id AND producto_id=pid;
     IF NOT FOUND THEN RAISE EXCEPTION 'El producto no está relacionado con esta solicitud'; END IF;
   ELSE
     nombre:=btrim(coalesce(item->>'nombre',''));
     IF length(nombre) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Nombre de equipo inválido'; END IF;
   END IF;
   partidas:=partidas||jsonb_build_array(jsonb_build_object('producto_id',pid,'nombre',nombre,'cantidad',cantidad,'precio',precio));
   total:=total+cantidad*precio;
 END LOOP;
 INSERT INTO public.cotizaciones(cliente_id,solicitud_id,vence_en,items,total,notas)
 VALUES(sol.cliente_id,sol.id,nullif(p_datos->>'vence_en','')::date,partidas,total,coalesce(p_datos->>'notas','')) RETURNING id INTO nuevo;
 UPDATE public.solicitudes SET estado_comercial='cotizada' WHERE id=sol.id AND estado_comercial NOT IN ('ganada','perdida');
 RETURN nuevo;
END $$;
CREATE OR REPLACE FUNCTION public.cambiar_cotizacion(p_id bigint,p_estado text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(public.es_admin(),false) THEN RAISE EXCEPTION 'Acceso ADMIN requerido'; END IF;
 IF p_estado NOT IN ('borrador','enviada','aceptada','rechazada','vencida') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 UPDATE public.cotizaciones SET estado=p_estado WHERE id=p_id AND estado<>'convertida';
 IF NOT FOUND THEN RAISE EXCEPTION 'La cotización no existe o ya tiene un pedido'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.confirmar_venta(p_cotizacion bigint,p_anticipo numeric DEFAULT 0)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cot public.cotizaciones%ROWTYPE; item record; disponible integer; nuevo bigint;
BEGIN
 IF NOT coalesce(public.es_admin(),false) THEN RAISE EXCEPTION 'Acceso ADMIN requerido'; END IF;
 SELECT * INTO cot FROM public.cotizaciones WHERE id=p_cotizacion FOR UPDATE;
 IF NOT FOUND OR cot.estado<>'aceptada' THEN RAISE EXCEPTION 'Primero marca la cotización como aceptada'; END IF;
 PERFORM id FROM public.solicitudes WHERE id=cot.solicitud_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.ventas WHERE solicitud_id=cot.solicitud_id) THEN RAISE EXCEPTION 'Esta solicitud ya tiene un pedido confirmado'; END IF;
 IF cot.vence_en IS NOT NULL AND cot.vence_en<(now() AT TIME ZONE 'America/Guatemala')::date THEN RAISE EXCEPTION 'La cotización está vencida'; END IF;
 IF p_anticipo IS NULL OR p_anticipo<0 OR p_anticipo>cot.total OR p_anticipo<>round(p_anticipo,2) THEN RAISE EXCEPTION 'Anticipo inválido'; END IF;
 -- Orden estable de bloqueo: ventas concurrentes no descuentan dos veces las mismas unidades.
 FOR item IN SELECT (value->>'producto_id')::bigint AS pid,sum((value->>'cantidad')::integer)::integer AS cantidad
   FROM jsonb_array_elements(cot.items) WHERE value->>'producto_id' IS NOT NULL GROUP BY 1 ORDER BY 1 LOOP
   SELECT existencias INTO disponible FROM public.productos WHERE id=item.pid FOR UPDATE;
   IF NOT FOUND OR disponible<item.cantidad THEN RAISE EXCEPTION 'Existencias insuficientes para el producto %',item.pid; END IF;
   UPDATE public.productos SET existencias=existencias-item.cantidad,
    estado=CASE WHEN existencias-item.cantidad=0 THEN 'vendida' ELSE estado END WHERE id=item.pid;
 END LOOP;
 INSERT INTO public.ventas(cliente_id,solicitud_id,cotizacion_id,items,total)
 VALUES(cot.cliente_id,cot.solicitud_id,cot.id,cot.items,cot.total) RETURNING id INTO nuevo;
 IF p_anticipo>0 THEN INSERT INTO public.pagos(venta_id,monto,medio,referencia) VALUES(nuevo,p_anticipo,'anticipo','Anticipo al confirmar pedido'); END IF;
 UPDATE public.cotizaciones SET estado='convertida' WHERE id=cot.id;
 UPDATE public.solicitudes SET estado_comercial='ganada' WHERE id=cot.solicitud_id;
 RETURN nuevo;
END $$;
CREATE OR REPLACE FUNCTION public.registrar_pago(p_venta bigint,p_monto numeric,p_medio text,p_referencia text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE importe numeric; pagado numeric;
BEGIN
 IF NOT coalesce(public.es_admin(),false) THEN RAISE EXCEPTION 'Acceso ADMIN requerido'; END IF;
 SELECT total INTO importe FROM public.ventas WHERE id=p_venta FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido inexistente'; END IF;
 SELECT coalesce(sum(monto),0) INTO pagado FROM public.pagos WHERE venta_id=p_venta;
 IF p_monto IS NULL OR p_monto<=0 OR p_monto<>round(p_monto,2) OR p_monto>importe-pagado THEN RAISE EXCEPTION 'El pago debe ser mayor a cero y no superar el saldo'; END IF;
 INSERT INTO public.pagos(venta_id,monto,medio,referencia) VALUES(p_venta,p_monto,p_medio,coalesce(p_referencia,''));
END $$;
GRANT UPDATE(estado_entrega) ON public.ventas TO authenticated;

-- Solo ADMIN ejecuta las acciones comerciales; ninguna RPC admite inventario arbitrario.
REVOKE ALL ON FUNCTION public.guardar_seguimiento(jsonb),public.completar_seguimiento(bigint),public.guardar_cotizacion(jsonb),public.cambiar_cotizacion(bigint,text),public.confirmar_venta(bigint,numeric),public.registrar_pago(bigint,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.guardar_seguimiento(jsonb),public.completar_seguimiento(bigint),public.guardar_cotizacion(jsonb),public.cambiar_cotizacion(bigint,text),public.confirmar_venta(bigint,numeric),public.registrar_pago(bigint,numeric,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
