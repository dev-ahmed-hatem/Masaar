from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0006_backfill_specializations'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacherapplication',
            name='gender',
            field=models.CharField(
                blank=True,
                choices=[('MALE', 'Male'), ('FEMALE', 'Female')],
                max_length=6,
            ),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='languages',
            field=models.CharField(
                blank=True, help_text="Comma-separated, e.g. 'ar,en'", max_length=120
            ),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='bio_ar',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to='teacher_photos/'),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='free_lessons_offered',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='specialties',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='education',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='work_experience',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='certifications',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='subjects',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='specializations',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='teacherapplication',
            name='availability',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
