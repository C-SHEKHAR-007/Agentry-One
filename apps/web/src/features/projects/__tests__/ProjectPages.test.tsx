import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { makeStore } from "../../../app/store";
import { fakeApi } from "../../../test/fakeApi";
import { routes } from "../../../services/api/routes";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ProjectPage } from "../pages/ProjectPage";
import { monogram } from "../components/ProjectCard";

const daily = Array.from({ length: 30 }, (_, i) => (i === 29 ? 6 : 0));
const project = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  userId: "u1",
  name: "Launch kit",
  createdAt: "2026-09-01T00:00:00Z",
  counts: { workflows: 12, templates: 2, artifacts: 9 },
  lastActivityAt: "2026-10-18T09:00:00Z",
  coverArtifactId: null,
  coverPreviewUrl: null,
  activity: { runs30d: 6, completed30d: 4, failed30d: 1, successRate: 0.8, daily },
  ...over,
});

let restore = () => {};
afterEach(() => restore());

function Where() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function renderAt(path: string, api: Record<string, [number, unknown]>) {
  const fake = fakeApi(api);
  restore = fake.restore;
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<><ProjectPage /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return fake;
}

describe("Projects grid", () => {
  it("shows 30-day runs, success rate and artifacts, with a monogram cover when there is no image", async () => {
    renderAt("/projects", { "/projects": [200, [project(), project({ id: "p2", name: "Empty", activity: undefined, counts: { workflows: 0, templates: 0, artifacts: 0 } })]] });
    const card = (await screen.findByText("Launch kit")).closest("a")!;
    expect(card).toHaveAttribute("href", "/projects/p1");
    expect(within(card).getByText("6")).toBeInTheDocument();
    expect(within(card).getByText("80.0%")).toBeInTheDocument();
    expect(within(card).getByText("9")).toBeInTheDocument();
    expect(within(card).getByText("LK")).toBeInTheDocument();
    // An API without activity stats still renders the card.
    const empty = screen.getByText("Empty").closest("a")!;
    expect(within(empty).getByText("—")).toBeInTheDocument();
  });

  it("uses the latest image as the cover", async () => {
    renderAt("/projects", { "/projects": [200, [project({ coverArtifactId: "a1", coverPreviewUrl: "https://cdn.example/a1.png" })]] });
    await screen.findByText("Launch kit");
    expect(document.querySelector("img")).toHaveAttribute("src", "https://cdn.example/a1.png");
  });

  it("makes monograms from up to two words", () => {
    expect(monogram("launch kit for spring")).toBe("LK");
    expect(monogram("solo")).toBe("S");
    expect(monogram("  ")).toBe("?");
  });
});

describe("Project page tabs", () => {
  const base = {
    "/projects/p1": [200, project()] as [number, unknown],
    "/projects/p1/templates": [200, [{ id: "t1", projectId: "p1", name: "Weekly post", status: "active", steps: [] }]] as [number, unknown],
    "/artifacts?limit=4&projectId=p1": [200, []] as [number, unknown],
  };

  it("opens on Overview with the 30-day stats and the workflows", async () => {
    renderAt("/projects/p1", base);
    expect(await screen.findByText("Runs · 30 days")).toBeInTheDocument();
    expect(screen.getByText("4 completed · 1 failed")).toBeInTheDocument();
    expect(screen.getByText("Weekly post")).toBeInTheDocument();
  });

  it("switches tabs through the URL, and the Artifacts tab pages through the project's artifacts", async () => {
    const page = routes.artifacts.listPage({ projectId: "p1", limit: 48, cursor: null });
    const api = renderAt("/projects/p1", { ...base, [page]: [200, { items: [], nextCursor: null }] });
    await screen.findByText("Runs · 30 days");
    await userEvent.click(screen.getAllByRole("button", { name: /Artifacts/ })[0]);
    expect(screen.getByTestId("search").textContent).toBe("?tab=artifacts");
    expect(await screen.findByText(/No artifacts yet/)).toBeInTheDocument();
    await waitFor(() => expect(api.calls).toContain(`GET ${page}`));
  });

  it("opens the tab named in the URL", async () => {
    renderAt("/projects/p1?tab=workflows", base);
    expect(await screen.findByText("Weekly post")).toBeInTheDocument();
    expect(screen.queryByText("Runs · 30 days")).not.toBeInTheDocument();
  });
});
