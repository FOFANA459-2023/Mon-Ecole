import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";
import { api, server } from "@/test/server";

import { todayIn } from "./api";
import { AttendanceDayPage } from "./AttendanceDayPage";
import { RegisterPage } from "./RegisterPage";
import { StaffAttendancePage } from "./StaffAttendancePage";
import { StudentAttendanceTab } from "./StudentAttendanceTab";

const TODAY = todayIn("Africa/Conakry");

const sheet = {
  class_group: 3,
  class_name: "7ème A",
  date: TODAY,
  register: null,
  taken_by_name: "",
  taken_at: null,
  updated_by_name: "",
  updated_at: null,
  can_edit: true,
  can_take_today: true,
  students: [
    { enrollment: 501, student: 7, student_name: "Awa Diallo", student_number: "STU-07", status: null, minutes_late: null, note: "" },
    { enrollment: 502, student: 8, student_name: "Binta Bah", student_number: "STU-08", status: null, minutes_late: null, note: "" },
    { enrollment: 503, student: 9, student_name: "Moussa Condé", student_number: "STU-09", status: null, minutes_late: null, note: "" },
  ],
};

describe("AttendanceDayPage", () => {
  it("lists the day's classes with whether their register is taken", async () => {
    server.use(
      http.get(api("/attendance/day/"), () =>
        HttpResponse.json([
          {
            class_group: 3, class_name: "7ème A", level_name: "7ème", student_count: 3, register: 12,
            taken_by_name: "Mamadou Barry", taken_at: "2026-10-15T08:02:00Z",
            present: 1, absent: 1, late: 1, excused: 0, can_take: true,
          },
          {
            class_group: 4, class_name: "7ème B", level_name: "7ème", student_count: 30, register: null,
            taken_by_name: "", taken_at: null, present: 0, absent: 0, late: 0, excused: 0, can_take: true,
          },
        ]),
      ),
    );
    renderPage(<AttendanceDayPage />, { path: "/attendance", permissions: ["attendance.view", "attendance.record"] });
    expect(await screen.findByText("1 of 2 registers taken")).toBeInTheDocument();
    expect(screen.getByText("1 absent")).toBeInTheDocument();
    expect(screen.getByText(/Taken by Mamadou Barry/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Take the register/ })).toHaveAttribute("href", "/attendance/classes/4");
  });
});

describe("RegisterPage", () => {
  const renderRegister = (data: object = sheet) => {
    let posted: unknown = null;
    server.use(
      http.get(api("/attendance/register/"), () => HttpResponse.json(data)),
      http.post(api("/attendance/register/"), async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ ...data, register: 12 });
      }),
    );
    renderPage(<RegisterPage />, {
      path: "/attendance/classes/3",
      pattern: "/attendance/classes/:id",
      permissions: ["attendance.view", "attendance.record"],
    });
    return () => posted;
  };

  it("marks nobody in advance and saves only once the teacher has marked everyone", async () => {
    const posted = renderRegister();
    const binta = await screen.findByRole("radiogroup", { name: "Attendance of Binta Bah" });
    expect(within(binta).getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toEqual([]);
    const save = screen.getByRole("button", { name: /Save the register/ });
    expect(save).toBeDisabled();
    expect(screen.getByRole("status", { name: "Summary" })).toHaveTextContent("3 students still to mark");

    await userEvent.click(within(binta).getByRole("radio", { name: "Absent" }));
    const moussa = screen.getByRole("radiogroup", { name: "Attendance of Moussa Condé" });
    await userEvent.click(within(moussa).getByRole("radio", { name: "Late" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Minutes late — Moussa Condé" }), "15");
    expect(save).toBeDisabled();
    const awa = screen.getByRole("radiogroup", { name: "Attendance of Awa Diallo" });
    await userEvent.click(within(awa).getByRole("radio", { name: "Present" }));
    expect(screen.getByRole("status", { name: "Summary" })).toHaveTextContent("1 present");
    await userEvent.click(save);
    await waitFor(() =>
      expect(posted()).toEqual({
        class_group: 3,
        date: TODAY,
        records: [
          { enrollment: 501, status: "present", minutes_late: null, note: "" },
          { enrollment: 502, status: "absent", minutes_late: null, note: "" },
          { enrollment: 503, status: "late", minutes_late: 15, note: "" },
        ],
      }),
    );
  });

  it("can mark the remaining students present in one tap, as the teacher's own choice", async () => {
    renderRegister();
    const binta = await screen.findByRole("radiogroup", { name: "Attendance of Binta Bah" });
    expect(screen.queryByRole("button", { name: /remaining students present/ })).not.toBeInTheDocument();
    await userEvent.click(within(binta).getByRole("radio", { name: "Absent" }));
    await userEvent.click(screen.getByRole("button", { name: "Mark the 2 remaining students present" }));
    expect(screen.getByRole("status", { name: "Summary" })).toHaveTextContent("2 present");
    expect(screen.getByRole("button", { name: /Save the register/ })).toBeEnabled();
  });

  it("is read-only when the user may not change it", async () => {
    renderRegister({ ...sheet, register: 12, taken_by_name: "Mamadou Barry", taken_at: "2026-10-14T08:00:00Z", can_edit: false });
    expect(await screen.findByText(/can view this register but not change it/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Absent" })[0]).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });
});

describe("StaffAttendancePage", () => {
  it("records the people marked, with leave; nobody is marked in advance", async () => {
    let posted: unknown = null;
    server.use(
      http.get(api("/attendance/staff/"), () =>
        HttpResponse.json({
          date: TODAY,
          staff: [
            { staff: 1, full_name: "Mamadou Barry", position: "Maths teacher", staff_type: "teacher", recorded: false, status: null, minutes_late: null, note: "" },
            { staff: 2, full_name: "Aïssatou Sylla", position: "", staff_type: "support", recorded: false, status: null, minutes_late: null, note: "" },
          ],
        }),
      ),
      http.post(api("/attendance/staff/"), async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ date: TODAY, staff: [] });
      }),
    );
    renderPage(<StaffAttendancePage />, { path: "/attendance/staff", permissions: ["attendance.staff"] });
    const sylla = await screen.findByRole("radiogroup", { name: "Attendance of Aïssatou Sylla" });
    expect(screen.getByText("Support staff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save staff attendance/ })).toBeDisabled();
    await userEvent.click(within(sylla).getByRole("radio", { name: "On leave" }));
    await userEvent.click(screen.getByRole("button", { name: /Save staff attendance/ }));
    await waitFor(() =>
      expect(posted).toEqual({ date: TODAY, entries: [{ staff: 2, status: "leave", minutes_late: null, note: "" }] }),
    );
  });
});

describe("StudentAttendanceTab", () => {
  it("shows the year's totals and every absence", async () => {
    server.use(
      http.get(api("/attendance/students/7/"), () =>
        HttpResponse.json({
          academic_year: 1, days: 20, present: 17, absent: 2, late: 1, excused: 0,
          events: [
            { date: "2026-10-15", class_name: "7ème A", status: "late", minutes_late: 10, note: "Bus" },
            { date: "2026-10-14", class_name: "7ème A", status: "absent", minutes_late: null, note: "" },
          ],
        }),
      ),
    );
    renderPage(<StudentAttendanceTab studentId={7} />, { permissions: ["attendance.view"] });
    expect(await screen.findByText("Bus")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText(/Late · 10 min/)).toBeInTheDocument();
  });
});
