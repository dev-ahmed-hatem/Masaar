"""Create a Market for every Arab League country (existing rows are left untouched)."""
from django.db import migrations

from apps.markets.countries import ARAB_COUNTRIES


def forwards(apps, schema_editor):
    Market = apps.get_model("markets", "Market")
    for code, name_en, _name_ar, _dial, currency, timezone in ARAB_COUNTRIES:
        Market.objects.get_or_create(
            code=code,
            defaults={"name": name_en, "currency": currency, "timezone": timezone, "is_active": True},
        )


class Migration(migrations.Migration):
    dependencies = [("markets", "0002_all_arab_countries")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
