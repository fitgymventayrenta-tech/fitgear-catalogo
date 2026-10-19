-- COPIAR TODO ESTE ARCHIVO AL SQL EDITOR Y EJECUTAR.
-- 39 fichas: 23 Hammer Strength, 11 Life Fitness Signature, 1 Matrix y 4 Nautilus.
-- Matrix: una sola ficha con seis unidades. Los demás inventarios quedan por confirmar.
-- Nuevos productos visibles en catálogo: sin precio ni fotos inventados.
-- Un solo bloque atómico, SIN tablas ni funciones temporales y SIN dependencias de sesión.
-- Si algo falla, PostgreSQL revierte todo el bloque. Repetir no duplica ni repone stock.
DO $importacion$
DECLARE
 fila record;
 clave_nombre text;
 clave_marca text;
 coincidencias integer;
 nuevos integer:=0;
BEGIN
 ALTER TABLE public.productos ALTER COLUMN precio DROP NOT NULL;
 -- El precio desconocido se muestra como Precio a consultar.
 EXECUTE $definicion$
CREATE OR REPLACE FUNCTION public.fitgear_validar_inventario()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $validacion$
BEGIN
 IF NEW.nombre IS NULL OR length(btrim(NEW.nombre)) NOT BETWEEN 1 AND 160
 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
 IF NEW.marca IS NULL OR length(btrim(NEW.marca)) NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'Marca inválida'; END IF;
 IF length(coalesce(NEW.descripcion,''))>5000 THEN RAISE EXCEPTION 'Descripción demasiado larga'; END IF;
 IF NEW.existencias IS NULL OR NEW.existencias<0 OR NEW.existencias<>trunc(NEW.existencias)
 THEN RAISE EXCEPTION 'Existencias inválidas'; END IF;
 IF NEW.precio IS NOT NULL AND (NEW.precio<0 OR NEW.precio>9999999999)
 THEN RAISE EXCEPTION 'Precio inválido'; END IF;
 IF NEW.estado IS NULL OR NEW.estado NOT IN ('disponible','reservada','vendida')
 THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF TG_OP='UPDATE' AND OLD.existencias=0 AND NEW.existencias>0 AND NEW.estado='vendida' AND OLD.estado='vendida' THEN NEW.estado:='disponible'; END IF;
 IF NEW.existencias=0 THEN NEW.estado:='vendida'; END IF;
 IF NEW.existencias>0 AND NEW.estado='vendida' THEN
   RAISE EXCEPTION 'Si quedan unidades, reduce las existencias sin marcar toda la máquina como vendida';
 END IF;
 NEW.nombre:=btrim(NEW.nombre);
 NEW.marca:=btrim(NEW.marca);
 NEW.moneda:='GTQ';
 RETURN NEW;
END $validacion$;
 $definicion$;
 LOCK TABLE public.productos IN SHARE ROW EXCLUSIVE MODE;
 -- Retira solamente la descripción de prueba de la ficha existente si sigue intacta.
