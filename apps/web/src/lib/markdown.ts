import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "b", "i", "u", "s", "a", "ul", "ol", "li", "blockquote",
    "h2", "h3", "h4", "code", "pre", "hr", "img", "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "loading"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    // h1 зарезервирован под заголовок страницы
    h1: "h2",
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?dragotop\.ru/i.test(href);
      return {
        tagName,
        attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } : { ...attribs },
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

/** Markdown → безопасный HTML (контент из админки всё равно санитизируется: защита в глубину от XSS). */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  const html = marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
  return sanitizeHtml(html, SANITIZE);
}

/** Markdown → простой текст (для описаний, meta description). */
export function markdownToText(md: string | null | undefined, max = 200): string {
  if (!md) return "";
  const text = sanitizeHtml(marked.parse(md, { async: false }) as string, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
