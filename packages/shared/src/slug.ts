const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterate(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => MAP[ch] ?? ch)
    .join("");
}

/** Человекочитаемый URL: «Выезд в лагерь 2025» → vyezd-v-lager-2025 */
export function slugify(input: string, maxLength = 80): string {
  const slug = transliterate(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "item";
}

/** Предложение локальной части почты: Иванов Иван → ivan.ivanov */
export function suggestMailbox(firstName: string, lastName: string): string {
  return `${slugify(firstName, 24)}.${slugify(lastName, 24)}`.replace(/-/g, "");
}

export const slugSchemaRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
