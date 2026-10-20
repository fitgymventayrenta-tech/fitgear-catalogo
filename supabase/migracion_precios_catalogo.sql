-- Ejecutar TODO en SQL Editor antes de publicar esta versión.
-- Conserva productos, precios normales, precios especiales y condiciones existentes.
BEGIN;
ALTER TABLE public.productos
 ADD COLUMN IF NOT EXISTS preventa boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS precio_especial numeric,
 ADD COLUMN IF NOT EXISTS precio_oferta numeric;
CREATE OR REPLACE FUNCTION public.fitgear_validar_precios()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE importe numeric;
BEGIN
 FOREACH importe IN ARRAY ARRAY[NEW.precio,NEW.precio_especial,NEW.precio_oferta] LOOP
  IF importe IS NOT NULL AND (importe::text IN ('NaN','Infinity','-Infinity') OR importe<0 OR importe>9999999999 OR importe<>round(importe,2)) THEN
   RAISE EXCEPTION 'Los precios deben ser importes válidos con hasta dos decimales';
  END IF;
 END LOOP;
 IF NEW.preventa AND NEW.precio_especial IS NULL THEN RAISE EXCEPTION 'Indica el precio de preventa'; END IF;
 IF NEW.oferta AND (NEW.precio IS NULL OR NEW.precio_oferta IS NULL OR NEW.precio_oferta>=NEW.precio) THEN
  RAISE EXCEPTION 'El precio de oferta debe ser inferior al precio normal';
 END IF;
 IF NEW.oferta AND NEW.preventa AND NEW.precio_oferta>=NEW.precio_especial THEN
  RAISE EXCEPTION 'La oferta también debe ser inferior al precio de preventa';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fitgear_precios ON public.productos;
CREATE TRIGGER fitgear_precios BEFORE INSERT OR UPDATE OF precio,precio_especial,precio_oferta,preventa,oferta
 ON public.productos FOR EACH ROW EXECUTE FUNCTION public.fitgear_validar_precios();
NOTIFY pgrst,'reload schema';
COMMIT;
