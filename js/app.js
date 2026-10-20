
import { ProductoModel } from "./ProductoModel.js?v=23";
import { CatalogoView } from "./CatalogoView.js?v=23";
import { CatalogoController } from "./CatalogoController.js?v=23";

const modelo = new ProductoModel();
const vista = new CatalogoView();

const controlador = new CatalogoController(modelo, vista);

controlador.iniciar();

const anio = document.querySelector("#anio-actual");

if (anio) {
  anio.textContent = new Date().getFullYear();
}
