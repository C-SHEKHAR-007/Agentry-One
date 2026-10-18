import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { makeStore } from "../../../app/store";
import { fakeApi } from "../../../test/fakeApi";
import { SubmitAgentPage } from "../pages/SubmitAgentPage";

const agent = {
  id: "sketch-agent",
  name: "Sketch Agent",
  version: "1.2.0",
  description: "Text to image",
  status: "active",
  manifest: {
    steps: [
      {
        key: "generate",
        requiresCapability: "image-generation",
        producesArtifactKinds: ["image"],
        inputSchema: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: { type: "string", title: "Prompt", minLength: 1 },
            steps: { type: "integer", title: "Inference steps", default: 2, minimum: 1, maximum: 4 },
            seed: { type: "integer", title: "Seed" },
            style: { type: "string", title: "Style", enum: ["photo", "sketch"] },
          },
        },
      },
    ],
  },
};

const provider = {
  id: "pv1",
  name: "Local SD",
  providerType: "sd_turbo_local",
  status: "active",
  isDefault: true,
  config: { model: "sd-turbo" },
};

let restore = () => {};
afterEach(() => restore());

function renderPage(routes: Record<string, [number, unknown] | (() => [number, unknown])> = {}) {
  const api = fakeApi({
    "/agents/sketch-agent": [200, agent],
    "/projects": [200, [{ id: "p1", name: "Launch" }]],
    "/prompts?agentId=sketch-agent": [200, [{ id: "pr1", agentId: "sketch-agent", key: "hero", version: 2, template: "a red fox", createdAt: "" }]],
    "/providers?capability=image-generation": [200, [provider]],
    ...routes,
  });
  restore = api.restore;
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={["/agents/sketch-agent/submit"]}>
        <Routes>
          <Route path="/agents/:agentId/submit" element={<SubmitAgentPage />} />
          <Route path="/workflows/:id" element={<p>run page</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return api;
}

describe("SubmitAgentPage", () => {
  it("previews what will run: project, provider, model and outputs", async () => {
    renderPage();
    const preview = (await screen.findByText("What will run")).closest("div")!;
    await waitFor(() => expect(within(preview).getByText("Local SD (sd_turbo_local)")).toBeInTheDocument());
    expect(within(preview).getByText("Launch")).toBeInTheDocument();
    expect(within(preview).getByText("sd-turbo")).toBeInTheDocument();
    expect(within(preview).getByText("image")).toBeInTheDocument();
    expect(within(preview).getByText(/v1\.2\.0/)).toBeInTheDocument();
  });

  it("renders a slider, chips, a seed with dice and the saved-prompt picker", async () => {
    renderPage();
    expect(await screen.findByLabelText("Inference steps slider")).toHaveAttribute("type", "range");
    expect(screen.getByRole("radio", { name: "photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick a random seed" })).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText("Insert saved prompt"), "pr1");
    expect(screen.getByDisplayValue("a red fox")).toBeInTheDocument();
  });

  it("submits the filled inputs with the chosen provider and opens the run", async () => {
    const api = renderPage({
      "POST /projects/p1/workflows": () => [201, { id: "w1" }],
    });
    const prompt = await screen.findByPlaceholderText("Describe what you want…");
    await userEvent.type(prompt, "a lighthouse");
    await userEvent.click(screen.getByRole("radio", { name: "sketch" }));
    await userEvent.click(screen.getByRole("button", { name: "Pick a random seed" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Run agent/ })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /Run agent/ }));
    expect(await screen.findByText("run page")).toBeInTheDocument();
    expect(api.calls).toContain("POST /projects/p1/workflows");
    const body = api.bodies["POST /projects/p1/workflows"];
    expect(body).toMatchObject({ agentId: "sketch-agent", providerConfigId: "pv1", input: { prompt: "a lighthouse", style: "sketch" } });
    expect(typeof (body as { input: { seed: unknown } }).input.seed).toBe("number");
  });

  it("refuses to submit an empty required prompt", async () => {
    const api = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Run agent/ }));
    expect(api.calls).not.toContain("POST /projects/p1/workflows");
  });
});
