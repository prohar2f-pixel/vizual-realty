import Link from "next/link";
import { formatPrice } from "@/lib/format";

type Props = {
  id: string;
  title: string;
  price: number;
  rooms: number | null;
  area: number | null;
  district: string | null;
  photo: string | null;
};

export function PropertyCard({ id, title, price, rooms, area, district, photo }: Props) {
  return (
    <Link
      href={`/object/${id}`}
      className="group block overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-stone-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400">нет фото</div>
        )}
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md border border-white/50 bg-white/10 text-white backdrop-blur-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        </span>
      </div>
      <div className="p-4">
        <div className="font-display text-xl font-bold text-accent-text">{formatPrice(price)}</div>
        <div className="mt-1 line-clamp-1 font-display font-medium text-text">{title}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-500">
          {rooms != null && <span>{rooms} комн.</span>}
          {area != null && <span>{area} м²</span>}
          {district && <span>{district}</span>}
        </div>
      </div>
    </Link>
  );
}
