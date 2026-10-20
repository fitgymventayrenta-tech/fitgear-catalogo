
import { AdminModel } from "./AdminModel.js?v=22";
import { AdminView } from "./AdminView.js?v=22";
import { AdminController } from "./AdminController.js?v=22";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
