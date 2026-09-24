"use client";

import { useMemo, useState } from "react";
import { AUDIENCES } from "@drago/shared";
import { Select } from "@/components/ui/form";

export function AudienceSelect({ name = "minRoleLevel", defaultValue = 20, includeAll = true }: { name?: string; defaultValue?: number; includeAll?: boolean }) {
  return (
    <Select name={name} defaultValue={String(defaultValue)}>
      {AUDIENCES.filter((a) => includeAll || a.level > 10).map((a) => (
        <option key={a.level} value={a.level}>
          {a.label}
        </option>
      ))}
    </Select>
  );
}

/** Множественный выбор пользователей с поиском (удобнее <select multiple> на телефоне). */
export function UserMultiSelect({
  name,
  users,
  defaultSelected = [],
}: {
  name: string;
  users: { id: string; name: string; role: string }[];
  defaultSelected?: string[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)) : users;
  }, [query, users]);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="rounded-xl border border-line bg-white">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={`${name}[]`} value={id} />
      ))}
      <div className="flex items-center gap-2 border-b border-line p-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или роли"
          aria-label="Поиск пользователей"
          className="w-full rounded-lg bg-paper px-3 py-1.5 text-sm outline-none"
        />
        <span className="shrink-0 text-xs text-muted">выбрано: {selected.size}</span>
      </div>
      <div className="flex gap-2 border-b border-line px-3 py-1.5 text-xs">
        <button type="button" className="font-semibold text-fire" onClick={() => setSelected(new Set([...selected, ...filtered.map((u) => u.id)]))}>
          Выбрать найденных
        </button>
        <button type="button" className="text-muted" onClick={() => setSelected(new Set())}>
          Снять всё
        </button>
      </div>
      <ul className="max-h-60 overflow-y-auto p-1">
        {filtered.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-paper">
              <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="size-4 accent-fire" />
              <span className="flex-1">{u.name}</span>
              <span className="text-xs text-muted">{u.role}</span>
            </label>
          </li>
        ))}
        {filtered.length === 0 && <li className="p-3 text-center text-sm text-muted">Никого не найдено</li>}
      </ul>
    </div>
  );
}
