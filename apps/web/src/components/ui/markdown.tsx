import { renderMarkdown } from "@/lib/markdown";
import { cn } from "./cn";

/** Контент из CMS. HTML санитизирован в renderMarkdown. */
export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  return <div className={cn("prose-drago", className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
