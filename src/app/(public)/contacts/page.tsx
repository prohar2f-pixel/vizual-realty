import { ContactsPageView } from "../../../components/site-content/ContactsPageView";
import { DEFAULT_SITE_CONTENT } from "../../../lib/site-content/defaults";

export const metadata = { title: "Контакты" };

export default function ContactsPage() {
  return (
    <ContactsPageView
      content={DEFAULT_SITE_CONTENT.contacts}
      members={DEFAULT_SITE_CONTENT.team.members}
    />
  );
}