-- No altera una ficha que ya tenga precio, foto, inventario o descripción reales.
UPDATE public.productos SET descripcion=NULL
 WHERE lower(btrim(nombre))='linear leg press' AND lower(btrim(marca))='hammer strength'
 AND btrim(descripcion)='Registro de prueba para verificar la conexión.'
 AND precio IS NULL AND existencias=0 AND coalesce(imagen_url,'')=''
 AND coalesce(to_jsonb(productos)->'imagenes','[]'::jsonb)='[]'::jsonb;
 FOR fila IN
  SELECT * FROM (VALUES
 ('Linear Leg Press','Hammer Strength',0,NULL),
 ('Linear Hack Squat','Hammer Strength',0,NULL),
 ('Hammer Strength Select Leg Extension','Hammer Strength',0,NULL),
 ('Hammer Strength Glute Drive','Hammer Strength',0,NULL),
 ('Hammer Strength Select Leg Curl','Hammer Strength',0,NULL),
 ('Iso-Lateral Chest/Back','Hammer Strength',0,NULL),
 ('Abductor/Adductor Dual Function','Hammer Strength',0,NULL),
 ('Plate Loaded Pendulum-X Squat','Hammer Strength',0,NULL),
 ('Iso-Lateral Low Row','Hammer Strength',0,NULL),
 ('Multi-Jungle MJ5','Hammer Strength',0,NULL),
 ('Hammer Strength Select Pectoral Fly/Rear Deltoid','Hammer Strength',0,NULL),
 ('Functional Trainer (DAP)','Hammer Strength',0,NULL),
 ('Iso-Lateral Shoulder Press','Hammer Strength',0,NULL),
 ('Iso-Lateral Super Incline Press','Hammer Strength',0,NULL),
 ('Smith Machine','Hammer Strength',0,NULL),
 ('Iso-Lateral Row','Hammer Strength',0,NULL),
 ('Super V-Squat','Hammer Strength',0,NULL),
 ('Shoulder Press Trainer','Hammer Strength',0,NULL),
 ('Smith Press Rack','Hammer Strength',0,NULL),
 ('Adjustable Bench','Hammer Strength',0,NULL),
 ('Hammer Strength CPU Dumbbells','Hammer Strength',0,NULL),
 ('Hammer Strength CPU Plate','Hammer Strength',0,NULL),
 ('Hammer Strength Double Layer Dumbbell Rack','Hammer Strength',0,NULL),
 ('Life Fitness Signature – Remo','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Chest','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Shoulder','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Leg Extension','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Seated Curl','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Leg Press','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Bíceps','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Tríceps','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Pec Fly / Rear Delt','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Espalda Baja','Life Fitness Signature',0,NULL),
 ('Life Fitness Signature – Lat Pulldown','Life Fitness Signature',0,NULL),
 ('Caminadoras Matrix','Matrix',6,'Cardio'),
 ('Nautilus Inspiration – Pecho','Nautilus Inspiration',0,NULL),
 ('Nautilus Inspiration – Remo Espalda','Nautilus Inspiration',0,NULL),
 ('Nautilus Inspiration – Bíceps','Nautilus Inspiration',0,NULL),
 ('Nautilus Inspiration – Tríceps','Nautilus Inspiration',0,NULL)
  ) AS lista(nombre,marca,existencias,categoria)
 LOOP
  clave_nombre:=regexp_replace(translate(lower(coalesce(fila.nombre,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g');
  clave_marca:=regexp_replace(regexp_replace(translate(lower(coalesce(fila.marca,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g'),'(signature|inspiration)$','');
  SELECT count(*) INTO coincidencias FROM public.productos p
   WHERE regexp_replace(translate(lower(coalesce(p.nombre,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=clave_nombre
     AND regexp_replace(regexp_replace(translate(lower(coalesce(p.marca,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g'),'(signature|inspiration)$','')=clave_marca;
  IF coincidencias>1 THEN
   RAISE EXCEPTION 'Ya hay varias fichas para % de %. Revisa esos duplicados antes de importar.',fila.nombre,fila.marca;
  END IF;
  IF coincidencias=0 THEN
   INSERT INTO public.productos(nombre,marca,categoria,descripcion,precio,moneda,existencias,estado,oferta,publicado)
   VALUES(fila.nombre,fila.marca,fila.categoria,NULL,NULL,'GTQ',fila.existencias,
    CASE WHEN fila.existencias>0 THEN 'disponible' ELSE 'vendida' END,false,true);
   nuevos:=nuevos+1;
  END IF;
 END LOOP;
 PERFORM pg_notify('pgrst','reload schema');
 RAISE NOTICE 'Importación completa: % fichas nuevas; las existentes conservaron sus datos y existencias.',nuevos;
END $importacion$;

-- Comprobación independiente: no depende de tablas temporales ni de la misma sesión.
-- Incluye también otros productos que ya tuvieras registrados.
SELECT marca,count(*) AS fichas_en_inventario,
 count(*) FILTER(WHERE NOT publicado) AS borradores,
 sum(existencias) AS unidades_registradas
FROM public.productos GROUP BY marca ORDER BY marca;
