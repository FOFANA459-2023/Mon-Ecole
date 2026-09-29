import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonAvatar, SearchInput } from "@/components/display";
import { Button } from "@/components/ui/button";
import { useStudents } from "@/features/people/api";
import type { StudentListItem } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

/** Find a student by name or number (at least 2 characters), then show the choice with a "change" button. */
export function StudentPicker({
  selected,
  onSelect,
  placeholder,
}: {
  selected: StudentListItem | null;
  onSelect: (student: StudentListItem | null) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query);
  const results = useStudents({ search, status: "active", page_size: 8 }, search.trim().length >= 2);

  if (selected) {
    return (
      <div className="bg-accent/50 flex items-center gap-3 rounded-lg border p-3">
        <PersonAvatar name={selected.full_name} photoUrl={selected.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{selected.full_name}</p>
          <p className="text-muted-foreground text-sm">
            {selected.student_number}
            {selected.current_enrollment && ` · ${selected.current_enrollment.class_name} (${selected.current_enrollment.academic_year_name})`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
          {t("guardians.changeChoice")}
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <SearchInput value={query} onChange={setQuery} placeholder={placeholder ?? t("enrollments.searchStudent")} />
      <ul className="grid gap-1">
        {results.data?.results.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm"
            >
              <PersonAvatar name={s.full_name} photoUrl={s.photo_url} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.full_name}</span>
                <span className="text-muted-foreground block text-xs">
                  {s.student_number}
                  {s.current_enrollment && ` · ${s.current_enrollment.class_name}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
