
import { AdminModel } from "./AdminModel.js?v=23";
import { AdminView } from "./AdminView.js?v=23";
import { AdminController } from "./AdminController.js?v=23";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
