type TextFieldProps = Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  path: string;
  issue?: string;
  help?: string;
  maxLength: number;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "email" | "tel";
  disabled?: boolean;
  autoComplete?: string;
}>;

function fieldId(path: string) {
  return `content-${path.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

export function TextField({
  label,
  value,
  onChange,
  path,
  issue,
  help,
  maxLength,
  multiline = false,
  rows = 4,
  type = "text",
  disabled = false,
  autoComplete,
}: TextFieldProps) {
  const id = fieldId(path);
  const helpId = help ? `${id}-help` : undefined;
  const issueId = issue ? `${id}-issue` : undefined;
  const describedBy = [helpId, issueId].filter(Boolean).join(" ") || undefined;
  const sharedClassName =
    "mt-1 min-h-11 w-full rounded-lg border bg-surface px-3 py-2.5 text-text shadow-sm transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-muted";

  return (
    <div>
      <label className="block text-sm font-semibold text-text" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={path}
          value={value}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={issue ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.currentTarget.value)}
          className={`${sharedClassName} resize-y ${
            issue ? "border-red-500" : "border-stone-300"
          }`}
        />
      ) : (
        <input
          id={id}
          name={path}
          value={value}
          type={type}
          maxLength={maxLength}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={issue ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.currentTarget.value)}
          className={`${sharedClassName} ${
            issue ? "border-red-500" : "border-stone-300"
          }`}
        />
      )}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-xs">
        {help ? (
          <p id={helpId} className="text-muted">
            {help}
          </p>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-muted" aria-hidden="true">
          {value.length}/{maxLength}
        </span>
      </div>
      {issue && (
        <p id={issueId} className="mt-1 text-sm font-medium text-red-700">
          {issue}
        </p>
      )}
    </div>
  );
}
