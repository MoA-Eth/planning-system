from django.contrib import admin
from .models import IndicatorGroup, Indicator


@admin.register(IndicatorGroup)
class IndicatorGroupAdmin(admin.ModelAdmin):
    list_display       = ('display_order', 'name', 'status', 'is_label', 'parent', 'department', 'sector', 'unit')
    list_display_links = ('name',)
    list_editable      = ('display_order', 'status')
    list_filter   = ('status', 'is_label', 'department__sector')
    search_fields = ('name',)
    ordering      = ('display_order', 'name')
    fields        = ('name', 'display_order', 'status', 'unit', 'is_label', 'parent', 'department', 'sector')


@admin.register(Indicator)
class IndicatorAdmin(admin.ModelAdmin):
    list_display       = ('display_order', 'name', 'unit', 'department', 'is_aggregatable', 'is_incremental')
    list_display_links = ('name',)
    list_editable      = ('display_order',)
    list_filter   = ('department__sector', 'is_aggregatable')
    search_fields = ('name',)
    ordering      = ('display_order', 'name')
    filter_horizontal = ('groups',)
