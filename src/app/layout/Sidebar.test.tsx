import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/render";

import { SidebarContent } from "./Sidebar";

const menu = () => within(screen.getByRole("navigation")).getAllByRole("link").map((a) => a.textContent ?? "");

describe("Sidebar", () => {
  it("shows a teacher only the modules they may use", () => {
    renderPage(<SidebarContent />, {
      permissions: ["dashboard.view", "classes.view", "subjects.view", "students.view", "attendance.view", "grades.view"],
    });
    const items = menu().join(" | ");
    expect(items).toMatch(/Dashboard/);
    expect(items).toMatch(/Students/);
    expect(items).toMatch(/Classes/);
    expect(items).not.toMatch(/Enrolments/);
    expect(items).not.toMatch(/Finance/);
    expect(items).not.toMatch(/Settings/);
  });

  it("shows settings to user administrators", () => {
    renderPage(<SidebarContent />, { permissions: ["users.manage"] });
    expect(menu().join(" | ")).toMatch(/Settings/);
  });
});
