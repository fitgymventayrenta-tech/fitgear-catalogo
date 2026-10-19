
import { ProductoModel } from "./models/ProductoModel.js?v=14";
import { CatalogoView } from "./views/CatalogoView.js?v=14";
import { CatalogoController } from "./controllers/CatalogoController.js?v=14";

const modelo = new ProductoModel();
const vista = new CatalogoView();

const controlador = new CatalogoController(modelo, vista);

controlador.iniciar();

const anio = document.querySelector("#anio-actual");

if (anio) {
  anio.textContent = new Date().getFullYear();
}
