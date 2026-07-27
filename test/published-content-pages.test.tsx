import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import PublicLayout from "../src/app/(public)/layout";
import Home from "../src/app/(public)/page";
import AboutPage from "../src/app/(public)/about/page";
import TeamPage from "../src/app/(public)/team/page";
import ContactsPage from "../src/app/(public)/contacts/page";
import ObjectPage from "../src/app/(public)/object/[id]/page";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";
import { createSiteContentStore } from "../src/lib/site-content/store";

const getPublishedContent = vi.hoisted(() => vi.fn());
const getFeaturedProperties = vi.hoisted(() => vi.fn());
const propertyFindUnique = vi.hoisted(() => vi.fn());

vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ variable: "--font-cormorant" }),
  Manrope: () => ({ variable: "--font-manrope" }),
}));
vi.mock("../src/lib/site-content/published", () => ({ getPublishedContent }));
vi.mock("../src/lib/featured", () => ({ getFeaturedProperties }));
vi.mock("../src/components/PropertyCard", () => ({ PropertyCard: () => null }));
vi.mock("@/lib/format", () => ({ formatPrice: (price: number) => `${price} ₽` }));
vi.mock("@/lib/property-content", () => ({
  normalizePropertyDescription: (value: string | null) => value,
  normalizeStoredPropertyDistrict: (value: string | null) => value,
}));
vi.mock("@/lib/manager-profiles", async () =>
  import("../src/lib/manager-profiles"),
);
vi.mock("@/components/AgentCard", () => ({
  AgentCard: ({ name, phone, photo, telegram }: {
    name: string;
    phone: string | null;
    photo: string | null;
    telegram?: string;
  }) => (
    <div>
      <span>{name}</span>
      <span>{phone}</span>
      <span>{photo}</span>
      <span>{telegram}</span>
    </div>
  ),
}));
vi.mock("@/components/LeadForm", () => ({
  LeadForm: ({ copy }: {
    copy: { title: string; successHelper: string };
  }) => (
    <div>
      <span>{copy.title}</span>
      <span>{copy.successHelper}</span>
    </div>
  ),
}));
vi.mock("@/components/PropertyDescription", () => ({
  PropertyDescription: () => null,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    property: {
      findUnique: propertyFindUnique,
    },
  },
}));

function cloneDefault() {
  return structuredClone(DEFAULT_SITE_CONTENT);
}

beforeEach(() => {
  getPublishedContent.mockReset();
  getPublishedContent.mockResolvedValue(cloneDefault());
  getFeaturedProperties.mockReset();
  getFeaturedProperties.mockResolvedValue([]);
  propertyFindUnique.mockReset();
});

test("public home renders published content and never the stored draft", async () => {
  const draft = cloneDefault();
  const published = cloneDefault();
  draft.home.heroHeading = "Секретный черновой заголовок";
  published.home.heroHeading = "Опубликованный заголовок главной";
  const store = createSiteContentStore({
    siteContent: {
      findUnique: async () => ({ draft, published, previousPublished: null }),
    },
  });
  getPublishedContent.mockImplementation(store.getPublishedContent);

  const html = renderToStaticMarkup(await Home());

  expect(html).toContain("Опубликованный заголовок главной");
  expect(html).not.toContain("Секретный черновой заголовок");
  expect(getFeaturedProperties).toHaveBeenCalledOnce();
});

test("public layout renders published navigation and footer fields", async () => {
  const published = cloneDefault();
  published.navigation.home = "Опубликованная главная";
  published.navigation.team = "Опубликованные специалисты";
  published.footer.tagline = "Опубликованный слоган";
  published.footer.sectionsTitle = "Опубликованные разделы";
  published.footer.contactsTitle = "Опубликованные реквизиты";
  published.footer.address = "Опубликованный адрес офиса";
  published.footer.phone = "+7 (949) 123-45-67";
  published.footer.email = "published@example.com";
  published.footer.copyright = "Опубликованное правообладательское имя";
  getPublishedContent.mockResolvedValue(published);

  const html = renderToStaticMarkup(
    await PublicLayout({ children: <p>Содержимое страницы</p> }),
  );

  expect(html).toContain("Опубликованная главная");
  expect(html).toContain("Опубликованные специалисты");
  expect(html).toContain("Опубликованный слоган");
  expect(html).toContain("Опубликованные разделы");
  expect(html).toContain("Опубликованные реквизиты");
  expect(html).toContain("Опубликованный адрес офиса");
  expect(html).toContain('href="tel:+79491234567"');
  expect(html).toContain('href="mailto:published@example.com"');
  expect(html).toContain("Опубликованное правообладательское имя");
});

