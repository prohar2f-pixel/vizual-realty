import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { AgentCard } from "../src/components/AgentCard";

test("manager avatar has the brand ring and white offset", () => {
  const html = renderToStaticMarkup(
    <AgentCard
      name="Аянот Елена"
      phone="+7 949 537 55 65"
      photo="/managers/ayanot-elena-card.webp"
    />,
  );

  expect(html).toContain("ring-[3px]");
  expect(html).toContain("ring-brand");
  expect(html).toContain("ring-offset-2");
  expect(html).toContain("ring-offset-white");
});
