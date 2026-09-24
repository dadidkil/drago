import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown (XSS)", () => {
  it("strips script tags and event handlers", () => {
    const html = renderMarkdown('Привет <script>alert(1)</script><img src="https://x/y.png" onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });
  it("drops javascript: links", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });
  it("marks external links noopener", () => {
    const html = renderMarkdown("[vk](https://vk.com/top_drago)");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
  it("keeps basic formatting and demotes h1", () => {
    const html = renderMarkdown("# Заголовок\n\n**жирный**");
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>жирный</strong>");
  });
  it("disallows non-https images", () => {
    expect(renderMarkdown("![x](http://evil/x.png)")).not.toContain("http://evil");
  });
});
