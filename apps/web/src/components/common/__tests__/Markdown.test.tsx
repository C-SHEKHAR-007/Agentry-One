import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { looksLikeMarkdown, Markdown, parseMarkdown, stripMarkdown } from "../Markdown";
import { TextBody } from "../TextBody";

describe("Markdown", () => {
  it("parses the blocks agents write", () => {
    const blocks = parseMarkdown("# Title\n\nIntro line\nstill intro\n\n- one\n- two\n\n1. first\n2. second\n\n> quoted\n\n```\ncode\n```\n---");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "quote", "code", "rule"]);
    expect(blocks[1]).toEqual({ type: "paragraph", text: "Intro line\nstill intro" });
    expect(blocks[3]).toEqual({ type: "list", ordered: true, items: ["first", "second"] });
  });

  it("renders inline formatting and only http(s) links", () => {
    render(<Markdown text={"**Bold** and *soft* and `code` [site](https://example.com) [bad](javascript:alert(1))"} />);
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText("soft").tagName).toBe("EM");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "site" })).toHaveAttribute("href", "https://example.com");
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(screen.getByText(/bad/)).toBeInTheDocument();
  });

  it("never turns text into HTML", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> hello'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("strips markdown for snippets", () => {
    expect(stripMarkdown("## Title\n**Bold** and `code` - [link](https://x.y)\n- item")).toBe("Title\nBold and code - link\nitem");
  });

  it("knows markdown from plain text", () => {
    expect(looksLikeMarkdown("## Hooks\n- one")).toBe(true);
    expect(looksLikeMarkdown("Just a caption with #hashtags")).toBe(false);
  });
});

describe("TextBody", () => {
  it("shows JSON as a tree, markdown rendered, and plain text as is", () => {
    const { rerender, container } = render(<TextBody text={'{"topic": "AI", "sources": [1, 2]}'} />);
    expect(screen.getByText('"topic":')).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    rerender(<TextBody text={"## Brief\n- point"} />);
    expect(screen.getByRole("heading", { name: "Brief" })).toBeInTheDocument();
    rerender(<TextBody text={"plain caption #ai"} />);
    expect(container.textContent).toBe("plain caption #ai");
  });
});
