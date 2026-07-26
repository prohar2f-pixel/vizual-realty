import { expect, test } from "vitest";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

test("provides a safe Russian fallback snapshot for all editable site content", () => {
  expect(DEFAULT_SITE_CONTENT.schemaVersion).toBe(1);
  expect(DEFAULT_SITE_CONTENT.home.heroTitle).toContain("земельных участков");
  expect(DEFAULT_SITE_CONTENT.footer.tagline).toBe("Продажа квартир и домов.");
  expect(DEFAULT_SITE_CONTENT.footer.sectionsTitle).toBe("Разделы");
  expect(DEFAULT_SITE_CONTENT.about.statistics).toEqual([
    { value: "№ 1", label: "в рейтинге Домклик на Юге России" },
    { value: "200+", label: "объектов в каталоге" },
  ]);
  expect(DEFAULT_SITE_CONTENT.contacts).toMatchObject({
    introduction: "",
    businessHoursLabel: "Режим работы",
    businessHours: "",
    form: {
      title: "Написать агенту",
      nameLabel: "Ваше имя",
      namePlaceholder: "Иван Иванов",
      contactLabel: "Телефон или e-mail",
      contactPlaceholder: "+7 900 000-00-00",
      messageLabel: "Сообщение (необязательно)",
      submitLabel: "Отправить заявку",
      submittingLabel: "Отправляем…",
      successTitle: "Спасибо! Заявка отправлена.",
      successHelper: "Агент свяжется с вами в ближайшее время.",
      errorText: "Не удалось отправить. Попробуйте позвонить агенту.",
    },
  });
  expect(DEFAULT_SITE_CONTENT.team.members).toHaveLength(8);
  expect(new Set(DEFAULT_SITE_CONTENT.team.members.map((member) => member.id)).size).toBe(8);
  expect(JSON.stringify(DEFAULT_SITE_CONTENT)).not.toMatch(/<script|<[^>]+>/i);
});
