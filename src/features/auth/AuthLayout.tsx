import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { LanguageMenu } from "@/app/layout/Topbar";
import { BrandMark } from "@/components/common";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <section className="bg-sidebar relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <span className="text-xl font-semibold tracking-tight">{t("app.name")}</span>
        </div>
        <div className="mt-auto max-w-md">
          <p className="text-3xl leading-tight font-semibold">{t("app.tagline")}</p>
          <p className="text-sidebar-foreground/75 mt-4">{t("app.description")}</p>
        </div>
        <div
          aria-hidden="true"
          className="bg-sidebar-primary/20 absolute -top-24 -right-24 size-80 rounded-full blur-3xl"
        />
        <div aria-hidden="true" className="bg-primary/40 absolute -bottom-32 left-10 size-96 rounded-full blur-3xl" />
      </section>

      <section className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <BrandMark className="size-8" />
            <span className="font-semibold">{t("app.name")}</span>
          </div>
          <LanguageMenu />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
