"use client";

const LANGS = [
  { code: "uz", label: "O'zbekcha" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
] as const;

export type I18nText = Partial<Record<"uz" | "ru" | "en", string>>;

/** Uch tildagi matn maydonlari (o'zbekcha majburiy). */
export function I18nFields({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  maxLength = 600,
}: {
  label: string;
  value: I18nText;
  onChange: (v: I18nText) => void;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-ink-soft">{label}</legend>
      {LANGS.map((l) => {
        const common = {
          className: `field ${multiline ? "h-24 resize-none py-3" : ""}`,
          placeholder: l.label + (l.code === "uz" && required ? " *" : ""),
          value: value[l.code] ?? "",
          maxLength,
          required: required && l.code === "uz",
          "aria-label": `${label} — ${l.label}`,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [l.code]: e.target.value }),
        };
        return multiline ? <textarea key={l.code} {...common} /> : <input key={l.code} {...common} />;
      })}
    </fieldset>
  );
}
