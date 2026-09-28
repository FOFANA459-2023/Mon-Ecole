import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUp, Lock } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Field, QueryError, Spinner } from "@/components/common";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { School } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { localeFor } from "@/lib/format";
import { applyApiErrors, errorMessage } from "@/lib/forms";

import { keys, useSchool } from "./api";

const COUNTRIES = ["GN", "LR", "SL", "CI", "SN", "ML"];
const TIMEZONES = [
  "Africa/Conakry",
  "Africa/Monrovia",
  "Africa/Freetown",
  "Africa/Abidjan",
  "Africa/Dakar",
  "Africa/Bamako",
  "UTC",
];
const CURRENCIES = ["GNF", "LRD", "USD", "XOF", "SLE", "EUR"];
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const FIELD_NAMES = [
  "name",
  "registration_number",
  "address",
  "phone",
  "email",
  "website",
  "country",
  "timezone",
  "currency",
  "default_language",
  "settings.idle_timeout_minutes",
  "settings.student_number_prefix",
  "settings.employee_number_prefix",
  "settings.invoice_prefix",
  "settings.receipt_prefix",
  "settings.ai_enabled",
] as const;

function useSchoolSchema() {
  const { t } = useTranslation();
  return useMemo(() => {
    const required = z.string().trim().min(1, t("validation.required"));
    const prefix = z
      .string()
      .trim()
      .min(1, t("validation.required"))
      .max(10)
      .regex(/^[A-Za-z0-9]+$/, t("validation.alphanumeric"));
    return z.object({
      name: required,
      registration_number: z.string().trim(),
      address: z.string().trim(),
      phone: z.string().trim(),
      email: z.union([z.literal(""), z.email(t("validation.email"))]),
      website: z.union([z.literal(""), z.url(t("validation.url"))]),
      country: required,
      timezone: required,
      currency: required,
      default_language: z.enum(["fr", "en"]),
      settings: z.object({
        idle_timeout_minutes: z
          .number(t("validation.required"))
          .int()
          .min(5, t("validation.range", { min: 5, max: 240 }))
          .max(240, t("validation.range", { min: 5, max: 240 })),
        student_number_prefix: prefix,
        employee_number_prefix: prefix,
        invoice_prefix: prefix,
        receipt_prefix: prefix,
        ai_enabled: z.boolean(),
      }),
    });
  }, [t]);
}

type Values = z.infer<ReturnType<typeof useSchoolSchema>>;

