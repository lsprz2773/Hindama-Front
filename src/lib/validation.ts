/** Validación mínima de formato de correo; la verificación real la hace la API. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
