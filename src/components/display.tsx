import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PersonAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" className="object-cover" />}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success border-transparent",
  open: "bg-success/15 text-success border-transparent",
  archived: "bg-muted text-muted-foreground border-transparent",
  closed: "bg-muted text-muted-foreground border-transparent",
  completed: "bg-primary/10 text-primary border-transparent",
  class_changed: "bg-primary/10 text-primary border-transparent",
  withdrawn: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-destructive/10 text-destructive border-transparent",
};

/** A coloured badge for any record status; labels come from the `status.*` translations. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status] ?? "", className)}>
      {t(`status.${status}`, { defaultValue: status })}
    </Badge>
  );
}

export function DetailGrid({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm break-words">{item.value || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SearchInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("relative", className)}>
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("common.search")}
        className="pl-9"
        aria-label={placeholder ?? t("common.search")}
      />
    </div>
  );
}

export function PhaseBadge({ phase }: { phase: number }) {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className="ml-1.5 text-[10px] font-medium">
      {t("modules.phase", { phase })}
    </Badge>
  );
}
