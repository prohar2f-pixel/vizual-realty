import type { TeamMemberV1 } from "../../lib/site-content/schema";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function phoneHref(phone: string | undefined) {
  if (!phone) return undefined;
  return `tel:+${phone.replace(/\D/g, "")}`;
}

export function memberImageUrl(
  imageId: string | undefined,
  variant: "card" | "avatar",
) {
  if (!imageId) return undefined;
  if (UUID_V4.test(imageId)) return `/api/team-images/${imageId}`;
  return `/managers/${imageId}${variant === "card" ? "-card" : ""}.webp`;
}

export function memberContact(member: TeamMemberV1) {
  if (member.telegram) {
    return {
      url: `https://t.me/${member.telegram}`,
      label: "Написать в Telegram",
      external: true,
    };
  }
  if (member.email) {
    return {
      url: `mailto:${member.email}`,
      label: "Написать на e-mail",
      external: false,
    };
  }
  if (member.phone) {
    return {
      url: phoneHref(member.phone) ?? "#",
      label: "Позвонить",
      external: false,
    };
  }
  return undefined;
}
