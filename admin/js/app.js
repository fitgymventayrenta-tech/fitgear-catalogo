
import { AdminModel } from "./models/AdminModel.js?v=18";
import { AdminView } from "./views/AdminView.js?v=18";
import { AdminController } from "./controllers/AdminController.js?v=18";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
