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
    // Sección activa: la última cuyo borde superior ya pasó el 30 % del alto de la ventana;
    // al llegar al final de la página, la última.
    function update() {
      const line = window.innerHeight * 0.3;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= line) current = item.id;
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom && items.length > 0) current = items[items.length - 1].id;
      setActive(current);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
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
