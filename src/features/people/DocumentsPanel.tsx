import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, Field, Spinner } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFormatDate } from "@/lib/dates";
import { OptionSelect } from "@/components/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, apiFile } from "@/lib/api/client";
import type { SchoolDocument } from "@/lib/api/types";
import { saveBlob } from "@/lib/files";
import { localeFor } from "@/lib/format";
import { errorMessage } from "@/lib/forms";

import { useDocuments } from "./api";

const CATEGORIES = {
  student: ["birth_certificate", "id_photo", "previous_report", "transfer_certificate", "medical", "identity", "other"],
  staff: ["identity", "diploma", "contract", "medical", "other"],
} as const;

function formatSize(bytes: number, language: string) {
  const megabytes = bytes > 1024 * 1024;
  return new Intl.NumberFormat(localeFor(language), {
    style: "unit",
    unit: megabytes ? "megabyte" : "kilobyte",
    maximumFractionDigits: megabytes ? 1 : 0,
  }).format(megabytes ? bytes / 1024 / 1024 : Math.max(1, bytes / 1024));
}

function UploadDialog({
  ownerType,
  ownerId,
  onClose,
}: {
  ownerType: "student" | "staff";
  ownerId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>(CATEGORIES[ownerType][0]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) {
      setError(t("documents.fileRequired"));
      return;
    }
    const body = new FormData();
    body.append("owner_type", ownerType);
    body.append("owner_id", String(ownerId));
    body.append("category", category);
    body.append("title", title || t(`docCategory.${category}`));
    body.append("file", file);
    setBusy(true);
    try {
      await api.post("/documents/", body);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(t("documents.uploaded"));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("documents.upload")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("documents.category")} htmlFor="d-category">
            <OptionSelect
              id="d-category"
              value={category}
              onChange={(v) => v && setCategory(v)}
              options={CATEGORIES[ownerType].map((c) => ({ value: c, label: t(`docCategory.${c}`) }))}
            />
          </Field>
          <Field label={t("documents.titleLabel")} htmlFor="d-title">
            <Input
              id="d-title"
              value={title}
              placeholder={t(`docCategory.${category}`)}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t("documents.file")} htmlFor="d-file" hint={t("documents.fileHint")} error={error ?? undefined}>
            <Input
              id="d-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? t("common.saving") : t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsPanel({
  ownerType,
  ownerId,
  canEdit,
}: {
  ownerType: "student" | "staff";
  ownerId: number;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const formatDate = useFormatDate();
  const documents = useDocuments(ownerType, ownerId);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<SchoolDocument | null>(null);

  const open = async (doc: SchoolDocument) => {
    const tab = window.open("", "_blank");
    try {
      const { blob } = await apiFile(`/documents/${doc.id}/download/`);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else saveBlob(blob, doc.title);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      toast.error(errorMessage(error, t));
    }
  };

  return (
    <>
      {canEdit && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => setUploading(true)}>
            <Plus /> {t("documents.upload")}
          </Button>
        </div>
      )}
      <Card className="gap-0 py-0">
        {documents.isPending ? (
          <Spinner className="mx-auto my-8 size-6" />
        ) : !documents.data?.length ? (
          <EmptyState icon={<FileText className="size-7" />} title={t("documents.none")} />
        ) : (
          <ul className="divide-y">
            {documents.data.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="text-primary size-5 shrink-0" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void open(doc)}>
                  <p className="truncate text-sm font-medium hover:underline">{doc.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(doc.created_at.slice(0, 10))} · {formatSize(doc.size ?? 0, i18n.language)}
                    {doc.uploaded_by_name ? ` · ${doc.uploaded_by_name}` : ""}
                  </p>
                </button>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {t(`docCategory.${doc.category}`)}
                </Badge>
                {canEdit && (
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(doc)} aria-label={t("common.delete")}>
                    <Trash2 className="text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {uploading && <UploadDialog ownerType={ownerType} ownerId={ownerId} onClose={() => setUploading(false)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("common.delete")}
        description={t("documents.confirmDelete", { name: deleting?.title ?? "" })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.delete(`/documents/${deleting.id}/`);
            await queryClient.invalidateQueries({ queryKey: ["documents"] });
            toast.success(t("documents.deleted"));
          } catch (error) {
            toast.error(errorMessage(error, t));
          }
        }}
      />
    </>
  );
}
