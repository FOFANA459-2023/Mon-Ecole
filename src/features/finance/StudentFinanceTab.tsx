import { Ban, FilePlus2, HandCoins, Plus, ReceiptText, Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { EmptyState, QueryError, Spinner } from "@/components/common";
import { StatusBadge } from "@/components/display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentYear } from "@/features/academics/api";
import type { Refund, StudentDiscount } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";

import {
  useDiscountLabel,
  useInvoices,
  useMoney,
  usePayments,
  useRefunds,
  useStudentAccount,
  useStudentDiscounts,
} from "./api";
import { DiscountDialog } from "./DiscountDialog";
import { ManualInvoiceDialog } from "./InvoiceDialogs";
import { ReasonDialog } from "./ReasonDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { RefundDialog } from "./RefundDialog";

/** The "Payments" tab of a student's profile: balance, credit, payments, refunds, invoices and discounts. */
export function StudentFinanceTab({ student }: { student: { id: number; full_name: string } }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const formatDate = useFormatDate();
  const money = useMoney();
  const discountLabel = useDiscountLabel();
  const currentYear = useCurrentYear();
  const invoices = useInvoices({ student: student.id, page_size: 100 });
  const discounts = useStudentDiscounts({ student: student.id, page_size: 50 });
  const payments = usePayments({ student: student.id, page_size: 100 });
  const refunds = useRefunds({ student: student.id, page_size: 50 });
  const account = useStudentAccount(student.id);
  const [invoicing, setInvoicing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [cancellingRefund, setCancellingRefund] = useState<Refund | null>(null);
  const [discountDialog, setDiscountDialog] = useState<{ discount?: StudentDiscount } | null>(null);

  if (invoices.isError) return <QueryError onRetry={() => void invoices.refetch()} />;
  if (invoices.isPending) return <Spinner className="mx-auto my-10 size-6" />;
  const open = invoices.data.results.filter((i) => i.status === "issued");
  const balance = open.reduce((sum, i) => sum + Number(i.balance), 0);
  const overdue = open.reduce((sum, i) => sum + Number(i.overdue_amount), 0);
  // Money paid that no invoice has used yet and that was not refunded.
  const credit = Number(account.data?.credit ?? 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="py-4">
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("finance.balance")}</p>
            <p className="text-2xl font-semibold tabular-nums">{money.format(balance)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("finance.overdueAmount")}</p>
            <p className={overdue > 0 ? "text-destructive text-2xl font-semibold tabular-nums" : "text-2xl font-semibold tabular-nums"}>
              {money.format(overdue)}
            </p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("finance.credit")}</p>
            <p className="text-2xl font-semibold tabular-nums">{money.format(credit)}</p>
            {credit > 0 && can("finance.refund") && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setRefunding(true)}>
                <Undo2 /> {t("finance.refundCredit")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-3">
          <CardTitle className="text-base">{t("finance.tabs.payments")}</CardTitle>
          {can("finance.payment.record") && (
            <Button size="sm" onClick={() => setPaying(true)}>
              <HandCoins /> {t("finance.recordPayment")}
            </Button>
          )}
        </CardHeader>
        {(payments.data?.results ?? []).length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">{t("finance.noStudentPayments")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.receiptNumber")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("finance.paymentDate")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("finance.method")}</TableHead>
                <TableHead className="text-right">{t("finance.amount")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data?.results.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link to={`/finance/payments/${payment.id}`} className="text-primary font-mono text-xs hover:underline">
                      {payment.number}
                    </Link>
                    <span className="text-muted-foreground block text-xs sm:hidden">{formatDate(payment.date)}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(payment.date)}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {t(`finance.methods.${payment.method}`)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money.format(payment.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {(refunds.data?.results ?? []).length > 0 && (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">{t("finance.refunds")}</CardTitle>
          </CardHeader>
          <ul className="divide-y">
            {refunds.data?.results.map((refund) => (
              <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className={refund.status === "cancelled" ? "tabular-nums line-through" : "font-medium tabular-nums"}>
                    {money.format(refund.amount)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatDate(refund.date)} · {t(`finance.methods.${refund.method}`)} — {refund.reason}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={refund.status} />
                  {refund.status === "posted" && can("finance.refund") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("finance.cancelRefund")}
                      onClick={() => setCancellingRefund(refund)}
                    >
                      <Ban />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-3">
          <CardTitle className="text-base">{t("finance.tabs.invoices")}</CardTitle>
          {can("finance.invoice.create") && (
            <Button variant="outline" size="sm" onClick={() => setInvoicing(true)}>
              <FilePlus2 /> {t("finance.newInvoice")}
            </Button>
          )}
        </CardHeader>
        {invoices.data.results.length === 0 ? (
          <EmptyState icon={<ReceiptText className="size-8" />} title={t("finance.noStudentInvoices")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("finance.number")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("classes.year")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("finance.nextDue")}</TableHead>
                <TableHead className="text-right">{t("common.total")}</TableHead>
                <TableHead className="text-right">{t("finance.balance")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.data.results.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link to={`/finance/invoices/${invoice.id}`} className="text-primary font-mono text-xs hover:underline">
                      {invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{invoice.academic_year_name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {invoice.status === "issued" ? formatDate(invoice.next_due_date) || "—" : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money.format(invoice.total)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money.format(invoice.balance)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.payment_status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-3">
          <CardTitle className="text-base">{t("finance.tabs.discounts")}</CardTitle>
          {can("finance.fees.manage") && (
            <Button variant="outline" size="sm" onClick={() => setDiscountDialog({})}>
              <Plus /> {t("finance.newDiscount")}
            </Button>
          )}
        </CardHeader>
        {(discounts.data?.results ?? []).length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">{t("finance.noStudentDiscounts")}</p>
        ) : (
          <ul className="divide-y">
            {discounts.data?.results.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{discountLabel(d)}</span> · {d.category_name ?? t("finance.allCategories")}
                  <span className="text-muted-foreground">
                    {" "}
                    — {t(`finance.reasons.${d.reason}`)} ({d.academic_year_name})
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {!d.is_active && <StatusBadge status="archived" />}
                  {can("finance.fees.manage") && (
                    <Button variant="ghost" size="sm" onClick={() => setDiscountDialog({ discount: d })}>
                      {t("common.edit")}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {paying && <RecordPaymentDialog student={student} onClose={() => setPaying(false)} />}
      {refunding && <RefundDialog student={student} credit={credit} onClose={() => setRefunding(false)} />}
      {cancellingRefund && (
        <ReasonDialog
          title={t("finance.cancelRefund")}
          hint={t("finance.cancelRefundHint")}
          confirmLabel={t("finance.confirmCancelRefund")}
          path={`/refunds/${cancellingRefund.id}/cancel/`}
          success={t("finance.refundCancelled")}
          onClose={() => setCancellingRefund(null)}
        />
      )}
      {invoicing && (
        <ManualInvoiceDialog student={student} defaultYearId={currentYear?.id ?? null} onClose={() => setInvoicing(false)} />
      )}
      {discountDialog && (
        <DiscountDialog
          discount={discountDialog.discount}
          student={student}
          defaultYearId={currentYear?.id ?? null}
          onClose={() => setDiscountDialog(null)}
        />
      )}
    </div>
  );
}