test("about, team, and contacts share the ordered visible published content", async () => {
  const published = cloneDefault();
  published.about.title = "Опубликовано о компании";
  const first = { ...published.team.members[2], name: "Первый видимый" };
  const hidden = {
    ...published.team.members[0],
    name: "Скрытый сотрудник",
    isVisible: false,
  };
  const second = { ...published.team.members[1], name: "Второй видимый" };
  published.team.members = [first, hidden, second];
  getPublishedContent.mockResolvedValue(published);

  const aboutHtml = renderToStaticMarkup(await AboutPage());
  const teamHtml = renderToStaticMarkup(await TeamPage());
  const contactsHtml = renderToStaticMarkup(await ContactsPage());

  expect(aboutHtml).toContain("Опубликовано о компании");
  for (const html of [teamHtml, contactsHtml]) {
    expect(html).not.toContain("Скрытый сотрудник");
    expect(html.indexOf("Первый видимый")).toBeLessThan(
      html.indexOf("Второй видимый"),
    );
  }
});

test("renders all newly versioned About and Contacts copy from the publication", async () => {
  const published = cloneDefault();
  published.about.statistics = [
    { value: "17", label: "лет опубликованного опыта" },
  ];
  published.contacts.introduction = "Опубликованное вступление контактов";
  published.contacts.businessHoursLabel = "Опубликованные часы";
  published.contacts.businessHours = "По предварительной записи";
  published.contacts.form.title = "Опубликованная форма";
  published.contacts.form.nameLabel = "Опубликованная подпись имени";
  published.contacts.form.successHelper =
    "Опубликованное пояснение после отправки";
  getPublishedContent.mockResolvedValue(published);
  propertyFindUnique.mockResolvedValue({
    id: "object-form-copy",
    shortId: 102,
    objectType: "Дом",
    title: "Объект с формой",
    price: 7_000_000,
    rooms: null,
    area: null,
    district: null,
    address: null,
    description: null,
    photos: [],
    agent: null,
  });

  const [aboutHtml, contactsHtml, objectHtml] = [
    renderToStaticMarkup(await AboutPage()),
    renderToStaticMarkup(await ContactsPage()),
    renderToStaticMarkup(
      await ObjectPage({
        params: Promise.resolve({ id: "object-form-copy" }),
      }),
    ),
  ];

  expect(aboutHtml).toContain("17");
  expect(aboutHtml).toContain("лет опубликованного опыта");
  expect(contactsHtml).toContain("Опубликованное вступление контактов");
  expect(contactsHtml).toContain("Опубликованные часы");
  expect(contactsHtml).toContain("По предварительной записи");
  expect(contactsHtml).not.toContain("Опубликованная форма");
  expect(contactsHtml).not.toContain("Опубликованная подпись имени");
  expect(objectHtml).toContain("Опубликованная форма");
  expect(objectHtml).toContain("Опубликованное пояснение после отправки");
});

test("contacts derives the map destination from a changed published address", async () => {
  const published = cloneDefault();
  published.contacts.address = "г. Донецк, ул. Новая, 7";
  getPublishedContent.mockResolvedValue(published);

  const html = renderToStaticMarkup(await ContactsPage());
  const encodedMapAddress = html.match(
    /<iframe src="https:\/\/yandex\.ru\/map-widget\/v1\/\?mode=search&amp;text=([^&"]+)&amp;z=16"/,
  )?.[1];

  expect(decodeURIComponent(encodedMapAddress ?? "")).toBe(
    "г. Донецк, ул. Новая, 7",
  );
});

test("object page uses the visible published member with the exact Topnlab ID", async () => {
  const published = cloneDefault();
  const uploadedImageId = "11111111-1111-4111-8111-111111111111";
  published.team.members[0] = {
    ...published.team.members[0],
    name: "Имя из публикации",
    phone: "+7 (949) 222-33-44",
    telegram: "published_manager",
    imageId: uploadedImageId,
    topnlabAgentId: "296892",
    isVisible: true,
  };
  getPublishedContent.mockResolvedValue(published);
  propertyFindUnique.mockResolvedValue({
    id: "object-1",
    shortId: 101,
    objectType: "Квартира",
    title: "Тестовый объект",
    price: 5_000_000,
    rooms: 2,
    area: 50,
    district: null,
    address: null,
    description: null,
    photos: [],
    agent: {
      id: "296892",
      name: "Имя из CRM",
      phone: "+7 (949) 000-00-00",
      photoUrl: "/crm/photo.webp",
    },
  });

  const html = renderToStaticMarkup(
    await ObjectPage({ params: Promise.resolve({ id: "object-1" }) }),
  );

  expect(html).toContain("Имя из публикации");
  expect(html).toContain("+7 (949) 222-33-44");
  expect(html).toContain("https://t.me/published_manager");
  expect(html).toContain(`/api/team-images/${uploadedImageId}`);
  expect(html).not.toContain("Имя из CRM");
});

test("public pages render code defaults when the published loader falls back", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const store = createSiteContentStore({
    siteContent: {
      findUnique: async () => {
        const error = new Error("database unavailable");
        error.name = "PrismaClientInitializationError";
        throw error;
      },
    },
  });
  getPublishedContent.mockImplementation(store.getPublishedContent);

  const html = renderToStaticMarkup(await TeamPage());

  expect(html).toContain(DEFAULT_SITE_CONTENT.team.title);
  expect(html).toContain(DEFAULT_SITE_CONTENT.team.members[0].name);
  expect(errorSpy).toHaveBeenCalledWith("site_content_fallback");
  errorSpy.mockRestore();
});
