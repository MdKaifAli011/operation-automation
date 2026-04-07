/**
 * Maps `Lead.country` (free text) to a default IANA timezone for demo scheduling.
 * Large countries use one primary zone; staff can override in the student form. See `/time-zones`.
 */

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/['’`´]/g, "'")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

const COUNTRY_TO_TIME_ZONE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  const add = (tz: string, ...names: string[]) => {
    for (const name of names) {
      const k = norm(name);
      if (k) m[k] = tz;
    }
  };

  // South Asia
  add("Asia/Kolkata", "India", "IN", "Bharat", "Republic of India");
  add("Asia/Kathmandu", "Nepal", "NP");
  add("Asia/Colombo", "Sri Lanka", "LK", "Ceylon");
  add("Asia/Dhaka", "Bangladesh", "BD");
  add("Asia/Karachi", "Pakistan", "PK");
  add("Asia/Kabul", "Afghanistan", "AF");
  add("Asia/Thimphu", "Bhutan", "BT");
  add("Indian/Maldives", "Maldives", "MV");
  add("Asia/Yangon", "Myanmar", "Burma", "MM");

  // Southeast / East Asia
  add("Asia/Singapore", "Singapore", "SG");
  add("Asia/Bangkok", "Thailand", "TH");
  add("Asia/Ho_Chi_Minh", "Vietnam", "VN", "Viet Nam");
  add("Asia/Jakarta", "Indonesia", "ID");
  add("Asia/Manila", "Philippines", "PH");
  add("Asia/Kuala_Lumpur", "Malaysia", "MY");
  add("Asia/Brunei", "Brunei", "BN");
  add("Asia/Hong_Kong", "Hong Kong", "HK");
  add("Asia/Macau", "Macau", "Macao", "MO");
  add("Asia/Taipei", "Taiwan", "TW", "Chinese Taipei");
  add("Asia/Shanghai", "China", "CN", "PRC");
  add("Asia/Seoul", "South Korea", "Korea", "KR", "ROK", "Republic of Korea");
  add("Asia/Pyongyang", "North Korea", "DPRK");
  add("Asia/Tokyo", "Japan", "JP");
  add("Asia/Ulaanbaatar", "Mongolia", "MN");

  // Middle East
  add("Asia/Dubai", "UAE", "United Arab Emirates", "Dubai", "Abu Dhabi", "Emirates");
  add("Asia/Riyadh", "Saudi Arabia", "KSA", "SA");
  add("Asia/Kuwait", "Kuwait", "KW");
  add("Asia/Qatar", "Qatar", "QA");
  add("Asia/Bahrain", "Bahrain", "BH");
  add("Asia/Muscat", "Oman", "OM");
  add("Asia/Baghdad", "Iraq", "IQ");
  add("Asia/Tehran", "Iran", "IR");
  add("Asia/Jerusalem", "Israel", "IL");
  add("Asia/Amman", "Jordan", "JO");
  add("Asia/Beirut", "Lebanon", "LB");
  add("Asia/Damascus", "Syria", "SY");
  add("Asia/Gaza", "Palestine", "PS");
  add("Asia/Yerevan", "Armenia", "AM");
  add("Asia/Baku", "Azerbaijan", "AZ");
  add("Asia/Tbilisi", "Georgia", "GE");
  add("Asia/Almaty", "Kazakhstan", "KZ");
  add("Asia/Tashkent", "Uzbekistan", "UZ");
  add("Asia/Dushanbe", "Tajikistan", "TJ");
  add("Asia/Ashgabat", "Turkmenistan", "TM");
  add("Asia/Bishkek", "Kyrgyzstan", "KG");

  // Europe
  add("Europe/London", "United Kingdom", "UK", "GB", "Great Britain", "England", "Britain", "Scotland", "Wales", "Northern Ireland");
  add("Europe/Dublin", "Ireland", "IE");
  add("Europe/Paris", "France", "FR");
  add("Europe/Berlin", "Germany", "DE", "Deutschland");
  add("Europe/Rome", "Italy", "IT");
  add("Europe/Madrid", "Spain", "ES");
  add("Europe/Lisbon", "Portugal", "PT");
  add("Europe/Amsterdam", "Netherlands", "NL", "Holland");
  add("Europe/Brussels", "Belgium", "BE");
  add("Europe/Zurich", "Switzerland", "CH");
  add("Europe/Vienna", "Austria", "AT");
  add("Europe/Stockholm", "Sweden", "SE");
  add("Europe/Oslo", "Norway", "NO");
  add("Europe/Copenhagen", "Denmark", "DK");
  add("Europe/Helsinki", "Finland", "FI");
  add("Europe/Warsaw", "Poland", "PL");
  add("Europe/Prague", "Czech Republic", "Czechia", "CZ");
  add("Europe/Bratislava", "Slovakia", "SK");
  add("Europe/Budapest", "Hungary", "HU");
  add("Europe/Bucharest", "Romania", "RO");
  add("Europe/Sofia", "Bulgaria", "BG");
  add("Europe/Athens", "Greece", "GR");
  add("Europe/Istanbul", "Turkey", "TR", "Türkiye");
  add("Europe/Kyiv", "Ukraine", "UA", "Kiev");
  add("Europe/Moscow", "Russia", "RU");
  add("Europe/Minsk", "Belarus", "BY");
  add("Europe/Vilnius", "Lithuania", "LT");
  add("Europe/Riga", "Latvia", "LV");
  add("Europe/Tallinn", "Estonia", "EE");

  // Americas (primary zones)
  add("America/New_York", "United States", "USA", "US", "United States of America");
  add("America/Toronto", "Canada", "CA");
  add("America/Mexico_City", "Mexico", "MX");
  add("America/Sao_Paulo", "Brazil", "BR");
  add("America/Argentina/Buenos_Aires", "Argentina", "AR");
  add("America/Santiago", "Chile", "CL");
  add("America/Bogota", "Colombia", "CO");
  add("America/Lima", "Peru", "PE");
  add("America/Caracas", "Venezuela", "VE");

  // Oceania
  add("Australia/Sydney", "Australia", "AU");
  add("Pacific/Auckland", "New Zealand", "NZ");

  // Africa (sample of common)
  add("Africa/Johannesburg", "South Africa", "ZA");
  add("Africa/Cairo", "Egypt", "EG");
  add("Africa/Lagos", "Nigeria", "NG");
  add("Africa/Nairobi", "Kenya", "KE");
  add("Africa/Casablanca", "Morocco", "MA");
  add("Africa/Algiers", "Algeria", "DZ");
  add("Africa/Accra", "Ghana", "GH");

  return m;
})();

