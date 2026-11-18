"use client";

import { SEED_IDENTITIES, type Identity } from "./data";
import { useSessionState } from "./use-session-state";

const ANONYMOUS = SEED_IDENTITIES[0];
const EMPTY: Identity[] = [ANONYMOUS];

/** Identidades de un proyecto. TODO(api): sustituir por la API; solo `pedidos` trae ejemplos. */
export function useIdentities(projectId: string) {
  const [identities, setIdentities] = useSessionState<Identity[]>(
    `hindama.identities.${projectId}`,
    projectId === "pedidos" ? SEED_IDENTITIES : EMPTY,
  );

  return {
    identities,
    save(identity: Identity) {
      setIdentities((list) =>
        list.some((i) => i.id === identity.id)
          ? list.map((i) => (i.id === identity.id ? identity : i))
          : [...list, identity],
      );
    },
    remove(id: string) {
      setIdentities((list) => list.filter((i) => i.id !== id));
    },
  };
}

export function identityId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "identidad";
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}
