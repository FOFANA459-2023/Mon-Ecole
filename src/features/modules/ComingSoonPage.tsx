import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { NavItem } from "@/app/nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Placeholder for modules scheduled in later phases, so the full menu can be reviewed now. */
export function ComingSoonPage({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  const moduleName = t(`nav.${item.key}`);
  return (
    <div className="mx-auto max-w-2xl py-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 px-8 py-12 text-center">
          <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
            <item.icon className="size-7" />
          </span>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{moduleName}</h1>
            <Badge variant="secondary">{t("modules.phase", { phase: item.phase })}</Badge>
          </div>
          <p className="text-muted-foreground max-w-md">{t(`modules.${item.key}`)}</p>
          <div className="bg-muted/60 mt-2 flex items-start gap-3 rounded-lg p-4 text-left text-sm">
            <Hourglass className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-medium">{t("modules.comingTitle")}. </span>
              {t("modules.comingBody", { module: moduleName, phase: item.phase })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
