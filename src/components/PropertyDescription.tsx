export function splitPropertyDescription(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function PropertyDescription({ value }: { value: string }) {
  return (
    <div className="mt-5 space-y-3 text-[15px] leading-7 text-stone-700">
      {splitPropertyDescription(value).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
