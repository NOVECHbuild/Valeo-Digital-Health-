"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";

export type BottomTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Exact match for root dashboards */
  exact?: boolean;
};

/**
 * Primary destinations on small screens. "More" opens the existing sidebar.
 */
export default function MobileBottomNav({
  tabs,
  onMore,
}: {
  tabs: BottomTab[];
  onMore: () => void;
}) {
  const pathname = usePathname();

  function active(tab: BottomTab): boolean {
    if (tab.exact) return pathname === tab.href;
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t"
      style={{
        background: "rgba(246,250,240,0.96)",
        backdropFilter: "blur(12px)",
        borderColor: "rgba(42,74,26,0.1)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around px-1 pt-1 pb-1">
        {tabs.map(tab => {
          const on = active(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] rounded-xl text-[10px] font-semibold transition-colors",
              )}
              style={{ color: on ? "#2A4A1A" : "#8A9BA8" }}
            >
              <Icon size={20} strokeWidth={on ? 2.4 : 2} style={{ color: on ? "#6BA028" : "#8A9BA8" }} />
              <span className="truncate max-w-[72px]">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] rounded-xl text-[10px] font-semibold"
          style={{ color: "#8A9BA8" }}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
