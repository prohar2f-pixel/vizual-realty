import { ContactsPageView } from "../../../components/site-content/ContactsPageView";
import { DEFAULT_SITE_CONTENT } from "../../../lib/site-content/defaults";
import { getPublishedContent } from "../../../lib/site-content/published";

export const metadata = { title: "Контакты" };

export default async function ContactsPage() {
  const content = await getPublishedContent();
  return (
    <ContactsPageView
      content={content.contacts}
      members={content.team.members}
      mapSearchAddress={
        content.contacts.address === DEFAULT_SITE_CONTENT.contacts.address
          ? "Донецк, улица 50-летия СССР, 142"
          : content.contacts.address
      }
    />
  );
}
