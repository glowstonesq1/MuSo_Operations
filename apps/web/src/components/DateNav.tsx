"use client";

import { usePathname, useRouter } from "next/navigation";

export function DateNav({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (d: string) => router.push(`${pathname}?date=${d}`);
  const shift = (days: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    go(d.toISOString().slice(0, 10));
  };
  return (
    <div className="flex items-center gap-1">
      <button className="btn-outline px-2" onClick={() => shift(-1)}>&larr;</button>
      <input
        type="date"
        className="input w-auto"
        value={date}
        onChange={(e) => e.target.value && go(e.target.value)}
      />
      <button className="btn-outline px-2" onClick={() => shift(1)}>&rarr;</button>
    </div>
  );
}
