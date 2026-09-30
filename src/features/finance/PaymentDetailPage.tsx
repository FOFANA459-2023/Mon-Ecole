import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { Field, QueryError, Spinner } from "@/components/common";
import { DetailGrid, StatusBadge } from "@/components/display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { Payment } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { useFormatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/forms";

import { FINANCE_KEY, useMoney, usePayment } from "./api";
import { printReceipt } from "./receipt";

export function PaymentDetailPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const formatDate = useFormatDate();
  const money = useMoney();
  const id = Number(useParams().id);
  const query = usePayment(Number.isFinite(id) ? id : undefined);
  const [reversing, setReversing] = useState(false);

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Spinner className="mx-auto my-16 size-6" />;
  const payment = query.data;
  const reversed = payment.status === "reversed";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/finance/payments">
            <ArrowLeft /> {t("finance.tabs.payments")}
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printReceipt(payment, t)}>
            <Printer /> {t("finance.printReceipt")}
          </Button>
          {!reversed && can("finance.payment.reverse") && (
            <Button variant="outline" className="text-destructive" onClick={() => setReversing(true)}>
              <Undo2 /> {t("finance.reverse")}
            </Button>
          )}
        </div>
      </div>

      {reversed && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {t("finance.reversedOn", {
              date: formatDate(payment.reversed_at?.slice(0, 10)),
              name: payment.reversed_by_name ?? "—",
            })}
            {payment.reversal_reason && ` — ${payment.reversal_reason}`}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="font-mono">{payment.number}</CardTitle>
            <StatusBadge status={payment.status} />
          </CardHeader>
          <CardContent className="grid gap-6">
            <DetailGrid
              items={[
                {
                  label: t("finance.student"),
                  value: (
                    <Link className="text-primary hover:underline" to={`/students/${payment.student}?tab=payments`}>
                      {payment.student_name} · {payment.student_number}
                    </Link>
                  ),
                },
                { label: t("finance.paymentDate"), value: formatDate(payment.date) },
                { label: t("finance.method"), value: t(`finance.methods.${payment.method}`) },
                { label: t("finance.reference"), value: payment.reference },
                { label: t("finance.payerName"), value: payment.payer_name },
                { label: t("finance.receivedBy"), value: payment.received_by_name },
                ...(payment.cash_session
                  ? [
                      {
                        label: t("cash.session"),
                        value: (
                          <Link
                            className="text-primary hover:underline"
                            to={`/cash-register/sessions/${payment.cash_session.id}`}
                          >
                            {payment.cash_session.register_name}
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {payment.note && <p className="text-muted-foreground text-sm whitespace-pre-line">{payment.note}</p>}
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("finance.whatItPaid")}</p>
              {payment.allocations.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("finance.nothingAllocated")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance.description")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("finance.dueDate")}</TableHead>
                      <TableHead className="text-right">{t("finance.amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payment.allocations.map((allocation) => (
                      <TableRow key={allocation.id}>
                        <TableCell>
                          <span className="block">{allocation.description}</span>
                          <Link
                            to={`/finance/invoices/${allocation.invoice}`}
                            className="text-primary font-mono text-xs hover:underline"
                          >
                            {allocation.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{formatDate(allocation.due_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money.format(allocation.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("finance.summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3 text-base font-semibold">
                <dt>{t("finance.amountReceived")}</dt>
                <dd className={reversed ? "tabular-nums line-through" : "tabular-nums"}>{money.format(payment.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("finance.appliedToInvoices")}</dt>
                <dd className="tabular-nums">{money.format(payment.allocated)}</dd>
              </div>
              {Number(payment.unallocated) > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("finance.keptAsCredit")}</dt>
                  <dd className="tabular-nums">{money.format(payment.unallocated)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
      {reversing && <ReversePaymentDialog payment={payment} onClose={() => setReversing(false)} />}
    </>
  );
}

function ReversePaymentDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${payment.id}/reverse/`, { reason });
      await queryClient.invalidateQueries({ queryKey: [FINANCE_KEY] });
      toast.success(t("finance.paymentReversed", { number: payment.number }));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finance.reversePayment", { number: payment.number })}</DialogTitle>
          <DialogDescription>{t("finance.reversePaymentHint")}</DialogDescription>
        </DialogHeader>
        <Field label={t("common.reason")} htmlFor="r-reason">
          <Textarea id="r-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.close")}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? t("common.saving") : t("finance.confirmReverse")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
