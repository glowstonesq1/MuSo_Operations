import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { NavLinks } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const initials = String(staff.name ?? "?")
    .split(/\s+/)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-600 text-sm font-black text-white shadow-sm">
              M
            </span>
            <span className="hidden text-sm font-bold tracking-tight sm:block">
              MuSo <span className="font-medium text-slate-400">Ops</span>
            </span>
          </Link>
          <NavLinks />
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
              {initials}
            </span>
            <div className="hidden leading-tight md:block">
              <div className="text-xs font-semibold text-slate-800">{staff.name}</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{staff.role}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-6 text-center text-[11px] text-slate-400">
        Museum of Solutions, Mumbai — Ops Command Center
      </footer>
    </div>
  );
}
