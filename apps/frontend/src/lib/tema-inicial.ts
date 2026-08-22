/**
 * Clave del tema elegido. Vive aqui, y no junto al hook, porque este modulo lo
 * lee el servidor: importarla de un modulo "use client" no trae el valor, sino
 * un sustituto que falla al evaluarse fuera del navegador.
 */
export const THEME_STORAGE_KEY = "ui:v1:theme";

/**
 * Script que aplica el tema guardado antes del primer pintado, para que quien
 * lo tenga en oscuro no vea un destello blanco al cargar.
 */
export const SCRIPT_DE_TEMA = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
