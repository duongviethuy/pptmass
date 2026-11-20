import Link from "next/link";
import { Suspense } from "react";
import { Church } from "lucide-react";

import UserMenu, { UserMenuSkeleton } from "@/components/user-menu";

const navItems = [
  { href: "/", label: "Trang chủ", ready: true },
  { href: "/slides", label: "Slide của tôi", ready: true },
  { href: "/songs", label: "Thư viện bài hát", ready: true },
  { href: "/prayers", label: "Thư viện kinh", ready: true },
  { href: "/sections", label: "Section đã lưu", ready: true },
  { href: "/editor", label: "Soạn Thánh lễ", ready: true },
];

/** Thanh điều hướng chung cho các trang (trừ trình soạn, vốn có header riêng). */
export default function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-200"><Church className="size-5" /></span>
            <span className="text-lg font-bold tracking-tight text-slate-900">pptmass</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) =>
              item.ready ? (
                <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
                  {item.label}
                </Link>
              ) : (
                <span key={item.href} className="cursor-not-allowed rounded-lg px-3 py-2 text-sm font-semibold text-slate-400" title="Sắp có">
                  {item.label}
                </span>
              ),
            )}
          </nav>
        </div>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
