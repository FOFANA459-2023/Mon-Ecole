import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/common";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, api } from "@/lib/api/client";
import type { ImportResult } from "@/lib/api/types";
import { downloadFile } from "@/lib/files";
import { errorMessage } from "@/lib/forms";

export function ImportPage({ kind }: { kind: "students" | "staff" }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const backTo = kind === "students" ? "/students" : "/teachers";

  const send = async (commit: boolean) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("commit", String(commit));
    setBusy(commit ? "import" : "check");
    try {
      const response = await api.post<ImportResult>(`/imports/${kind}/`, body);
      setResult(response);
      if (commit) {
        setImported(response.created);
        await Promise.all(
          ["students", "staff", "enrollments", "classes", "dashboard", "guardians"].map((k) =>
            queryClient.invalidateQueries({ queryKey: [k] }),
          ),
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.code !== "validation_error") {
        toast.error(errorMessage(error, t));
      } else {
        toast.error(errorMessage(error, t));
      }
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setImported(null);
  };

  const previewColumns = result?.preview[0] ? Object.keys(result.preview[0]).filter((k) => k !== "row") : [];
  const canImport = result && result.errors.length === 0 && result.columns_missing.length === 0 && result.valid > 0;

  return (
    <>
      <Link to={backTo} className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> {kind === "students" ? t("students.title") : t("staff.title")}
      </Link>
      <PageHeader title={kind === "students" ? t("imports.studentsTitle") : t("imports.staffTitle")} description={t("imports.subtitle")} />

      {imported !== null ? (
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="text-success size-12" />
            <p className="text-lg font-semibold">{t("imports.done", { count: imported })}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                {t("imports.another")}
              </Button>
              <Button asChild>
                <Link to={backTo}>{kind === "students" ? t("students.title") : t("staff.title")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("imports.step1")}</CardTitle>
                <CardDescription>{t("imports.step1Body")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() =>
                    void downloadFile(`/imports/${kind}/template/`, undefined, `modele-${kind}.xlsx`).catch((e) =>
                      toast.error(errorMessage(e, t)),
                    )
                  }
                >
                  <Download /> {t("imports.downloadTemplate")}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("imports.step2")}</CardTitle>
                <CardDescription>{t("imports.step2Body")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="file"
                  accept=".xlsx,.csv"
                  aria-label={t("imports.chooseFile")}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setResult(null);
                  }}
                />
                <Button onClick={() => void send(false)} disabled={!file || busy !== null}>
                  <FileSpreadsheet /> {busy === "check" ? t("imports.checking") : t("imports.check")}
                </Button>
              </CardContent>
            </Card>
          </div>

          {result && (
            <Card>
              <CardContent className="grid gap-5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: t("imports.total"), value: result.total, tone: "" },
                    { label: t("imports.valid"), value: result.valid, tone: "text-success" },
                    { label: t("imports.errors"), value: result.total - result.valid, tone: result.total - result.valid ? "text-destructive" : "" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border p-3">
                      <p className={`text-2xl font-semibold tabular-nums ${stat.tone}`}>{stat.value}</p>
                      <p className="text-muted-foreground text-xs">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {result.columns_missing.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {t("imports.missingColumns", { columns: result.columns_missing.join(", ") })}
                    </AlertDescription>
                  </Alert>
                )}

                {result.errors.length > 0 ? (
                  <>
                    <Alert variant="destructive">
                      <AlertDescription>{t("imports.fixAndRetry")}</AlertDescription>
                    </Alert>
                    <div className="max-h-96 overflow-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">{t("imports.row")}</TableHead>
                            <TableHead className="w-48">{t("imports.column")}</TableHead>
                            <TableHead>{t("imports.message")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.errors.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell className="tabular-nums">{e.row}</TableCell>
                              <TableCell>{e.column}</TableCell>
                              <TableCell className="text-destructive">{e.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  result.columns_missing.length === 0 && (
                    <Alert>
                      <CheckCircle2 />
                      <AlertDescription>{t("imports.allValid")}</AlertDescription>
                    </Alert>
                  )
                )}

                {result.preview.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">{t("imports.preview")}</p>
                    <div className="overflow-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">{t("imports.row")}</TableHead>
                            {previewColumns.map((c) => (
                              <TableHead key={c}>{c}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.preview.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="tabular-nums">{row.row}</TableCell>
                              {previewColumns.map((c) => (
                                <TableCell key={c} className="whitespace-nowrap">
                                  {row[c] ?? "—"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {canImport && (
                  <Button className="justify-self-start" onClick={() => void send(true)} disabled={busy !== null}>
                    <Upload /> {busy === "import" ? t("imports.importing") : t("imports.importButton", { count: result.valid })}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
