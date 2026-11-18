"use client";

import { useSyncExternalStore } from "react";
import { SEED_PROJECTS, type Project } from "./seed";

export { SEED_PROJECTS, SEVERITY_ORDER } from "./seed";
export type { ModuleResult, Project, ProjectReport } from "./seed";

const KEY = "hindama.projects";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Project[] } = { raw: "\u0000", value: SEED_PROJECTS };

function read(): Project[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return cache.value;
  }
  if (raw === cache.raw) return cache.value;
  let value = SEED_PROJECTS;
  if (raw) {
    try {
      value = JSON.parse(raw) as Project[];
    } catch {
      value = SEED_PROJECTS;
    }
  }
  cache = { raw, value };
  return value;
}

function write(next: Project[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    cache = { raw: "\u0001", value: next };
  }
  listeners.forEach((l) => l());
}

export function useProjects(): Project[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => SEED_PROJECTS,
  );
}

export function useProject(id: string): Project | undefined {
  return useProjects().find((p) => p.id === id);
}

export function slugify(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "proyecto";
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}

export function createProject(input: {
  name: string;
  description: string;
  baseUrl: string;
}): Project {
  const current = read();
  const project: Project = {
    id: slugify(
      input.name,
      current.map((p) => p.id),
    ),
    name: input.name,
    description: input.description,
    baseUrl: input.baseUrl,
    verified: false,
    concluded: false,
    lastRun: null,
    openFindings: null,
    policy: null,
    contractOps: null,
    identities: 0,
    resources: 0,
    report: null,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  write([...current, project]);
  return project;
}

export function updateProject(id: string, patch: Partial<Project>) {
  write(read().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
