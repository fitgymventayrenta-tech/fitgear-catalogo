
import { ProductoModel } from "./ProductoModel.js?v=21";
import { CatalogoView } from "./CatalogoView.js?v=21";
import { CatalogoController } from "./CatalogoController.js?v=21";

const modelo = new ProductoModel();
const vista = new CatalogoView();

const controlador = new CatalogoController(modelo, vista);

controlador.iniciar();

const anio = document.querySelector("#anio-actual");

if (anio) {
  anio.textContent = new Date().getFullYear();
}
