import { useTranslation } from "react-i18next";

import { DocumentsPanel } from "@/features/people/DocumentsPanel";
import { useAuth } from "@/lib/auth/context";

/** The school's official documents: approvals, statutes, contracts, circulars... */
export function SchoolDocumentsPage() {
  const { t } = useTranslation();
  const { can, membership } = useAuth();
  if (!membership) return null;
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">{t("administration.documents.intro")}</p>
      <DocumentsPanel ownerType="school" ownerId={membership.school.id} canEdit={can("administration.manage")} />
    </div>
  );
}
