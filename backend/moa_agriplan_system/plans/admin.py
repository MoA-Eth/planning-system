from django.contrib import admin
from .models import SubmissionWindow, Document

@admin.register(SubmissionWindow)
class SubmissionWindowAdmin(admin.ModelAdmin):
    list_display = (
        'window_type',
        'year',
        'always_open',
        'start',
        'end',
        'active',
    )
    list_filter = (
        'window_type',
        'year',
        'always_open',
        'active',
    )
    search_fields = (
        'window_type',
    )


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('name', 'document_type', 'uploaded_by', 'uploaded_at')
    list_filter = ('document_type',)
    search_fields = ('name', 'description')
