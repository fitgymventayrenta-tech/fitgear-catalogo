
import { AdminModel } from "./AdminModel.js?v=21";
import { AdminView } from "./AdminView.js?v=21";
import { AdminController } from "./AdminController.js?v=21";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
