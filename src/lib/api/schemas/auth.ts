import { z } from "zod";
import { zEmail, zText } from "../zod";

/**
 * Cuerpos de las rutas de acceso del BFF (`/api/auth/*`). No son operaciones de la API: el BFF
 * llama a Cognito (guía del frontend §2.3). Los valida el formulario y otra vez el servidor.
 * Contraseñas: sin recortar (los espacios cuentan) y como máximo 256 caracteres, el límite de
 * Cognito; la política (12 caracteres, mayúsculas, minúsculas, números y símbolos) la aplica
 * Cognito y el formulario solo la anticipa (guía §2.2, RF-03).
 */

const password = zText({ min: 1, max: 256, raw: true });
const newPassword = zText({ min: 12, max: 256, raw: true });
/** Código de 6 dígitos del correo (RF-02, RF-05). */
const code = z.string().regex(/^\d{6}$/, { message: "validation.format" });

export const signInSchema = z.strictObject({ email: zEmail, password });
export const signUpSchema = z.strictObject({
  name: zText({ min: 1, max: 100 }),
  email: zEmail,
  password: newPassword,
});
export const confirmSignUpSchema = z.strictObject({ email: zEmail, code });
export const emailOnlySchema = z.strictObject({ email: zEmail });
export const resetPasswordSchema = z.strictObject({ email: zEmail, code, password: newPassword });

/** Respuesta de `POST /api/auth/sign-in`: el token anti-CSRF y el rol de `GET /me`. */
export const signInResultSchema = z.object({
  csrf_token: z.string().min(1),
  role: z.enum(["analyst", "admin"]).nullable(),
});
