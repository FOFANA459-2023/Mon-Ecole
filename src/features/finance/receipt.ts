import type { TFunction } from "i18next";
import { toast } from "sonner";

import { openPdf } from "@/lib/files";
import { errorMessage } from "@/lib/forms";

/** Print a payment's receipt (a new tab with the PDF). */
export function printReceipt(payment: { id: number }, t: TFunction) {
  openPdf(`/payments/${payment.id}/receipt/`).catch((error) => toast.error(errorMessage(error, t)));
}
