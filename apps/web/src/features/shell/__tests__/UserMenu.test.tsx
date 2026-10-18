import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { makeStore } from "../../../app/store";
import { UserMenu } from "../components/Topbar";

const user = { id: "u1", email: "chandra@example.com", firstName: "Chandra", lastName: "Shekhar", avatarUrl: null, role: "owner" };

function renderMenu(u: Record<string, unknown> = user) {
  const store = makeStore({ auth: { status: "authed", user: u } } as never);
  render(
    <Provider store={store}>
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    </Provider>,
  );
}

describe("UserMenu", () => {
  it("shows only the picture in the header", () => {
    renderMenu();
    const button = screen.getByRole("button", { name: "Account menu for Chandra Shekhar" });
    expect(button).toHaveTextContent(/^CS$/);
    expect(screen.queryByText("chandra@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("owner")).not.toBeInTheDocument();
  });

  it("shows name, email and role in the card that opens on click", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /^Account menu/ }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Chandra Shekhar")).toBeInTheDocument();
    expect(within(menu).getByText("chandra@example.com")).toBeInTheDocument();
    expect(within(menu).getByText("owner")).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: /Team/ })).toBeInTheDocument();
  });

  it("leads with the email when there is no name, and closes on Escape", async () => {
    renderMenu({ ...user, firstName: null, lastName: null, role: "member" });
    await userEvent.click(screen.getByRole("button", { name: "Account menu for chandra@example.com" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("chandra@example.com")).toBeInTheDocument();
    expect(within(menu).getByText("member")).toBeInTheDocument();
    expect(within(menu).queryByRole("link", { name: /Team/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes when a link is followed", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /^Account menu/ }));
    await userEvent.click(within(screen.getByRole("menu")).getByRole("link", { name: /Profile/ }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
