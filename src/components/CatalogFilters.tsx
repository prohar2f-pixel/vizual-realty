"use client";

import type { ChangeEvent } from "react";
import type { CatalogSearchParams } from "@/lib/catalog-filters";

type Props = {
  cities: string[];
  districts: string[];
  current: CatalogSearchParams;
};

export function CatalogFilters({ cities, districts, current }: Props) {
  function submitCity(event: ChangeEvent<HTMLSelectElement>) {
    const form = event.currentTarget.form;
    const district = form?.elements.namedItem("district");
    if (district instanceof HTMLSelectElement) district.value = "";
    form?.requestSubmit();
  }

  return (
    <form
      method="get"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4"
    >
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Тип объекта</span>
        <select
          name="objectType"
          defaultValue={current.objectType ?? ""}
          className="rounded-md border border-stone-300 px-3 py-2"
        >
          <option value="">Любой</option>
          <option value="flat">Квартира</option>
          <option value="house">Дом</option>
          <option value="land">Земельный участок</option>
        </select>
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Город</span>
        <select
          name="city"
          defaultValue={current.city ?? ""}
          onChange={submitCity}
          className="rounded-md border border-stone-300 px-3 py-2"
        >
          <option value="">Любой</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Район</span>
        <select
          name="district"
          defaultValue={current.district ?? ""}
          disabled={!current.city}
          className="rounded-md border border-stone-300 px-3 py-2 disabled:bg-stone-100 disabled:text-stone-500"
        >
          <option value="">
            {current.city ? "Любой" : "Сначала выберите город"}
          </option>
          {districts.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Комнаты</span>
        <select
          name="rooms"
          defaultValue={current.rooms ?? ""}
          className="rounded-md border border-stone-300 px-3 py-2"
        >
          <option value="">Любое</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4 и больше</option>
        </select>
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Цена от, ₽</span>
        <input
          type="number"
          min="0"
          name="priceMin"
          defaultValue={current.priceMin ?? ""}
          placeholder="без ограничений"
          className="rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Цена до, ₽</span>
        <input
          type="number"
          min="0"
          name="priceMax"
          defaultValue={current.priceMax ?? ""}
          placeholder="без ограничений"
          className="rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-brand px-5 py-2 font-medium text-on-brand transition hover:bg-brand-dim"
      >
        Показать
      </button>
      <a href="/catalog" className="px-2 py-2 text-sm text-stone-500 hover:text-stone-700">
        Сбросить
      </a>
    </form>
  );
}
