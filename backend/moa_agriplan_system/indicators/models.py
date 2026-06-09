from django.db import models

# Create your models here.

class StateMinisterSector(models.Model):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name


class Department(models.Model):
    name = models.CharField(max_length=255)
    sector = models.ForeignKey(StateMinisterSector, on_delete=models.CASCADE, related_name='departments')

    class Meta:
        unique_together = ('name', 'sector')

    def __str__(self):
        return f"{self.name} - {self.sector.name}"


class IndicatorGroup(models.Model):
    STATUS_HIGH   = 'HIGH'
    STATUS_MEDIUM = 'MEDIUM'
    STATUS_LOW    = 'LOW'
    STATUS_CHOICES = [
        (STATUS_HIGH,   'High'),
        (STATUS_MEDIUM, 'Medium'),
        (STATUS_LOW,    'Low'),
    ]

    name = models.CharField(max_length=255)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True, related_name='indicator_groups')
    sector = models.ForeignKey(StateMinisterSector, on_delete=models.CASCADE, null=True, blank=True, related_name='sector_indicator_groups')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    unit = models.CharField(max_length=64, blank=True, help_text="Unit of measurement for this group and its indicators")
    is_label = models.BooleanField(
        default=False,
        help_text="Whether this indicator group is a label"
    )
    display_order = models.PositiveIntegerField(
        null=True, blank=True, unique=True,
        help_text="Position of this group in reports (must be unique; lower number appears first)"
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, null=True, blank=True,
        help_text="Priority status — drives row colour in Excel export (High=blue, Medium=green, Low=grey)"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['name', 'department', 'parent'], name='unique_group_department'),
            models.UniqueConstraint(fields=['name', 'sector', 'parent'], name='unique_group_sector'),
            models.CheckConstraint(
                check=models.Q(department__isnull=False) | models.Q(sector__isnull=False),
                name='group_must_have_department_or_sector'
            )
        ]

    def __str__(self):
        parent_name = f" ({self.parent.name})" if self.parent else ""
        if self.department:
            return f"{self.name}{parent_name} ({self.department.name})"
        elif self.sector:
            return f"{self.name}{parent_name} ({self.sector.name})"
        return f"{self.name}{parent_name} (No Department/Sector)"

    @property
    def level(self):
        """Return the hierarchy level (0 for root, 1 for children, etc.)"""
        level = 0
        current = self.parent
        while current:
            level += 1
            current = current.parent
        return level

    @property
    def is_parent(self):
        """Check if this group has children"""
        return self.children.exists()

    @property
    def hierarchy_path(self):
        """Get the full hierarchy path as a string"""
        path = [self.name]
        current = self.parent
        while current:
            path.append(current.name)
            current = current.parent
        return " > ".join(reversed(path))

    def get_all_children(self):
        """Get all descendant groups recursively"""
        children = list(self.children.all())
        all_children = children.copy()
        for child in children:
            all_children.extend(child.get_all_children())
        return all_children

    def get_inherited_unit(self):
        """Get the unit from this group or nearest parent that has a unit"""
        if self.unit:
            return self.unit
        if self.parent:
            return self.parent.get_inherited_unit()
        return ''

    def get_annual_target_aggregate(self, year):
        """Calculate aggregate annual target from all direct child indicators for a given year"""
        from django.db.models import Sum
        from plans.models import AnnualPlan
        
        # Get all indicators directly in this group
        direct_indicators = self.indicators.filter(is_aggregatable=True)
        
        # Get annual plans for these indicators in the given year
        total = AnnualPlan.objects.filter(
            indicator__in=direct_indicators,
            year=year
        ).aggregate(total=Sum('target'))['total']
        
        # Also add aggregates from child groups
        child_groups = self.children.all()
        for child_group in child_groups:
            child_total = child_group.get_annual_target_aggregate(year)
            if child_total is not None:
                total = (total or 0) + child_total
        
        return total

    def get_quarterly_breakdown_aggregate(self, year):
        """Calculate aggregate quarterly breakdown from all direct child indicators for a given year"""
        from .aggregation_utils import get_group_quarterly_breakdown_aggregate
        return get_group_quarterly_breakdown_aggregate(self, year)

    def get_performance_aggregate(self, year, quarter):
        """Calculate aggregate performance from all direct child indicators for a given year and quarter"""
        from .aggregation_utils import get_group_performance_aggregate
        return get_group_performance_aggregate(self, year, quarter)

    def get_quarterly_target_aggregate(self, year, quarter_months=None):
        """Calculate aggregate quarterly targets for specified months"""
        from .aggregation_utils import get_group_quarterly_target_aggregate
        return get_group_quarterly_target_aggregate(self, year, quarter_months)

    def get_performance_for_period(self, year, quarter_months=None):
        """Calculate aggregate performance for specified months"""
        from .aggregation_utils import get_group_performance_for_period
        return get_group_performance_for_period(self, year, quarter_months)


class Indicator(models.Model):
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=64, blank=True)
    description = models.TextField(blank=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='indicators')
    display_order = models.PositiveIntegerField(
        null=True, blank=True, unique=True,
        help_text="Position of this KPI within its group (must be unique; lower number appears first)"
    )
    groups = models.ManyToManyField(IndicatorGroup, blank=True, related_name='indicators')
    is_aggregatable = models.BooleanField(
        default=True,
        help_text="Whether this indicator's value should be included in parent group calculations"
    )
    is_incremental = models.BooleanField(
        default=False,
        help_text="Whether this indicator's performance should be calculated incrementally (cumulative)"
    )
    applicable_quarters = models.JSONField(
        default=list,
        help_text="List of applicable quarters: [1, 2, 3, 4]. Empty list means all quarters apply"
    )
    baseline = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True,
        help_text="Baseline value for this indicator"
    )

    class Meta:
        # No unique constraint - allow same indicator names in different departments/groups
        # This enables context-dependent indicators with same names
        pass

    def __str__(self):
        return f"{self.name} ({self.department.name})"

    def get_effective_unit(self):
        """Get the unit from this indicator or inherit from primary group"""
        if self.unit:
            return self.unit
        # Get unit from the first group if available
        primary_group = self.groups.first()
        if primary_group:
            return primary_group.get_inherited_unit()
        return ''

    def get_hierarchy_context(self):
        """Get hierarchy context for this indicator"""
        primary_group = self.groups.first()
        if primary_group:
            return {
                'group_id': primary_group.id,
                'group_name': primary_group.name,
                'hierarchy_path': primary_group.hierarchy_path,
                'level': primary_group.level,
                'unit': self.get_effective_unit()
            }
        return {
            'group_id': None,
            'group_name': None,
            'hierarchy_path': None,
            'level': None,
            'unit': self.unit
        }

    def is_quarter_applicable(self, quarter):
        """Check if a quarter is applicable for this indicator"""
        if not self.applicable_quarters:
            return True  # All quarters apply if list is empty
        return quarter in self.applicable_quarters

    def get_applicable_quarters(self):
        """Get list of applicable quarters"""
        return self.applicable_quarters or [1, 2, 3, 4]
