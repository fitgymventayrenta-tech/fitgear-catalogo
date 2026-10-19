
import { AdminModel } from "./models/AdminModel.js?v=15";
import { AdminView } from "./views/AdminView.js?v=15";
import { AdminController } from "./controllers/AdminController.js?v=15";

const modelo = new AdminModel();
const vista = new AdminView();
const controlador = new AdminController(modelo, vista);

controlador.iniciar();
