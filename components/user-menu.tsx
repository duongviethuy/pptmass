import { LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";

/** Server Component: đọc người dùng hiện tại (phụ thuộc request) — cần đặt trong <Suspense>. */
export default async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
      <span className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700" aria-hidden>{initial}</span>
      <span className="hidden max-w-40 flex-col leading-tight md:flex">
        <span className="truncate text-sm font-semibold text-slate-800">{user.name}</span>
        <span className="truncate text-[11px] text-slate-400">{user.email}</span>
      </span>
      <form action={signOut}>
        <button type="submit" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Đăng xuất" title="Đăng xuất">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return <div className="ml-1 size-8 animate-pulse rounded-full bg-slate-100" />;
}
