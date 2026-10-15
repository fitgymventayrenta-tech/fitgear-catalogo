
import { ProductoModel } from "./models/ProductoModel.js";
import { CatalogoView } from "./views/CatalogoView.js";
import { CatalogoController } from "./controllers/CatalogoController.js";

const modelo = new ProductoModel();
const vista = new CatalogoView();

const controlador = new CatalogoController(modelo, vista);

controlador.iniciar();

document.getElementById("anio-actual").textContent =
  new Date().getFullYear();
