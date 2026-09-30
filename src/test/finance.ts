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
    paid: "0.00",
    balance: "270000.00",
  })),
  payments: [] as object[],
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

export const payment = {
  id: 9,
  number: "REC-2026-000009",
  student: 7,
  student_name: "Awa Diallo",
  student_number: "STU-2026-00007",
  date: "2026-09-15",
  amount: "300000.00",
  method: "mobile_money",
  reference: "OM-4411",
  payer_name: "Mariama Diallo",
  note: "",
  status: "posted",
  allocated: "270000.00",
  unallocated: "30000.00",
  received_by_name: "Fatoumata Sylla",
  created_at: "2026-09-15T10:02:00Z",
  reversed_at: null,
  reversed_by_name: null,
  reversal_reason: "",
  allocations: [
    {
      id: 1,
      invoice_line: 1,
      invoice: 5,
      invoice_number: "INV-2026-000005",
      description: "Tuition — installment 1 of 3",
      due_date: "2026-10-01",
      amount: "270000.00",
    },
  ],
};

export const account = {
  student: 7,
  student_name: "Awa Diallo",
  student_number: "STU-2026-00007",
  invoiced: "1325000.00",
  paid: "0.00",
  balance: "1325000.00",
  overdue: "250000.00",
  credit: "0.00",
  open_lines: [
    { id: 11, invoice: 5, invoice_number: "INV-2026-000005", description: "Registration", due_date: "2026-09-01" },
    { id: 12, invoice: 5, invoice_number: "INV-2026-000005", description: "Tuition — installment 1 of 3", due_date: "2026-10-01" },
    { id: 21, invoice: 6, invoice_number: "INV-2026-000006", description: "Uniform", due_date: "2026-11-01" },
  ].map((line, index) => {
    const balance = ["250000.00", "1000000.00", "75000.00"][index];
    return { ...line, category_name: "Fees", net: balance, paid: "0.00", balance, is_overdue: index === 0 };
  }),
};

export const openSessionBrief = {
  id: 31,
  opened_at: "2026-09-30T07:45:00Z",
  opened_by_name: "Fatoumata Sylla",
  opening_balance: "150000.00",
  expected: "600000.00",
};

export const registers = [
  { id: 1, name: "Caisse principale", is_active: true, open_session: openSessionBrief, last_counted: "150000.00" },
  { id: 2, name: "Caisse annexe", is_active: true, open_session: null, last_counted: "40000.00" },
];

export const cashSession = {
  id: 31,
  register: 1,
  register_name: "Caisse principale",
  status: "open",
  opened_at: "2026-09-30T07:45:00Z",
  opened_by_name: "Fatoumata Sylla",
  opening_balance: "150000.00",
  opening_note: "",
  money_in: "535000.00",
  money_out: "85000.00",
  expected: "600000.00",
  closed_at: null,
  closed_by_name: null,
  expected_closing: null,
  counted_closing: null,
  difference: null,
  closing_note: "",
  by_source: [
    { source: "payment", direction: "in", count: 1, total: "535000.00" },
    { source: "expense", direction: "out", count: 1, total: "85000.00" },
  ],
  movements: [
    {
      id: 1,
      created_at: "2026-09-30T08:02:00Z",
      direction: "in",
      source: "payment",
      amount: "535000.00",
      description: "REC-2026-000009 — Awa Diallo",
      created_by_name: "Fatoumata Sylla",
      payment: 9,
      payment_number: "REC-2026-000009",
      expense: null,
      expense_number: null,
      refund: null,
      student: 7,
    },
    {
      id: 2,
      created_at: "2026-09-30T09:15:00Z",
      direction: "out",
      source: "expense",
      amount: "85000.00",
      description: "EXP-2026-000001 — Chalk and markers",
      created_by_name: "Fatoumata Sylla",
      payment: null,
      payment_number: null,
      expense: 1,
      expense_number: "EXP-2026-000001",
      refund: null,
      student: null,
    },
  ],
};

export const expense = {
  id: 1,
  number: "EXP-2026-000001",
  date: "2026-09-30",
  category: "supplies",
  amount: "85000.00",
  method: "cash",
  payee: "Librairie Kaloum",
  reference: "",
  description: "Chalk and markers",
  status: "recorded",
  recorded_by_name: "Fatoumata Sylla",
  created_at: "2026-09-30T09:15:00Z",
  cancelled_at: null,
  cancelled_by_name: null,
  cancel_reason: "",
  cash_session: { id: 31, register_name: "Caisse principale" },
};

export const refund = {
  id: 4,
  student: 7,
  student_name: "Awa Diallo",
  student_number: "STU-2026-00007",
  date: "2026-09-30",
  amount: "20000.00",
  method: "cash",
  reference: "",
  reason: "Paid twice",
  status: "posted",
  refunded_by_name: "Fatoumata Sylla",
  created_at: "2026-09-30T10:00:00Z",
  cancelled_at: null,
  cancelled_by_name: null,
  cancel_reason: "",
  cash_session: { id: 31, register_name: "Caisse principale" },
};
