import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { PUBLISH_STATUS_LABELS, formatDate } from "@drago/shared";
import { Table, Td } from "@/components/admin/table";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Новости" };

export default async function AdminNews() {
  await requireAdmin("news.manage");
  const items = await db.news.findMany({ orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }], take: 300 });
  return (
    <>
      <PageHeader title="Новости сайта" actions={<ButtonLink href="/admin/news/new">Новая новость</ButtonLink>} />
      {items.length === 0 ? (
        <EmptyState title="Новостей пока нет" />
      ) : (
        <Table headers={["Заголовок", "Статус", "Публикация", ""]}>
          {items.map((n) => (
            <tr key={n.id}>
              <Td>
                <Link href={`/admin/news/${n.id}`} className="font-semibold hover:text-fire">
                  {n.title}
                </Link>
                <p className="text-xs text-muted">/news/{n.slug}</p>
              </Td>
              <Td>
                <Badge tone={n.status === "PUBLISHED" ? "success" : "neutral"}>{PUBLISH_STATUS_LABELS[n.status]}</Badge>
              </Td>
              <Td className="text-muted">{n.publishedAt ? formatDate(n.publishedAt) : "—"}</Td>
              <Td>
                {n.status === "PUBLISHED" && (
                  <a href={`/news/${n.slug}`} target="_blank" rel="noopener" className="text-sm font-semibold text-fire">
                    Открыть ↗
                  </a>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