export function defaultTimeZoneForCountry(country: string): string {
  const k = norm(country);
  if (!k) return "Asia/Kolkata";
  if (COUNTRY_TO_TIME_ZONE[k]) return COUNTRY_TO_TIME_ZONE[k];
  const stripped = k.replace(/,/g, "");
  if (COUNTRY_TO_TIME_ZONE[stripped]) return COUNTRY_TO_TIME_ZONE[stripped];
  return "Asia/Kolkata";
}

/** Sorted rows for the `/time-zones` reference (one row per canonical country label). */
export function listCountryDefaultTimezoneRows(): { country: string; timeZone: string }[] {
  const seen = new Set<string>();
  const rows: { country: string; timeZone: string }[] = [];
  const addRow = (country: string, tz: string) => {
    const key = `${country}|${tz}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ country, timeZone: tz });
  };

  addRow("India", "Asia/Kolkata");
  addRow("Nepal", "Asia/Kathmandu");
  addRow("Sri Lanka", "Asia/Colombo");
  addRow("Bangladesh", "Asia/Dhaka");
  addRow("Pakistan", "Asia/Karachi");
  addRow("Afghanistan", "Asia/Kabul");
  addRow("Bhutan", "Asia/Thimphu");
  addRow("Maldives", "Indian/Maldives");
  addRow("Myanmar", "Asia/Yangon");
  addRow("Singapore", "Asia/Singapore");
  addRow("Thailand", "Asia/Bangkok");
  addRow("Vietnam", "Asia/Ho_Chi_Minh");
  addRow("Indonesia", "Asia/Jakarta");
  addRow("Philippines", "Asia/Manila");
  addRow("Malaysia", "Asia/Kuala_Lumpur");
  addRow("Brunei", "Asia/Brunei");
  addRow("Hong Kong", "Asia/Hong_Kong");
  addRow("Macau", "Asia/Macau");
  addRow("Taiwan", "Asia/Taipei");
  addRow("China", "Asia/Shanghai");
  addRow("South Korea", "Asia/Seoul");
  addRow("North Korea", "Asia/Pyongyang");
  addRow("Japan", "Asia/Tokyo");
  addRow("Mongolia", "Asia/Ulaanbaatar");
  addRow("United Arab Emirates", "Asia/Dubai");
  addRow("Saudi Arabia", "Asia/Riyadh");
  addRow("Kuwait", "Asia/Kuwait");
  addRow("Qatar", "Asia/Qatar");
  addRow("Bahrain", "Asia/Bahrain");
  addRow("Oman", "Asia/Muscat");
  addRow("Iraq", "Asia/Baghdad");
  addRow("Iran", "Asia/Tehran");
  addRow("Israel", "Asia/Jerusalem");
  addRow("Jordan", "Asia/Amman");
  addRow("Lebanon", "Asia/Beirut");
  addRow("Syria", "Asia/Damascus");
  addRow("Palestine", "Asia/Gaza");
  addRow("Armenia", "Asia/Yerevan");
  addRow("Azerbaijan", "Asia/Baku");
  addRow("Georgia", "Asia/Tbilisi");
  addRow("Kazakhstan", "Asia/Almaty");
  addRow("Uzbekistan", "Asia/Tashkent");
  addRow("Tajikistan", "Asia/Dushanbe");
  addRow("Turkmenistan", "Asia/Ashgabat");
  addRow("Kyrgyzstan", "Asia/Bishkek");
  addRow("United Kingdom", "Europe/London");
  addRow("Ireland", "Europe/Dublin");
  addRow("France", "Europe/Paris");
  addRow("Germany", "Europe/Berlin");
  addRow("Italy", "Europe/Rome");
  addRow("Spain", "Europe/Madrid");
  addRow("Portugal", "Europe/Lisbon");
  addRow("Netherlands", "Europe/Amsterdam");
  addRow("Belgium", "Europe/Brussels");
  addRow("Switzerland", "Europe/Zurich");
  addRow("Austria", "Europe/Vienna");
  addRow("Sweden", "Europe/Stockholm");
  addRow("Norway", "Europe/Oslo");
  addRow("Denmark", "Europe/Copenhagen");
  addRow("Finland", "Europe/Helsinki");
  addRow("Poland", "Europe/Warsaw");
  addRow("Czech Republic", "Europe/Prague");
  addRow("Slovakia", "Europe/Bratislava");
  addRow("Hungary", "Europe/Budapest");
  addRow("Romania", "Europe/Bucharest");
  addRow("Bulgaria", "Europe/Sofia");
  addRow("Greece", "Europe/Athens");
  addRow("Turkey", "Europe/Istanbul");
  addRow("Ukraine", "Europe/Kyiv");
  addRow("Russia", "Europe/Moscow");
  addRow("Belarus", "Europe/Minsk");
  addRow("Lithuania", "Europe/Vilnius");
  addRow("Latvia", "Europe/Riga");
  addRow("Estonia", "Europe/Tallinn");
  addRow("United States (default: Eastern)", "America/New_York");
  addRow("Canada (default: Eastern)", "America/Toronto");
  addRow("Mexico", "America/Mexico_City");
  addRow("Brazil", "America/Sao_Paulo");
  addRow("Argentina", "America/Argentina/Buenos_Aires");
  addRow("Chile", "America/Santiago");
  addRow("Colombia", "America/Bogota");
  addRow("Peru", "America/Lima");
  addRow("Venezuela", "America/Caracas");
  addRow("Australia (default: Sydney)", "Australia/Sydney");
  addRow("New Zealand", "Pacific/Auckland");
  addRow("South Africa", "Africa/Johannesburg");
  addRow("Egypt", "Africa/Cairo");
  addRow("Nigeria", "Africa/Lagos");
  addRow("Kenya", "Africa/Nairobi");
  addRow("Morocco", "Africa/Casablanca");
  addRow("Algeria", "Africa/Algiers");
  addRow("Ghana", "Africa/Accra");

  rows.sort((a, b) => a.country.localeCompare(b.country));
  return rows;
}
