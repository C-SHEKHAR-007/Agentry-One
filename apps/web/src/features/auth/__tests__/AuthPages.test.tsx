import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { makeStore } from "../../../app/store";
import { LoginPage } from "../pages/LoginPage";
import { SetupPage } from "../pages/SetupPage";

const renderPage = (page: React.ReactNode) =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>{page}</MemoryRouter>
    </Provider>,
  );

describe("auth pages", () => {
  it("login: one heading, labelled fields and who to ask for an account", () => {
    renderPage(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText(/Ask the owner of this workspace/)).toBeInTheDocument();
  });

  it("setup: labelled fields, and the password rule as a hint on the field", () => {
    renderPage(<SetupPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Set up Agentry One" })).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeRequired();
    expect(screen.getByLabelText("Last name")).toBeRequired();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("minlength", "8");
    expect(password).toHaveAccessibleDescription("At least 8 characters.");
  });
});
