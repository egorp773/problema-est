export const CITY_SUGGESTIONS = [
  "Абакан",
  "Альметьевск",
  "Анапа",
  "Ангарск",
  "Архангельск",
  "Астрахань",
  "Балаково",
  "Балашиха",
  "Барнаул",
  "Белгород",
  "Березники",
  "Бийск",
  "Благовещенск",
  "Братск",
  "Брянск",
  "Великий Новгород",
  "Владивосток",
  "Владикавказ",
  "Владимир",
  "Волгоград",
  "Волжский",
  "Вологда",
  "Воронеж",
  "Грозный",
  "Дзержинск",
  "Екатеринбург",
  "Иваново",
  "Ижевск",
  "Иркутск",
  "Йошкар-Ола",
  "Казань",
  "Калининград",
  "Калуга",
  "Каменск-Уральский",
  "Кемерово",
  "Киров",
  "Комсомольск-на-Амуре",
  "Кострома",
  "Краснодар",
  "Красноярск",
  "Курган",
  "Курск",
  "Липецк",
  "Магнитогорск",
  "Махачкала",
  "Москва",
  "Мурманск",
  "Муром",
  "Мытищи",
  "Набережные Челны",
  "Нальчик",
  "Нижневартовск",
  "Нижний Новгород",
  "Нижний Тагил",
  "Новокузнецк",
  "Новороссийск",
  "Новосибирск",
  "Омск",
  "Орел",
  "Оренбург",
  "Пенза",
  "Пермь",
  "Петрозаводск",
  "Подольск",
  "Псков",
  "Ростов-на-Дону",
  "Рыбинск",
  "Рязань",
  "Самара",
  "Санкт-Петербург",
  "Саранск",
  "Саратов",
  "Севастополь",
  "Смоленск",
  "Сочи",
  "Ставрополь",
  "Сургут",
  "Сыктывкар",
  "Таганрог",
  "Тамбов",
  "Тверь",
  "Тольятти",
  "Томск",
  "Тула",
  "Тюмень",
  "Улан-Удэ",
  "Ульяновск",
  "Уфа",
  "Хабаровск",
  "Химки",
  "Чебоксары",
  "Челябинск",
  "Череповец",
  "Чита",
  "Энгельс",
  "Южно-Сахалинск",
  "Якутск",
  "Ярославль"
];

export function normalizeGeoQuery(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export function getLocalCitySuggestions(query: string, limit = 8) {
  const normalized = normalizeGeoQuery(query);
  if (!normalized) return [];

  const startsWith = CITY_SUGGESTIONS.filter((city) =>
    normalizeGeoQuery(city).startsWith(normalized)
  );
  const includes = CITY_SUGGESTIONS.filter((city) => {
    const normalizedCity = normalizeGeoQuery(city);
    return !normalizedCity.startsWith(normalized) && normalizedCity.includes(normalized);
  });

  return [...startsWith, ...includes].slice(0, limit);
}

export function mergeSuggestions(...groups: string[][]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const group of groups) {
    for (const value of group) {
      const trimmed = value.trim();
      const key = normalizeGeoQuery(trimmed);
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
  }

  return result;
}
