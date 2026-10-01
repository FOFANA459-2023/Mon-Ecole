// Sample API payloads for the grades component tests: Mr Barry's maths in 7ème A, term 1.

export const terms = [
  { id: 11, academic_year: 1, name: "Trimestre 1", order: 1, start_date: "2026-09-01", end_date: "2026-12-20" },
  { id: 12, academic_year: 1, name: "Trimestre 2", order: 2, start_date: "2027-01-05", end_date: "2027-03-31" },
];

export const yearWithTerms = {
  id: 1,
  name: "2026-2027",
  start_date: "2026-09-01",
  end_date: "2027-06-30",
  is_current: true,
  status: "open",
  terms,
};

export const gradebookItem = {
  id: 40,
  class_subject: 5,
  class_group: 3,
  class_name: "7ème A",
  level: 2,
  subject: 8,
  subject_name: "Mathématiques",
  subject_code: "MATH",
  coefficient: "4.0",
  teacher_name: "Mamadou Barry",
  term: 11,
  term_name: "Trimestre 1",
  status: "open",
  missing_policy: "exclude",
  student_count: 2,
  assessment_count: 2,
  mark_count: 3,
  is_mine: true,
};

export const gradebook = {
  ...gradebookItem,
  status_note: "",
  submitted_at: null,
  submitted_by_name: "",
  published_at: null,
  published_by_name: "",
  scale: { max_mark: "20.00", pass_mark: "10.00", decimals: 2, rank_method: "competition" },
  categories: [
    { id: 1, gradebook: 40, name: "Interrogations", weight: "1.00", method: "average", order: 0 },
    { id: 2, gradebook: 40, name: "Composition", weight: "2.00", method: "average", order: 1 },
  ],
  assessments: [
    { id: 101, gradebook: 40, category: 1, name: "Interro 1", date: "2026-10-02", max_score: "10.00", weight: "1.00" },
    { id: 102, gradebook: 40, category: 2, name: "Compo T1", date: null, max_score: "40.00", weight: "1.00" },
  ],
  can: { edit: true, submit: true, send_back: false, publish: false, reopen: false },
};

export const sheet = {
  scale: gradebook.scale,
  students: [
    {
      enrollment: 501,
      student: 7,
      student_name: "Awa Diallo",
      student_number: "STU-2026-00007",
      is_active: true,
      marks: [
        { assessment: 101, score: "8.00", excused: false, comment: "" },
        { assessment: 102, score: "30.00", excused: false, comment: "Good work" },
      ],
      categories: [
        { category: 1, mark: "16.000" },
        { category: 2, mark: "15.000" },
      ],
      mark: "15.330",
      rank: 1,
      passed: true,
      missing: 0,
    },
    {
      enrollment: 502,
      student: 8,
      student_name: "Binta Bah",
      student_number: "STU-2026-00008",
      is_active: true,
      marks: [{ assessment: 101, score: "3.00", excused: false, comment: "" }],
      categories: [
        { category: 1, mark: "6.000" },
        { category: 2, mark: null },
      ],
      mark: "6.000",
      rank: 2,
      passed: false,
      missing: 1,
    },
  ],
  assessments: [
    { assessment: 101, marked: 2, average: "5.500" },
    { assessment: 102, marked: 1, average: "30.000" },
  ],
  stats: { average: "10.670", lowest: "6.000", highest: "15.330", passed: 1, counted: 2 },
};

export const classResults = {
  scale: gradebook.scale,
  subjects: [
    {
      class_subject: 6,
      subject_name: "Français",
      subject_code: "FR",
      coefficient: "3.0",
      teacher_name: "Fatou Camara",
      gradebook: 41,
      status: "open",
      stats: { average: "15.000", lowest: "12.000", highest: "18.000", passed: 2, counted: 2 },
    },
    {
      class_subject: 5,
      subject_name: "Mathématiques",
      subject_code: "MATH",
      coefficient: "4.0",
      teacher_name: "Mamadou Barry",
      gradebook: 40,
      status: "published",
      stats: { average: "10.670", lowest: "6.000", highest: "15.330", passed: 1, counted: 2 },
    },
  ],
  students: [
    {
      enrollment: 501,
      student: 7,
      student_name: "Awa Diallo",
      student_number: "STU-2026-00007",
      marks: [
        { class_subject: 6, mark: "18.000" },
        { class_subject: 5, mark: "15.330" },
      ],
      average: "16.470",
      rank: 1,
      passed: true,
    },
    {
      enrollment: 502,
      student: 8,
      student_name: "Binta Bah",
      student_number: "STU-2026-00008",
      marks: [
        { class_subject: 6, mark: "12.000" },
        { class_subject: 5, mark: "6.000" },
      ],
      average: "8.570",
      rank: 2,
      passed: false,
    },
  ],
  stats: { average: "12.520", lowest: "8.570", highest: "16.470", passed: 1, counted: 2 },
};
