import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function Table({ headers, children, className }: { headers: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-white", className)}>
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2);
  return (
    <nav aria-label="Страницы" className="mt-5 flex flex-wrap items-center gap-1.5">
      {nums.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - nums[i - 1]! > 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={makeHref(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn("inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold", p === page ? "bg-ink text-paper" : "bg-white hover:bg-paper-2")}
          >
            {p}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <form className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</form>;
}

export const filterInput = "rounded-xl border border-line bg-white px-3 py-2 text-sm";
