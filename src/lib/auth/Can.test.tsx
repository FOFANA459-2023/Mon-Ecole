import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { authValue, makeUser, WithAuth } from "@/test/auth";

import { Can } from "./Can";

function renderWith(permissions: string[], ui: React.ReactNode) {
  return render(<WithAuth value={authValue(makeUser(permissions))}>{ui}</WithAuth>);
}

describe("<Can>", () => {
  it("shows content the user is allowed to use", () => {
    renderWith(["grades.enter"], <Can permission="grades.enter">Enter grades</Can>);
    expect(screen.getByText("Enter grades")).toBeInTheDocument();
  });

  it("hides content without the permission and shows the fallback", () => {
    renderWith(
      ["grades.enter"],
      <Can permission="finance.view" fallback={<span>No access</span>}>
        Finance
      </Can>,
    );
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
    expect(screen.getByText("No access")).toBeInTheDocument();
  });

  it("accepts any of several permissions", () => {
    renderWith(["audit.view"], <Can anyOf={["users.manage", "audit.view"]}>Settings</Can>);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
