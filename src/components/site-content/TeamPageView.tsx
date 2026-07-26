import { TeamCarousel, type TeamManager } from "../TeamCarousel";
import type { SiteContentV1 } from "../../lib/site-content/schema";
import { memberContact, memberImageUrl, phoneHref } from "./member-view";

export function TeamPageView({ content }: { content: SiteContentV1["team"] }) {
  const managers: TeamManager[] = content.members
    .filter((member) => member.isVisible)
    .map((member) => {
      const contact = memberContact(member);
      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        phoneHref: phoneHref(member.phone),
        contactUrl: contact?.url,
        contactLabel: contact?.label,
        contactExternal: contact?.external ?? false,
        photoUrl: memberImageUrl(member.imageId, "card"),
        description: member.role,
      };
    });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">{content.title}</h1>
      <p className="mt-2 max-w-2xl text-text/70">{content.introduction}</p>
      {managers.length > 0 ? (
        <TeamCarousel managers={managers} />
      ) : (
        <p className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 text-text/70">
          Нет сотрудников для показа.
        </p>
      )}
    </main>
  );
}
