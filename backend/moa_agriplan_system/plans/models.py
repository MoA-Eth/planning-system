from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

# Create your models here.

class AnnualPlan(models.Model):
    year = models.PositiveIntegerField()
    indicator = models.ForeignKey('indicators.Indicator', on_delete=models.CASCADE, related_name='annual_plans')
    target = models.DecimalField(max_digits=20, decimal_places=2)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_annual_plans')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('year', 'indicator')

    def __str__(self):
        return f"{self.indicator.name} - {self.year}"

    @property
    def breakdown(self):
        return getattr(self, 'quarterly_breakdown', None)


class PlanStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    APPROVED = 'APPROVED', 'Approved by State Minister'
    VALIDATED = 'VALIDATED', 'Validated by Strategic Staff'
    FINAL_APPROVED = 'FINAL_APPROVED', 'Final Approved by Executive Officer'
    REJECTED = 'REJECTED', 'Rejected'


class QuarterlyBreakdown(models.Model):
    plan = models.OneToOneField(AnnualPlan, on_delete=models.CASCADE, related_name='quarterly_breakdown')
    q1 = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    q2 = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    q3 = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    q4 = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=PlanStatus.choices, default=PlanStatus.DRAFT)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_breakdowns')
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_breakdowns')
    review_comment = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_breakdowns')
    validated_at = models.DateTimeField(null=True, blank=True)
    final_approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='final_approved_breakdowns')
    final_approved_at = models.DateTimeField(null=True, blank=True)
    sent_to_strategic = models.BooleanField(default=False)

    def clean(self):
        # Only sum applicable quarters for validation
        applicable_values = []
        for quarter, value in [(1, self.q1), (2, self.q2), (3, self.q3), (4, self.q4)]:
            if self.plan.indicator.is_quarter_applicable(quarter):
                applicable_values.append(value or 0)
        
        total = sum(applicable_values)
        if total != self.plan.target:
            raise ValidationError(f"Sum of applicable quarters ({total}) must equal the annual target ({self.plan.target})")

    @property
    def total(self):
        # Only sum applicable quarters
        applicable_values = []
        for quarter, value in [(1, self.q1), (2, self.q2), (3, self.q3), (4, self.q4)]:
            if self.plan.indicator.is_quarter_applicable(quarter):
                applicable_values.append(value or 0)
        
        return sum(applicable_values)

    def get_quarter_value(self, quarter):
        """Get value for a specific quarter, respecting applicability"""
        quarter_values = {1: self.q1, 2: self.q2, 3: self.q3, 4: self.q4}
        if not self.plan.indicator.is_quarter_applicable(quarter):
            return None  # Not applicable
        return quarter_values.get(quarter)


class PerformanceStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    APPROVED = 'APPROVED', 'Approved by State Minister'
    VALIDATED = 'VALIDATED', 'Validated by Strategic Staff'
    FINAL_APPROVED = 'FINAL_APPROVED', 'Final Approved by Executive Officer'
    REJECTED = 'REJECTED', 'Rejected'


class QuarterlyPerformance(models.Model):
    plan = models.ForeignKey(AnnualPlan, on_delete=models.CASCADE, related_name='performances')
    quarter = models.PositiveSmallIntegerField(choices=((1, 'Q1'), (2, 'Q2'), (3, 'Q3'), (4, 'Q4')))
    value = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=PerformanceStatus.choices, default=PerformanceStatus.DRAFT)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_performances')
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_performances')
    review_comment = models.TextField(blank=True)
    variance_description = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_performances')
    validated_at = models.DateTimeField(null=True, blank=True)
    final_approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='final_approved_performances')
    final_approved_at = models.DateTimeField(null=True, blank=True)
    sent_to_strategic = models.BooleanField(default=False)

    class Meta:
        unique_together = ('plan', 'quarter')

    def __str__(self):
        return f"{self.plan.indicator.name} {self.plan.year} Q{self.quarter}"


