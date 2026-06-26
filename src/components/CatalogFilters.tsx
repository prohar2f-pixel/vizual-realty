type Props = {
  districts: string[];
  current: { rooms?: string; priceMax?: string; district?: string };
};

export function CatalogFilters({ districts, current }: Props) {
  return (
    <form
      method="get"
      className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-stone-200 bg-white p-4"
    >
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Комнат</span>
        <select
          name="rooms"
          defaultValue={current.rooms ?? ""}
          className="rounded-md border border-stone-300 px-3 py-2"
        >
          <option value="">любое</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4 и больше</option>
        </select>
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Цена до, ₽</span>
        <input
          type="number"
          name="priceMax"
          defaultValue={current.priceMax ?? ""}
          placeholder="без ограничений"
          className="rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-stone-600">Район</span>
        <select
          name="district"
          defaultValue={current.district ?? ""}
          className="rounded-md border border-stone-300 px-3 py-2"
        >
          <option value="">любой</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md bg-brand px-5 py-2 font-medium text-cream transition hover:bg-brand-dark"
      >
        Показать
      </button>
      <a href="/catalog" className="px-2 py-2 text-sm text-stone-500 hover:text-stone-700">
        Сбросить
      </a>
    </form>
  );
}
