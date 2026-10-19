
import { AdminModel } from "./models/AdminModel.js?v=14";
import { AdminView } from "./views/AdminView.js?v=14";
import { AdminController } from "./controllers/AdminController.js?v=14";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
