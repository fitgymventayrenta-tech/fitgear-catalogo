
import { supabaseConfig } from "../../../js/config/supabase.js";

export class AdminModel {
  constructor() {
    this.url = String(supabaseConfig.url || "")
      .trim()
      .replace(/\/+$/, "");

    this.key = String(supabaseConfig.key || "").trim();

    this.token = null;
    this.expira = 0;

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(this.url)) {
      throw new Error(
        "La Project URL de Supabase es incorrecta. " +
        "Revisa js/config/supabase.js."
      );
    }

    if (!this.key.startsWith("sb_publishable_") &&
        !this.key.startsWith("eyJ")) {
      throw new Error(
        "La Publishable key de Supabase no es válida."
      );
    }
  }

  async solicitar(ruta, opciones = {}, autenticado = true) {
    if (autenticado && !this.token) {
      throw new Error("Debes iniciar sesión.");
    }

    const headers = {
      apikey: this.key,
      Accept: "application/json",
      ...(opciones.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(autenticado
        ? { Authorization: `Bearer ${this.token}` }
        : {}),
      ...opciones.headers
    };

    const urlCompleta = `${this.url}${ruta}`;

    const respuesta = await fetch(urlCompleta, {
      ...opciones,
      headers
    });

    if (!respuesta.ok) {
      let detalle = `Error HTTP ${respuesta.status}`;

      try {
        const datos = await respuesta.json();
        detalle =
          datos.msg ||
          datos.message ||
          datos.error_description ||
          datos.error ||
          detalle;
      } catch {}

      if (respuesta.status === 401) {
        this.cerrarSesion();
      }

      throw new Error(detalle);
    }

    if (respuesta.status === 204) return null;

    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;
  }

  async iniciarSesion(email, password) {
    const datos = await this.solicitar(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      },
      false
    );

    if (!datos.access_token) {
      throw new Error(
        "Supabase no devolvió un token de acceso."
      );
    }

    this.token = datos.access_token;

    this.expira = Date.now() +
      (datos.expires_in || 3600) * 1000;

    try {
      const autorizado = await this.esAdministrador();

      if (!autorizado) {
        throw new Error(
          "Esta cuenta no tiene permisos ADMIN."
        );
      }
    } catch (error) {
      this.cerrarSesion();
      throw error;
    }

    return true;
  }

  async esAdministrador() {
    const resultado = await this.solicitar(
      "/rest/v1/rpc/es_admin",
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );

    return resultado === true;
  }

  comprobarSesion() {
    if (!this.token || Date.now() >= this.expira) {
      this.cerrarSesion();
      throw new Error(
        "La sesión ha expirado. Inicia sesión otra vez."
      );
    }
  }

  async obtenerProductos() {
    this.comprobarSesion();

    return await this.solicitar(
      "/rest/v1/productos?select=*&order=id.desc"
    );
  }

  async guardarProducto(producto) {
    this.comprobarSesion();

    const { id, ...datos } = producto;

    if (id) {
      return await this.solicitar(
        `/rest/v1/productos?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(datos)
        }
      );
    }

    return await this.solicitar(
      "/rest/v1/productos",
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(datos)
      }
    );
  }

  async eliminarProducto(id) {
    this.comprobarSesion();

    return await this.solicitar(
      `/rest/v1/productos?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );
  }

  cerrarSesion() {
    this.token = null;
    this.expira = 0;
  }
}
