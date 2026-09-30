import { ArrowLeft, Ban, HandCoins, Printer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { QueryError, Spinner } from "@/components/common";
import { DetailGrid, StatusBadge } from "@/components/display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";

import { useInvoice, useMoney } from "./api";
import { CancelInvoiceDialog } from "./InvoiceDialogs";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

export function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const formatDate = useFormatDate();
  const money = useMoney();
  const id = Number(useParams().id);
  const query = useInvoice(Number.isFinite(id) ? id : undefined);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Spinner className="mx-auto my-16 size-6" />;
  const invoice = query.data;
  const cancelled = invoice.status === "cancelled";
  // An API from before payments sends neither `payments` nor the lines' `balance`.
  const payments = invoice.payments ?? [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/finance/invoices">
            <ArrowLeft /> {t("finance.tabs.invoices")}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {!cancelled && Number(invoice.balance) > 0 && can("finance.payment.record") && (
            <Button onClick={() => setPaying(true)}>
              <HandCoins /> {t("finance.recordPayment")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => openPdf(`/invoices/${invoice.id}/pdf/`).catch((e) => toast.error(errorMessage(e, t)))}
          >
            <Printer /> {t("common.print")}
          </Button>
          {!cancelled && can("finance.invoice.cancel") && (
            <Button variant="outline" className="text-destructive" onClick={() => setCancelling(true)}>
              <Ban /> {t("finance.cancel")}
            </Button>
          )}
        </div>
      </div>

      {cancelled && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {t("finance.cancelledOn", { date: formatDate(invoice.cancelled_at?.slice(0, 10)) })}
            {invoice.cancel_reason && ` — ${invoice.cancel_reason}`}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="font-mono">{invoice.number}</CardTitle>
            <StatusBadge status={invoice.payment_status} />
          </CardHeader>
          <CardContent className="grid gap-6">
            <DetailGrid
              items={[
                {
                  label: t("finance.student"),
                  value: (
                    <Link className="text-primary hover:underline" to={`/students/${invoice.student}?tab=payments`}>
                      {invoice.student_name} · {invoice.student_number}
                    </Link>
                  ),
                },
                { label: t("classes.chooseClass"), value: invoice.class_name ?? "—" },
                { label: t("classes.year"), value: invoice.academic_year_name },
                { label: t("finance.issueDate"), value: formatDate(invoice.issue_date) },
                { label: t("finance.source"), value: t(`finance.sources.${invoice.source}`) },
              ]}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.description")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("finance.dueDate")}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t("finance.amount")}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t("finance.discount")}</TableHead>
                  <TableHead className="text-right">{t("finance.net")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t("finance.stillDue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <span className="block">{line.description}</span>
                      <span className="text-muted-foreground block text-xs sm:hidden">{formatDate(line.due_date)}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{formatDate(line.due_date)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{money.format(line.amount)}</TableCell>
                    <TableCell className="text-muted-foreground hidden text-right tabular-nums md:table-cell">
                      {Number(line.discount) ? money.format(line.discount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money.format(line.net)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {cancelled ? "—" : Number(line.balance ?? line.net) > 0 ? money.format(line.balance ?? line.net) : <StatusBadge status="paid" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {invoice.notes && <p className="text-muted-foreground text-sm whitespace-pre-line">{invoice.notes}</p>}
            {payments.length > 0 && (
              <div className="grid gap-2">
                <p className="text-sm font-medium">{t("finance.tabs.payments")}</p>
                <ul className="divide-y rounded-lg border">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        <Link to={`/finance/payments/${payment.id}`} className="text-primary font-mono text-xs hover:underline">
                          {payment.number}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatDate(payment.date)} · {t(`finance.methods.${payment.method}`)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {payment.status === "reversed" && <StatusBadge status="reversed" />}
                        <span className={payment.status === "reversed" ? "tabular-nums line-through" : "font-medium tabular-nums"}>
                          {money.format(payment.amount)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("finance.summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {[
                [t("finance.subtotal"), money.format(invoice.subtotal)],
                [t("finance.discounts"), `− ${money.format(invoice.discount_total)}`],
                [t("common.total"), money.format(invoice.total)],
                [t("finance.paid"), money.format(invoice.amount_paid)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
                <dt>{t("finance.balance")}</dt>
                <dd className="tabular-nums">{money.format(invoice.balance)}</dd>
              </div>
              {Number(invoice.overdue_amount) > 0 && (
                <div className="text-destructive flex justify-between gap-3">
                  <dt>{t("finance.overdueAmount")}</dt>
                  <dd className="tabular-nums">{money.format(invoice.overdue_amount)}</dd>
                </div>
              )}
              {invoice.next_due_date && !cancelled && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("finance.nextDue")}</dt>
                  <dd>{formatDate(invoice.next_due_date)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
      {cancelling && <CancelInvoiceDialog invoice={invoice} onClose={() => setCancelling(false)} />}
      {paying && (
        <RecordPaymentDialog
          student={{ id: invoice.student, full_name: invoice.student_name }}
          invoice={{ id: invoice.id, number: invoice.number }}
          onClose={() => setPaying(false)}
        />
      )}
    </>
  );
}
