from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('indicators', '0015_indicator_baseline'),
        ('plans', '0011_add_year_quarter_to_document'),
    ]

    operations = [
        migrations.AlterField(
            model_name='document',
            name='department',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='documents',
                to='indicators.department',
            ),
        ),
    ]
