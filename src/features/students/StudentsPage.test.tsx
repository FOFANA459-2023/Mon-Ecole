import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, page, server } from "@/test/server";

import { StudentsPage } from "./StudentsPage";

const awa = {
  id: 7,
  student_number: "STU-2026-00007",
  first_name: "Awa",
  last_name: "Diallo",
  full_name: "Awa Diallo",
  gender: "F",
  date_of_birth: null,
  phone: "",
  status: "active",
  photo_url: null,
  current_enrollment: {
    id: 3,
    status: "active",
    kind: "new",
    enrollment_date: "2026-09-02",
    ended_on: null,
    academic_year: 1,
    academic_year_name: "2026-2027",
    class_group: 4,
    class_name: "7ème A",
    level_name: "7ème année",
  },
  primary_guardian: { id: 2, full_name: "Mariama Bah", phone: "+224 620 00 00 00", relationship: "mother" },
};

function studentsApi(results = [awa]) {
  const requests: URL[] = [];
  server.use(
    http.get(api("/students/"), ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(page(results));
    }),
  );
  return requests;
}

const renderStudents = (permissions: string[]) =>
  renderPage(<StudentsPage />, {
    path: "/students",
    permissions,
    routes: [{ path: "/students/:id", element: <p>Student file</p> }],
  });

describe("StudentsPage", () => {
  it("lists students with their class and main guardian", async () => {
    studentsApi();
    renderStudents(["students.view"]);
    expect(await screen.findByText("DIALLO Awa")).toBeInTheDocument();
    expect(screen.getByText("7ème A")).toBeInTheDocument();
    expect(screen.getByText("Mariama Bah")).toBeInTheDocument();
  });

  it("opens the student file", async () => {
    studentsApi();
    renderStudents(["students.view"]);
    await userEvent.click(await screen.findByRole("link", { name: "DIALLO Awa" }));
    expect(await screen.findByText("Student file")).toBeInTheDocument();
  });

  it("searches on the server after the user stops typing", async () => {
    const requests = studentsApi();
    renderStudents(["students.view"]);
    await screen.findByText("DIALLO Awa");
    await userEvent.type(screen.getByRole("textbox", { name: "Search…" }), "diallo");
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("search")).toBe("diallo"));
    // Active students only by default.
    expect(requests.at(-1)?.searchParams.get("status")).toBe("active");
  });

  it("shows an empty state", async () => {
    studentsApi([]);
    renderStudents(["students.view"]);
    expect(await screen.findByText("No students match these filters.")).toBeInTheDocument();
  });

  it("offers a retry when the list cannot be loaded", async () => {
    server.use(http.get(api("/students/"), () => HttpResponse.json({}, { status: 500 })));
    renderStudents(["students.view"]);
    expect(await screen.findByText("Could not load the data.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("hides export, import and enrolment for read-only users", async () => {
    studentsApi();
    renderStudents(["students.view"]);
    await screen.findByText("DIALLO Awa");
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Import/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New enrolment/ })).not.toBeInTheDocument();
  });

  it("shows every action to the enrolment desk", async () => {
    studentsApi();
    renderStudents(["students.view", "students.export", "students.create", "enrollments.create"]);
    await screen.findByText("DIALLO Awa");
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Import/ })).toHaveAttribute("href", "/students/import");
    expect(screen.getByRole("link", { name: /New enrolment/ })).toHaveAttribute("href", "/enrollments/new");
  });
});
