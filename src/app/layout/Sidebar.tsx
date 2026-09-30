import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router";

import { BrandMark } from "@/components/common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SchoolSummary } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "../nav";

function SchoolBadge({ school, className }: { school: SchoolSummary; className?: string }) {
  if (school.logo_url) {
    return <img src={school.logo_url} alt="" className={cn("size-8 rounded-md bg-white object-contain", className)} />;
  }
  return (
    <span
      className={cn(
        "bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-md text-xs font-semibold",
        className,
      )}
    >
      {initials(school.name)}
    </span>
  );
}

function SchoolSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { user, membership, selectSchool } = useAuth();
  const navigate = useNavigate();
  if (!user || !membership) return null;
  const school = membership.school;
  const multiple = user.memberships.length > 1;

  const trigger = (
    <div className="flex min-w-0 items-center gap-2.5">
      <SchoolBadge school={school} />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{school.name}</p>
        <p className="text-sidebar-foreground/60 truncate text-xs">{membership.roles.map((r) => r.name).join(", ")}</p>
      </div>
    </div>
  );

  if (!multiple) return <div className="rounded-lg px-2 py-2">{trigger}</div>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center gap-2 rounded-lg px-2 py-2 outline-none focus-visible:ring-2"
        aria-label={t("nav.switchSchool")}
      >
        <div className="min-w-0 flex-1">{trigger}</div>
        <ChevronsUpDown className="text-sidebar-foreground/60 size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("nav.switchSchool")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.memberships.map((m) => (
          <DropdownMenuItem
            key={m.school.id}
            onSelect={() => {
              if (m.school.id !== school.id) {
                selectSchool(m.school.id);
                navigate("/");
                onNavigate?.();
              }
            }}
          >
            <span className="truncate">{m.school.name}</span>
            {m.school.id === school.id && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
    "focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { canAny, user, membership } = useAuth();
  // Without a school selected (the owner before the first school), only the platform link applies.
  const items = membership ? NAV_ITEMS.filter((item) => item.anyOf.length === 0 || canAny(item.anyOf)) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <BrandMark className="size-8" />
        <span className="text-lg font-semibold tracking-tight text-white">{t("app.name")}</span>
      </div>
      {user?.is_platform_admin && (
        <div className="px-3 pb-2">
          <NavLink to="/platform" onClick={onNavigate} className={linkClass}>
            <Building2 className="size-4 shrink-0" />
            <span className="flex-1 truncate">{t("nav.platform")}</span>
          </NavLink>
        </div>
      )}
      <div className="px-3 pb-3">
        <SchoolSwitcher onNavigate={onNavigate} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label={t("nav.menu")}>
        <ul className="grid gap-0.5">
          {items.map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={linkClass}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("size-4 shrink-0", isActive && "text-sidebar-primary")} />
                    <span className="flex-1 truncate">{t(`nav.${item.key}`)}</span>
                    {item.phase && (
                      <span
                        aria-hidden="true"
                        className="text-sidebar-foreground/80 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium"
                      >
                        P{item.phase}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
