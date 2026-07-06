import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const nav = [
    { href: "/", label: "Daily Memo" },
    { href: "/bookings", label: "Bookings" },
    { href: "/departments", label: "Departments" },
    { href: "/staff", label: "Staff" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2.5">
          <Link href="/" className="text-sm font-bold tracking-tight">
            MuSo <span className="text-slate-400">Ops</span>
          </Link>
          <nav className="flex flex-1 gap-4 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-slate-600 hover:text-slate-900">
                {n.label}
              </Link>
            ))}
          </nav>
          <span className="text-xs text-slate-500">
            {staff.name} · <span className="font-semibold">{staff.role}</span>
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
