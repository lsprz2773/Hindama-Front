/** Reglas de contraseña del RF-03: 12 caracteres, mayúscula, minúscula, número y símbolo. */
export const PASSWORD_RULES = [
  { id: "length", test: (v: string) => v.length >= 12 },
  { id: "upper", test: (v: string) => /\p{Lu}/u.test(v) },
  { id: "lower", test: (v: string) => /\p{Ll}/u.test(v) },
  { id: "digit", test: (v: string) => /\d/.test(v) },
  { id: "symbol", test: (v: string) => /[^\p{L}\p{N}\s]/u.test(v) },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

export function checkPassword(value: string): Record<PasswordRuleId, boolean> {
  return Object.fromEntries(PASSWORD_RULES.map((r) => [r.id, r.test(value)])) as Record<
    PasswordRuleId,
    boolean
  >;
}

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(value));
}