class FileAttachment(models.Model):
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='attachments')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='uploads/%Y/%m/%d')
    annual_plan = models.ForeignKey(AnnualPlan, on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    performance = models.ForeignKey(QuarterlyPerformance, on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    description = models.CharField(max_length=255, blank=True)


class Document(models.Model):
    class DocumentType(models.TextChoices):
        REPORT = 'REPORT', 'Report'
        NARRATIVE= 'NARRATIVE', 'Narrative'
        POLICY = 'POLICY', 'Policy'
        GUIDELINE = 'GUIDELINE', 'Guideline'
        PLAN = 'PLAN', 'Plan'
        DIRECTIVE = 'DIRECTIVE', 'Directive'
        CIRCULAR = 'CIRCULAR', 'Circular'
        OTHER = 'OTHER', 'Other'

    class Quarter(models.TextChoices):
        Q1 = 'Q1', 'Quarter 1'
        Q2 = 'Q2', 'Quarter 2'
        Q3 = 'Q3', 'Quarter 3'
        Q4 = 'Q4', 'Quarter 4'

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    document_type = models.CharField(max_length=32, choices=DocumentType.choices, default=DocumentType.OTHER)
    file = models.FileField(upload_to='documents/%Y/%m/%d/')
    sector = models.ForeignKey('indicators.StateMinisterSector', on_delete=models.PROTECT, null=True, blank=True, related_name='documents')
    department = models.ForeignKey('indicators.Department', on_delete=models.PROTECT, null=True, blank=True, related_name='documents')
    year = models.PositiveIntegerField(null=True, blank=True, help_text='Ethiopian fiscal year (e.g. 2017)')
    quarter = models.CharField(max_length=2, choices=Quarter.choices, null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_document_type_display()})"

    class Meta:
        ordering = ['-uploaded_at']


class AdvisorComment(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='advisor_comments')
    year = models.PositiveIntegerField(null=True, blank=True)
    sector = models.ForeignKey('indicators.StateMinisterSector', on_delete=models.SET_NULL, null=True, blank=True, related_name='advisor_comments')
    department = models.ForeignKey('indicators.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='advisor_comments')
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        y = self.year or 'ALL'
        return f"AdvisorComment by {getattr(self.author, 'username', 'unknown')} ({y})"


class SubmissionWindow(models.Model):
    class WindowType(models.TextChoices):
        BREAKDOWN = 'BREAKDOWN', 'Annual Breakdown'
        PERFORMANCE_Q1 = 'PERFORMANCE_Q1', 'Performance Q1'
        PERFORMANCE_Q2 = 'PERFORMANCE_Q2', 'Performance Q2'
        PERFORMANCE_Q3 = 'PERFORMANCE_Q3', 'Performance Q3'
        PERFORMANCE_Q4 = 'PERFORMANCE_Q4', 'Performance Q4'

    window_type = models.CharField(max_length=32, choices=WindowType.choices)
    year = models.PositiveIntegerField(null=True, blank=True, help_text='Optional. If empty, applies to all years.')
    always_open = models.BooleanField(default=False)
    start = models.DateTimeField(null=True, blank=True)
    end = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['window_type', 'year', 'active']),
        ]

    def __str__(self):
        label = self.get_window_type_display()
        y = self.year or 'ALL'
        return f"{label} ({y})"


def _check_submission_window(window_type: str, date: timezone.datetime, year: int) -> bool:
    # Try year-specific active window first, then global (year is null)
    qs = SubmissionWindow.objects.filter(window_type=window_type, active=True)
    win = qs.filter(year=year).first() or qs.filter(year__isnull=True).first()
    if win:
        if win.always_open:
            return True
        if win.start and win.end:
            return win.start <= date < win.end
        # If invalid/partial config, fall through to defaults
    return None


