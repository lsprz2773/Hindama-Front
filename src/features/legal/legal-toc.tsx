"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface Item {
  id: string;
  n: number;
  title: string;
}

/** Índice del documento; resalta la sección que se está leyendo. */
export function LegalToc({
  label,
  heading,
  items,
}: {
  label: string;
  heading: string;
  items: Item[];
}) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label={label}
      className="border-line bg-panel flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 rounded-[28px] border p-5 backdrop-blur-lg lg:sticky lg:top-6"
    >
      <span className="text-muted px-2.5 pb-1.5 text-[13px]">{heading}</span>
      {items.map((item) => {
        const current = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={current ? "location" : undefined}
            onClick={() => setActive(item.id)}
            className={cn(
              "text-fg flex gap-2.5 rounded-xl p-2.5 text-[14.5px] no-underline",
              current && "bg-selected",
            )}
          >
            <span className="text-accent min-w-[18px] font-bold">{item.n}</span>
            {item.title}
          </a>
        );
      })}
    </nav>
  );
}