function toValues(school: School): Values {
  const s = school.settings ?? {};
  return {
    name: school.name,
    registration_number: school.registration_number ?? "",
    address: school.address ?? "",
    phone: school.phone ?? "",
    email: school.email ?? "",
    website: school.website ?? "",
    country: school.country ?? "GN",
    timezone: school.timezone ?? "Africa/Conakry",
    currency: school.currency ?? "GNF",
    default_language: school.default_language ?? "fr",
    settings: {
      idle_timeout_minutes: s.idle_timeout_minutes ?? 30,
      student_number_prefix: s.student_number_prefix ?? "STU",
      employee_number_prefix: s.employee_number_prefix ?? "EMP",
      invoice_prefix: s.invoice_prefix ?? "INV",
      receipt_prefix: s.receipt_prefix ?? "REC",
      ai_enabled: s.ai_enabled ?? false,
    },
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function SelectField({
  control,
  name,
  id,
  options,
}: {
  control: Control<Values>;
  name: "country" | "timezone" | "currency" | "default_language";
  id: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value} onValueChange={(value) => value && field.onChange(value)} disabled={field.disabled}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

function LogoCard({ school, readOnly }: { school: School; readOnly: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
      toast.error(t("settings.school.logoHint"));
      return;
    }
    const body = new FormData();
    body.append("logo", file);
    setUploading(true);
    try {
      const updated = await api.patch<School>("/school/", body);
      queryClient.setQueryData(keys.school(school.id), updated);
      await refreshUser();
      toast.success(t("settings.school.logoUpdated"));
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.school.logo")}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
          {school.logo_url ? (
            <img src={school.logo_url} alt="" className="size-full object-contain p-1" />
          ) : (
            <ImageUp className="text-muted-foreground size-7" />
          )}
        </div>
        <div className="grid gap-2">
          <p className="text-muted-foreground text-sm">{t("settings.school.logoHint")}</p>
          {!readOnly && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={LOGO_TYPES.join(",")}
                className="hidden"
                onChange={(e) => void onFile(e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <Spinner className="size-4" /> : <ImageUp />}
                {t("settings.school.uploadLogo")}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SchoolProfilePage() {
  const { t, i18n } = useTranslation();
  const { can, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const schoolQuery = useSchool();
  const schema = useSchoolSchema();
  const readOnly = !can("settings.manage");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: schoolQuery.data ? toValues(schoolQuery.data) : undefined,
    disabled: readOnly,
  });
  const watched = useWatch({ control: form.control, name: "settings" });

  const locale = localeFor(i18n.language);
  const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const currencyNames = useMemo(() => new Intl.DisplayNames([locale], { type: "currency" }), [locale]);

  if (schoolQuery.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  if (schoolQuery.isError) return <QueryError onRetry={() => void schoolQuery.refetch()} />;
  const school = schoolQuery.data;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const updated = await api.patch<School>("/school/", values);
      queryClient.setQueryData(keys.school(school.id), updated);
      await refreshUser();
      toast.success(t("common.saved"));
    } catch (error) {
      const message = applyApiErrors(error, form.setError, FIELD_NAMES, t);
      if (message) toast.error(message);
    }
  });

  const { errors, isSubmitting, isDirty } = form.formState;
  const prefixExample = (prefix: string) => `${prefix || "…"}-${new Date().getFullYear()}-000001`;

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {readOnly && (
        <Alert>
          <Lock />
          <AlertDescription>{t("settings.school.readOnlyNotice")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Section title={t("settings.school.identity")}>
          <Field label={t("settings.school.name")} htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" {...form.register("name")} />
          </Field>
          <Field label={t("settings.school.code")} htmlFor="code">
            <Input id="code" value={school.code} disabled readOnly />
          </Field>
          <Field
            label={t("settings.school.registrationNumber")}
            htmlFor="registration_number"
            error={errors.registration_number?.message}
          >
            <Input id="registration_number" {...form.register("registration_number")} />
          </Field>
        </Section>
        <LogoCard school={school} readOnly={readOnly} />
      </div>

      <Section title={t("settings.school.contact")}>
        <Field label={t("settings.school.address")} htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
          <Textarea id="address" rows={2} {...form.register("address")} />
        </Field>
        <Field label={t("settings.school.phone")} htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" type="tel" {...form.register("phone")} />
        </Field>
        <Field label={t("settings.school.email")} htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" {...form.register("email")} />
        </Field>
        <Field label={t("settings.school.website")} htmlFor="website" error={errors.website?.message} className="sm:col-span-2">
          <Input id="website" type="url" placeholder="https://" {...form.register("website")} />
        </Field>
      </Section>

      <Section title={t("settings.school.regional")}>
        <Field label={t("settings.school.country")} htmlFor="country" error={errors.country?.message}>
          <SelectField
            control={form.control}
            name="country"
            id="country"
            options={COUNTRIES.map((c) => ({ value: c, label: regionNames.of(c) ?? c }))}
          />
        </Field>
        <Field label={t("settings.school.timezone")} htmlFor="timezone" error={errors.timezone?.message}>
          <SelectField
            control={form.control}
            name="timezone"
            id="timezone"
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace("Africa/", "").replace("_", " ") }))}
          />
        </Field>
        <Field label={t("settings.school.currency")} htmlFor="currency" error={errors.currency?.message}>
          <SelectField
            control={form.control}
            name="currency"
            id="currency"
            options={CURRENCIES.map((c) => ({ value: c, label: `${c} — ${currencyNames.of(c) ?? c}` }))}
          />
        </Field>
        <Field label={t("settings.school.defaultLanguage")} htmlFor="default_language">
          <SelectField
            control={form.control}
            name="default_language"
            id="default_language"
            options={[
              { value: "fr", label: t("languages.fr") },
              { value: "en", label: t("languages.en") },
            ]}
          />
        </Field>
      </Section>

      <Section title={t("settings.school.numbering")}>
        {(
          [
            ["student_number_prefix", "studentPrefix"],
            ["employee_number_prefix", "employeePrefix"],
            ["invoice_prefix", "invoicePrefix"],
            ["receipt_prefix", "receiptPrefix"],
          ] as const
        ).map(([name, label]) => (
          <Field
            key={name}
            label={t(`settings.school.${label}`)}
            htmlFor={name}
            error={errors.settings?.[name]?.message}
            hint={t("settings.school.prefixHint", { example: prefixExample(watched?.[name] ?? "") })}
          >
            <Input id={name} className="uppercase" maxLength={10} {...form.register(`settings.${name}`)} />
          </Field>
        ))}
      </Section>

      <Section title={t("settings.school.security")}>
        <Field
          label={t("settings.school.idleTimeout")}
          htmlFor="idle_timeout_minutes"
          error={errors.settings?.idle_timeout_minutes?.message}
        >
          <Input
            id="idle_timeout_minutes"
            type="number"
            min={5}
            max={240}
            {...form.register("settings.idle_timeout_minutes", { valueAsNumber: true })}
          />
        </Field>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
          <div>
            <label htmlFor="ai_enabled" className="text-sm font-medium">
              {t("settings.school.aiEnabled")}
            </label>
            <p className="text-muted-foreground text-xs">{t("settings.school.aiEnabledHint")}</p>
          </div>
          <Controller
            control={form.control}
            name="settings.ai_enabled"
            render={({ field }) => (
              <Switch id="ai_enabled" checked={field.value} onCheckedChange={field.onChange} disabled={field.disabled} />
            )}
          />
        </div>
      </Section>

      {!readOnly && (
        <div className="bg-background/90 sticky bottom-0 -mx-1 flex justify-end gap-2 border-t px-1 py-3 backdrop-blur">
          <Button type="button" variant="outline" disabled={!isDirty || isSubmitting} onClick={() => form.reset()}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      )}
    </form>
  );
}