def within_annual_breakdown_window(date: timezone.datetime) -> bool:
    """Return True if annual breakdown submissions are allowed at 'date'.

    Controlled via settings (loaded from .env):
    - BREAKDOWN_WINDOW_ALWAYS_OPEN: if True, always allow submissions
    - BREAKDOWN_WINDOW_START_MONTH: window start month (default 1)
    - BREAKDOWN_WINDOW_START_DAY: window start day (default 1)
    - BREAKDOWN_WINDOW_DURATION_DAYS: window length in days (default 15)
    """
    # Admin override
    override = _check_submission_window('BREAKDOWN', date, date.year)
    if override is True:
        return True
    if override is False:
        return False
    # Default: fixed window June 22–June 26 (inclusive end handled via next-day exclusive bound)
    tz = timezone.get_current_timezone()
    start = timezone.datetime(year=date.year, month=6, day=22, tzinfo=tz)
    end = timezone.datetime(year=date.year, month=6, day=27, tzinfo=tz)
    return start <= date < end


def within_quarter_submission_window(date: timezone.datetime, quarter: int) -> bool:
    # Admin override per quarter
    window_type_map = {
        1: 'PERFORMANCE_Q1',
        2: 'PERFORMANCE_Q2',
        3: 'PERFORMANCE_Q3',
        4: 'PERFORMANCE_Q4',
    }
    wt = window_type_map.get(quarter)
    if wt:
        override = _check_submission_window(wt, date, date.year)
        if override is True:
            return True
        if override is False:
            return False
    # Default fiscal quarter windows (Jul 8–Oct 10, Oct 11–Jan 8, Jan 9–Apr 8, Apr 9–Jul 7)
    # Each window extends by 10 days after its end date.
    tz = timezone.get_current_timezone()
    # Determine fiscal year start (FY starts July 1x; we anchor to July of the FY)
    fy_start_year = date.year if date.month >= 8 else date.year - 1
    if quarter == 1:
        start = timezone.datetime(year=fy_start_year, month=10, day=5, tzinfo=tz)
        end = timezone.datetime(year=fy_start_year, month=10, day=14, tzinfo=tz)
    elif quarter == 2:
        start = timezone.datetime(year=fy_start_year + 1, month=1, day=3, tzinfo=tz)
        end = timezone.datetime(year=fy_start_year + 1, month=1, day=12, tzinfo=tz)
    elif quarter == 3:
        start = timezone.datetime(year=fy_start_year + 1, month=4, day=3, tzinfo=tz)
        end = timezone.datetime(year=fy_start_year + 1, month=4, day=12, tzinfo=tz)
    else:
        start = timezone.datetime(year=fy_start_year + 1, month=7, day=2, tzinfo=tz)
        end = timezone.datetime(year=fy_start_year + 1, month=7, day=11, tzinfo=tz)
    # Q3 has specific end date without extension
    if quarter == 3:
        return start <= date <= end
    else:
        window_end = end + timezone.timedelta(days=10)
        return start <= date <= window_end


class AdminEditLog(models.Model):
    """Tracks every SuperAdmin edit to quarterly plan or performance data."""

    class RecordType(models.TextChoices):
        PLAN_VALUE = 'PLAN_VALUE', 'Plan Value'
        PLAN_STATUS = 'PLAN_STATUS', 'Plan Status'
        PERFORMANCE_VALUE = 'PERFORMANCE_VALUE', 'Performance Value'
        PERFORMANCE_STATUS = 'PERFORMANCE_STATUS', 'Performance Status'

    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='admin_edit_logs'
    )
    edited_at = models.DateTimeField(auto_now_add=True)
    record_type = models.CharField(max_length=30, choices=RecordType.choices)
    quarter = models.PositiveSmallIntegerField(
        choices=((1, 'Q1'), (2, 'Q2'), (3, 'Q3'), (4, 'Q4')), null=True, blank=True
    )
    year = models.PositiveIntegerField(null=True, blank=True)
    indicator_name = models.CharField(max_length=255, blank=True)
    sector_name = models.CharField(max_length=255, blank=True)
    department_name = models.CharField(max_length=255, blank=True)
    old_value = models.CharField(max_length=255, blank=True)
    new_value = models.CharField(max_length=255, blank=True)
    breakdown_id = models.IntegerField(null=True, blank=True)
    performance_id = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-edited_at']

    def __str__(self):
        return f"AdminEdit by {getattr(self.edited_by, 'username', 'unknown')} at {self.edited_at}: {self.record_type}"
