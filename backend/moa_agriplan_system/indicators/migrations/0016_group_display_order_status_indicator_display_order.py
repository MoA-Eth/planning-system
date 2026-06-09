from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('indicators', '0015_indicator_baseline'),
    ]

    operations = [
        migrations.AddField(
            model_name='indicatorgroup',
            name='display_order',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                unique=True,
                help_text='Position of this group in reports (must be unique; lower number appears first)',
            ),
        ),
        migrations.AddField(
            model_name='indicatorgroup',
            name='status',
            field=models.CharField(
                blank=True,
                choices=[('HIGH', 'High'), ('MEDIUM', 'Medium'), ('LOW', 'Low')],
                max_length=10,
                null=True,
                help_text='Priority status \u2014 drives row colour in Excel export (High=orange, Medium=green, Low=grey)',
            ),
        ),
        migrations.AddField(
            model_name='indicator',
            name='display_order',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                unique=True,
                help_text='Position of this KPI within its group (must be unique; lower number appears first)',
            ),
        ),
    ]
