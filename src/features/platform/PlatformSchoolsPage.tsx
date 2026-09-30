import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MoreHorizontal, Plus, Send, ShieldOff, ShieldCheck, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, Field, PageHeader, QueryError, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchInput, StatusBadge } from "@/components/display";
import { OptionSelect } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Paginated } from "@/lib/api/client";
import type { Language, PlatformSchool } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { applyApiErrors, errorMessage } from "@/lib/forms";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

/** Countries the schools are in, with the defaults a new school starts from (all editable). */
const COUNTRIES = [
  { code: "GN", currency: "GNF", timezone: "Africa/Conakry", language: "fr" },
  { code: "LR", currency: "LRD", timezone: "Africa/Monrovia", language: "en" },
  { code: "SL", currency: "SLE", timezone: "Africa/Freetown", language: "en" },
  { code: "CI", currency: "XOF", timezone: "Africa/Abidjan", language: "fr" },
  { code: "SN", currency: "XOF", timezone: "Africa/Dakar", language: "fr" },
  { code: "ML", currency: "XOF", timezone: "Africa/Bamako", language: "fr" },
] as const;
type CountryCode = (typeof COUNTRIES)[number]["code"];
const CURRENCIES = ["GNF", "LRD", "USD", "SLE", "XOF", "EUR"];
const LANGUAGES: Language[] = ["fr", "en"];

function usePlatformSchools(search: string) {
  return useQuery({
    queryKey: ["platform-schools", search],
    queryFn: ({ signal }) => api.get<Paginated<PlatformSchool>>("/platform/schools/", { search, page_size: 100 }, signal),
    placeholderData: keepPreviousData,
  });
}

function RegisterSchoolDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const schema = useMemo(() => {
    const required = t("validation.required");
    return z.object({
      name: z.string().trim().min(1, required).max(200),
      code: z
        .string()
        .trim()
        .min(2, required)
        .max(30)
        .regex(/^[a-z0-9-]+$/, t("platform.codeFormat")),
      country: z.string().min(2, required),
      currency: z.string().min(3, required),
      default_language: z.enum(["fr", "en"]),
      director: z.object({
        first_name: z.string().trim().min(1, required).max(150),
        last_name: z.string().trim().min(1, required).max(150),
        email: z.string().trim().email(t("validation.email")),
        phone: z.string().max(30),
      }),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: "",
      country: "GN",
      currency: "GNF",
      default_language: "fr",
      director: { first_name: "", last_name: "", email: "", phone: "" },
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onCountry = (code: CountryCode) => {
    const country = COUNTRIES.find((c) => c.code === code)!;
    form.setValue("country", country.code);
    form.setValue("currency", country.currency);
    form.setValue("default_language", country.language);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const country = COUNTRIES.find((c) => c.code === values.country);
    try {
      const school = await api.post<PlatformSchool>("/platform/schools/", {
        ...values,
        timezone: country?.timezone ?? "Africa/Conakry",
      });
      await queryClient.invalidateQueries({ queryKey: ["platform-schools"] });
      await refreshUser(); // the new school appears in the school switcher
      toast.success(t("platform.registered", { name: school.name, email: values.director.email }));
      onClose();
    } catch (error) {
      const message = applyApiErrors(
        error,
        form.setError,
        ["name", "code", "country", "currency", "default_language", "director.first_name", "director.last_name", "director.email", "director.phone"],
        t,
      );
      if (message) toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("platform.registerTitle")}</DialogTitle>
          <DialogDescription>{t("platform.registerHint")}</DialogDescription>
        </DialogHeader>
        <form id="school-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <p className="text-sm font-medium">{t("platform.theSchool")}</p>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label={t("platform.schoolName")} htmlFor="p-name" error={errors.name?.message}>
              <Input id="p-name" {...form.register("name")} />
            </Field>
            <Field label={t("platform.code")} htmlFor="p-code" error={errors.code?.message} hint={t("platform.codeHint")}>
              <Input id="p-code" className="lowercase" {...form.register("code")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("platform.country")} htmlFor="p-country">
              <Controller
                control={form.control}
                name="country"
                render={({ field }) => (
                  <OptionSelect<CountryCode>
                    id="p-country"
                    value={field.value as CountryCode}
                    onChange={(v) => v && onCountry(v)}
                    options={COUNTRIES.map((c) => ({ value: c.code, label: t(`platform.countries.${c.code}`) }))}
                  />
                )}
              />
            </Field>
            <Field label={t("platform.currency")} htmlFor="p-currency" error={errors.currency?.message}>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <OptionSelect
                    id="p-currency"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  />
                )}
              />
            </Field>
            <Field label={t("platform.language")} htmlFor="p-language" hint={t("platform.languageHint")}>
              <Controller
                control={form.control}
                name="default_language"
                render={({ field }) => (
                  <OptionSelect<Language>
                    id="p-language"
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
                  />
                )}
              />
            </Field>
          </div>

          <p className="mt-2 text-sm font-medium">{t("platform.theDirector")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("platform.firstName")} htmlFor="d-first" error={errors.director?.first_name?.message}>
              <Input id="d-first" {...form.register("director.first_name")} />
            </Field>
            <Field label={t("platform.lastName")} htmlFor="d-last" error={errors.director?.last_name?.message}>
              <Input id="d-last" {...form.register("director.last_name")} />
            </Field>
            <Field label={t("platform.email")} htmlFor="d-email" error={errors.director?.email?.message}>
              <Input id="d-email" type="email" autoComplete="off" {...form.register("director.email")} />
            </Field>
            <Field label={t("platform.phone")} htmlFor="d-phone" error={errors.director?.phone?.message}>
              <Input id="d-phone" type="tel" {...form.register("director.phone")} />
            </Field>
          </div>
          <p className="text-muted-foreground text-xs">{t("platform.inviteExplained")}</p>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="school-form" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("platform.register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The platform owner's home: every school on Mon École. */
export function PlatformSchoolsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectSchool, refreshUser } = useAuth();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query);
  const schools = usePlatformSchools(search);
  const [registering, setRegistering] = useState(false);
  const [suspending, setSuspending] = useState<PlatformSchool | null>(null);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["platform-schools"] });
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error, t));
    }
  };

  const open = (school: PlatformSchool) => {
    selectSchool(school.id);
    navigate("/");
  };

  return (
    <>
      <PageHeader
        title={t("platform.title")}
        description={t("platform.subtitle")}
        actions={
          <Button onClick={() => setRegistering(true)}>
            <Plus /> {t("platform.registerTitle")}
          </Button>
        }
      />
      <div className="mb-4 max-w-md">
        <SearchInput value={query} onChange={setQuery} />
      </div>
      {schools.isError ? (
        <QueryError error={schools.error} onRetry={() => void schools.refetch()} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {schools.isPending ? (
            <Spinner className="mx-auto my-10 size-6" />
          ) : schools.data.results.length === 0 ? (
            <EmptyState icon={<Building2 className="size-8" />} title={t("platform.noSchools")}>
              {t("platform.noSchoolsHint")}
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("platform.schoolName")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("platform.settingsColumn")}</TableHead>
                  <TableHead>{t("platform.theDirector")}</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">{t("platform.students")}</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">{t("platform.users")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.data.results.map((school) => {
                  const pendingDirector = school.directors.some((d) => d.account_status !== "active");
                  return (
                    <TableRow key={school.id}>
                      <TableCell>
                        <span className="block font-medium">{school.name}</span>
                        <span className="text-muted-foreground block font-mono text-xs">{school.code}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                        {t(`platform.countries.${school.country}`, { defaultValue: school.country })} · {school.currency} ·{" "}
                        {t(`languages.${school.default_language}`)}
                      </TableCell>
                      <TableCell>
                        {school.directors.length === 0 ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : (
                          school.directors.map((d) => (
                            <span key={d.id} className="flex flex-wrap items-center gap-2">
                              <span className="text-sm">
                                {d.full_name}
                                <span className="text-muted-foreground block text-xs">{d.email}</span>
                              </span>
                              {d.account_status !== "active" && <StatusBadge status={`invite_${d.account_status}`} />}
                            </span>
                          ))
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{school.student_count}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{school.member_count}</TableCell>
                      <TableCell>
                        <StatusBadge status={school.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("common.actions")}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {school.status === "active" && (
                              <DropdownMenuItem onSelect={() => open(school)}>
                                <ArrowRight /> {t("platform.open")}
                              </DropdownMenuItem>
                            )}
                            {pendingDirector && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  void run(
                                    () => api.post(`/platform/schools/${school.id}/resend-invitation/`),
                                    t("platform.inviteResent"),
                                  )
                                }
                              >
                                <Send /> {t("platform.resendInvite")}
                              </DropdownMenuItem>
                            )}
                            {school.status === "active" ? (
                              <DropdownMenuItem variant="destructive" onSelect={() => setSuspending(school)}>
                                <ShieldOff /> {t("platform.suspend")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() =>
                                  void run(async () => {
                                    await api.post(`/platform/schools/${school.id}/status/`, { status: "active" });
                                    await refreshUser();
                                  }, t("platform.reactivated", { name: school.name }))
                                }
                              >
                                <ShieldCheck /> {t("platform.reactivate")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
      {registering && <RegisterSchoolDialog onClose={() => setRegistering(false)} />}
      <ConfirmDialog
        open={suspending !== null}
        onOpenChange={(isOpen) => !isOpen && setSuspending(null)}
        title={t("platform.suspend")}
        description={t("platform.confirmSuspend", { name: suspending?.name ?? "" })}
        confirmLabel={t("platform.suspend")}
        destructive
        onConfirm={() => {
          if (!suspending) return;
          const school = suspending;
          void run(async () => {
            await api.post(`/platform/schools/${school.id}/status/`, { status: "suspended" });
            await refreshUser();
          }, t("platform.suspended", { name: school.name }));
        }}
      />
    </>
  );
}
