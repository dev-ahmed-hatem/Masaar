"""The Arab League countries the platform can operate in.

One row per country: ISO code, names, international dial code, ISO 4217 currency
and IANA timezone. It seeds `Market` rows (migration 0002) and drives phone
normalization (`accounts.utils.normalize_phone`). The web client mirrors this
list in `web/src/lib/markets.ts` (flags, names, mobile-number patterns).
"""

ARAB_COUNTRIES = [
    # code, name_en, name_ar, dial, currency, timezone
    ("DZ", "Algeria", "الجزائر", "213", "DZD", "Africa/Algiers"),
    ("BH", "Bahrain", "البحرين", "973", "BHD", "Asia/Bahrain"),
    ("KM", "Comoros", "جزر القمر", "269", "KMF", "Indian/Comoro"),
    ("DJ", "Djibouti", "جيبوتي", "253", "DJF", "Africa/Djibouti"),
    ("EG", "Egypt", "مصر", "20", "EGP", "Africa/Cairo"),
    ("IQ", "Iraq", "العراق", "964", "IQD", "Asia/Baghdad"),
    ("JO", "Jordan", "الأردن", "962", "JOD", "Asia/Amman"),
    ("KW", "Kuwait", "الكويت", "965", "KWD", "Asia/Kuwait"),
    ("LB", "Lebanon", "لبنان", "961", "LBP", "Asia/Beirut"),
    ("LY", "Libya", "ليبيا", "218", "LYD", "Africa/Tripoli"),
    ("MR", "Mauritania", "موريتانيا", "222", "MRU", "Africa/Nouakchott"),
    ("MA", "Morocco", "المغرب", "212", "MAD", "Africa/Casablanca"),
    ("OM", "Oman", "عُمان", "968", "OMR", "Asia/Muscat"),
    ("PS", "Palestine", "فلسطين", "970", "ILS", "Asia/Gaza"),
    ("QA", "Qatar", "قطر", "974", "QAR", "Asia/Qatar"),
    ("SA", "Saudi Arabia", "السعودية", "966", "SAR", "Asia/Riyadh"),
    ("SO", "Somalia", "الصومال", "252", "SOS", "Africa/Mogadishu"),
    ("SD", "Sudan", "السودان", "249", "SDG", "Africa/Khartoum"),
    ("SY", "Syria", "سوريا", "963", "SYP", "Asia/Damascus"),
    ("TN", "Tunisia", "تونس", "216", "TND", "Africa/Tunis"),
    ("AE", "United Arab Emirates", "الإمارات", "971", "AED", "Asia/Dubai"),
    ("YE", "Yemen", "اليمن", "967", "YER", "Asia/Aden"),
]

COUNTRY_CHOICES = [(code, name_en) for code, name_en, *_ in ARAB_COUNTRIES]
DIAL_CODES = {code: dial for code, _en, _ar, dial, *_ in ARAB_COUNTRIES}
NAMES_AR = {code: name_ar for code, _en, name_ar, *_ in ARAB_COUNTRIES}
