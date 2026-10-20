
import { AdminModel } from "./AdminModel.js?v=20";
import { AdminView } from "./AdminView.js?v=20";
import { AdminController } from "./AdminController.js?v=20";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
