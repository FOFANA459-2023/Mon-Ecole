import { useQuery } from "@tanstack/react-query";
import { GraduationCap, School, Search, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSchoolId } from "@/features/academics/api";
import { api } from "@/lib/api/client";
import type { SearchHit, SearchResults } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const GROUPS = [
  { key: "students", icon: GraduationCap, to: (hit: SearchHit) => `/students/${hit.id}` },
  { key: "guardians", icon: UserRound, to: (hit: SearchHit) => (hit.student_id ? `/students/${hit.student_id}?tab=guardians` : null) },
  { key: "staff", icon: Users, to: (hit: SearchHit) => `/teachers/${hit.id}` },
  { key: "classes", icon: School, to: (hit: SearchHit) => `/classes/${hit.id}` },
] as const;

/** One search box for the whole school (Ctrl/⌘ + K). */
export function SearchCommand() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schoolId = useSchoolId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 250);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useQuery({
    queryKey: ["search", schoolId, q],
    queryFn: ({ signal }) => api.get<SearchResults>("/search/", { q }, signal),
    enabled: open && q.length >= 2,
    staleTime: 30_000,
  });

  const go = (path: string | null) => {
    if (!path) return;
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  const data = results.data;
  const total = data ? GROUPS.reduce((n, g) => n + data[g.key].length, 0) : 0;

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground h-9 w-9 justify-start gap-2 px-0 sm:w-64 sm:px-3"
        onClick={() => setOpen(true)}
        aria-label={t("search.button")}
      >
        <Search className="mx-auto sm:mx-0" />
        <span className="hidden flex-1 truncate text-left text-sm font-normal sm:inline">{t("search.button")}…</span>
        <kbd className="bg-muted hidden rounded px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("search.button")}
        description={t("search.placeholder")}
        shouldFilter={false}
      >
        <CommandInput value={query} onValueChange={setQuery} placeholder={t("search.placeholder")} />
        <CommandList>
          {q.length < 2 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("search.typeMore")}</p>
          ) : results.isFetching && !data ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("common.loading")}</p>
          ) : (
            <>
              {total === 0 && <CommandEmpty>{t("search.noResults")}</CommandEmpty>}
              {data &&
                GROUPS.map(
                  (group) =>
                    data[group.key].length > 0 && (
                      <CommandGroup key={group.key} heading={t(`search.${group.key}`)}>
                        {data[group.key].map((hit) => (
                          <CommandItem
                            key={`${group.key}-${hit.id}`}
                            value={`${group.key}-${hit.id}-${hit.title}`}
                            onSelect={() => go(group.to(hit))}
                          >
                            <group.icon className="text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{hit.title}</span>
                              <span className="text-muted-foreground block truncate text-xs">{hit.subtitle}</span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ),
                )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
