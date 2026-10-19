-- Ejecutar TODO este archivo una vez en SQL Editor de Supabase.
-- Corrige el guardado y PUBLICA las 39 fichas cargadas. No importa ni borra máquinas.
BEGIN;
ALTER TABLE public.productos ALTER COLUMN precio DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.fitgear_validar_inventario()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
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
END $$;
DROP TRIGGER IF EXISTS fitgear_inventario ON public.productos;
CREATE TRIGGER fitgear_inventario BEFORE INSERT OR UPDATE ON public.productos
 FOR EACH ROW EXECUTE FUNCTION public.fitgear_validar_inventario();
-- Publica únicamente las 39 fichas de la lista que ya se importó.
-- No inserta productos y conserva precios, fotografías, ofertas y existencias.
UPDATE public.productos p SET publicado=true
FROM (VALUES
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
WHERE regexp_replace(translate(lower(coalesce(p.nombre,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=regexp_replace(translate(lower(coalesce(lista.nombre,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')
 AND regexp_replace(regexp_replace(translate(lower(coalesce(p.marca,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g'),'(signature|inspiration)$','')=
 regexp_replace(regexp_replace(translate(lower(coalesce(lista.marca,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g'),'(signature|inspiration)$','');
NOTIFY pgrst,'reload schema';
COMMIT;

SELECT marca,count(*) AS fichas,
 count(*) FILTER(WHERE publicado) AS visibles_en_catalogo,
 count(*) FILTER(WHERE NOT publicado) AS sin_publicar
FROM public.productos GROUP BY marca ORDER BY marca;
