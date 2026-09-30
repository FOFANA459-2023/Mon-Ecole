// Sample API payloads for the finance component tests.

export const invoiceItem = {
  id: 5,
  number: "INV-2026-000005",
  student: 7,
  student_name: "Awa Diallo",
  student_number: "STU-2026-00007",
  enrollment: 3,
  class_name: "7ème A",
  academic_year: 1,
  academic_year_name: "2026-2027",
  issue_date: "2026-09-02",
  source: "enrolment",
  status: "issued",
  subtotal: "900000.00",
  discount_total: "90000.00",
  total: "810000.00",
  amount_paid: "0.00",
  balance: "810000.00",
  overdue_amount: "270000.00",
  next_due_date: "2027-01-10",
  payment_status: "overdue",
  notes: "",
  cancelled_at: null,
  cancel_reason: "",
};

export const invoice = {
  ...invoiceItem,
  lines: [1, 2, 3].map((n) => ({
    id: n,
    category: 1,
    category_name: "Tuition",
    description: `Tuition — installment ${n} of 3`,
    due_date: ["2026-10-01", "2027-01-10", "2027-04-01"][n - 1],
    amount: "300000.00",
    discount: "30000.00",
    net: "270000.00",
  })),
};

export const tuition = { id: 1, name: "Tuition", kind: "tuition", description: "", order: 0, is_active: true };

export const level = { id: 3, name: "7ème année", order: 7, cycle: "lower_secondary", is_active: true, class_count: 2 };

export const schedule = {
  id: 9,
  academic_year: 1,
  academic_year_name: "2026-2027",
  level: 3,
  level_name: "7ème année",
  category: 1,
  category_name: "Tuition",
  applies_to: "all",
  amount: "900000.00",
  installments: [
    { label: "", due_date: "2026-10-01", amount: "300000.00" },
    { label: "", due_date: "2027-01-10", amount: "300000.00" },
    { label: "", due_date: "2027-04-01", amount: "300000.00" },
  ],
};

export const discount = {
  id: 4,
  student: 7,
  student_name: "Awa Diallo",
  student_number: "STU-2026-00007",
  academic_year: 1,
  academic_year_name: "2026-2027",
  category: 1,
  category_name: "Tuition",
  kind: "percent",
  value: "10.00",
  reason: "sibling",
  note: "",
  is_active: true,
};
