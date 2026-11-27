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
/** Código TOTP de 6 dígitos del segundo factor (RF-85). */
export const mfaCodeSchema = z.strictObject({ code });
export const signUpSchema = z.strictObject({
  name: zText({ min: 1, max: 100 }),
  email: zEmail,
  password: newPassword,
});
export const confirmSignUpSchema = z.strictObject({ email: zEmail, code });
export const emailOnlySchema = z.strictObject({ email: zEmail });
export const resetPasswordSchema = z.strictObject({ email: zEmail, code, password: newPassword });

/**
 * Respuesta de `POST /api/auth/sign-in` y de `POST /api/auth/mfa/challenge`: o la sesión (el token
 * anti-CSRF, el rol y si tiene el segundo factor, de `GET /me`), o el aviso de que falta el código
 * TOTP (`mfa_required`), que se pide en la pantalla siguiente (ADR-018).
 */
export const signInResultSchema = z.union([
  z.object({ mfa_required: z.literal(true) }),
  z.object({
    csrf_token: z.string().min(1),
    role: z.enum(["analyst", "admin"]).nullable(),
    mfa_enabled: z.boolean().nullable().optional(),
  }),
]);

/** Respuesta de `POST /api/auth/mfa/setup`: la clave TOTP para la app (nunca sale del navegador). */
export const mfaSetupResultSchema = z.object({ secret: z.string().min(16).max(128) });
