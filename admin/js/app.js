
import { AdminModel } from "./models/AdminModel.js";
import { AdminView } from "./views/AdminView.js";
import { AdminController } from "./controllers/AdminController.js";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
