from django.shortcuts import render
from rest_framework import viewsets, permissions
from .models import StateMinisterSector, Department, Indicator, IndicatorGroup
from .serializers import StateMinisterSectorSerializer, DepartmentSerializer, IndicatorSerializer, IndicatorGroupSerializer
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, Avg, Count, Q
from plans.models import AnnualPlan, QuarterlyBreakdown, QuarterlyPerformance

class SuperuserWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        # Read for authenticated users; write only for superusers
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

class IndicatorGroupWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        # Read for authenticated users; write for superusers and state ministers within their sector
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Superusers can always write
        if getattr(request.user, 'is_superuser', False):
            return True
            
        # State ministers can write within their sector
        role = getattr(request.user, 'role', '').upper()
        if role == 'STATE_MINISTER':
            user_sector_id = getattr(getattr(request.user, 'sector', None), 'id', None) or getattr(request.user, 'sector', None)
            return bool(user_sector_id)
            
        return False

class SectorViewSet(viewsets.ModelViewSet):
    queryset = StateMinisterSector.objects.all().order_by('name')
    serializer_class = StateMinisterSectorSerializer
    permission_classes = [SuperuserWritePermission]
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, 'is_superuser', False):
            return qs
        role = getattr(user, 'role', '').upper()
        if role == 'STATE_MINISTER':
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if sector_id:
                qs = qs.filter(id=sector_id)
        elif role == 'ADVISOR':
            # If advisor has department, scope to that department's sector
            dept = getattr(user, 'department', None)
            sector_id = getattr(getattr(dept, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if sector_id:
                qs = qs.filter(id=sector_id)
        return qs

class IndicatorGroupViewSet(viewsets.ModelViewSet):
    queryset = IndicatorGroup.objects.select_related('department', 'department__sector', 'sector').all().order_by('name')
    serializer_class = IndicatorGroupSerializer
    permission_classes = [IndicatorGroupWritePermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        department_id = self.request.query_params.get('department')
        sector_id = self.request.query_params.get('sector')
        
        if department_id:
            qs = qs.filter(department_id=department_id)
        elif sector_id:
            qs = qs.filter(sector_id=sector_id)
            
        if getattr(user, 'is_superuser', False):
            return qs
        role = getattr(user, 'role', '').upper()
        if role == 'STATE_MINISTER':
            s_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if s_id:
                qs = qs.filter(
                    Q(department__sector_id=s_id) | Q(sector_id=s_id)
                )
        elif role == 'ADVISOR':
            d_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if d_id:
                qs = qs.filter(department_id=d_id)
            else:
                s_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
                if s_id:
                    qs = qs.filter(
                        Q(department__sector_id=s_id) | Q(sector_id=s_id)
                    )
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.indicators.exists():
            return Response({'detail': 'Cannot delete an indicator group that has associated indicators. Remove or reassign them first.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related('sector').all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [SuperuserWritePermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        sector_id = self.request.query_params.get('sector')
        if sector_id:
            qs = qs.filter(sector_id=sector_id)
        if getattr(user, 'is_superuser', False):
            return qs
        role = getattr(user, 'role', '').upper()
        if role == 'STATE_MINISTER':
            s_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if s_id:
                qs = qs.filter(sector_id=s_id)
        elif role == 'ADVISOR':
            d_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if d_id:
                qs = qs.filter(id=d_id)
            else:
                s_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
                if s_id:
                    qs = qs.filter(sector_id=s_id)
        return qs

class IndicatorViewSet(viewsets.ModelViewSet):
    queryset = Indicator.objects.select_related('department', 'department__sector').all().order_by('name')
    serializer_class = IndicatorSerializer
    permission_classes = [SuperuserWritePermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        department_id = self.request.query_params.get('department')
        if department_id:
            qs = qs.filter(department_id=department_id)
        group_id = self.request.query_params.get('group')
        if group_id:
            if group_id.lower() == 'null':
                qs = qs.filter(groups__isnull=True)
            else:
                qs = qs.filter(groups__id=group_id)
        if getattr(user, 'is_superuser', False):
            return qs
        role = getattr(user, 'role', '').upper()
        if role == 'STATE_MINISTER':
            s_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if s_id:
                qs = qs.filter(department__sector_id=s_id)
        elif role == 'ADVISOR':
            d_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if d_id:
                qs = qs.filter(department_id=d_id)
            else:
                s_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
                if s_id:
                    qs = qs.filter(department__sector_id=s_id)
        return qs

# Create your views here.

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def state_minister_dashboard(request):
    """
    Dashboard for State Minister showing hierarchical indicator group performance
    """
    user = request.user
    year = request.query_params.get('year')
    quarter_months = request.query_params.get('quarter_months')
    
    if year:
        try:
            year = int(year)
        except ValueError:
            year = None
    
    if quarter_months:
        try:
            quarter_months = int(quarter_months)
        except ValueError:
            quarter_months = None
    
    # Get user's sector
    sector_id = None
    if getattr(user, 'is_superuser', False) or getattr(user, 'role', '').upper() == 'SUPERADMIN':
        # For superuser or SUPERADMIN, you might want to allow sector selection or show all
        sector_id = request.query_params.get('sector_id')
        if not sector_id:
            # If no sector specified, get the first available sector
            first_sector = StateMinisterSector.objects.first()
            sector_id = first_sector.id if first_sector else None
    else:
        role = getattr(user, 'role', '').upper()
        if role == 'STATE_MINISTER':
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
        elif role == 'ADVISOR':
            dept = getattr(user, 'department', None)
            sector_id = getattr(getattr(dept, 'sector', None), 'id', None) or getattr(user, 'sector', None)
    
    if not sector_id:
        return Response({'detail': 'No sector found for user'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get root indicator groups for this sector (groups with no parent)
    # Include label groups for structure but they won't be calculated
    root_groups = IndicatorGroup.objects.filter(
        Q(department__sector_id=sector_id) | Q(sector_id=sector_id),
        parent__isnull=True
    ).select_related('department', 'sector').prefetch_related(
        'children__indicators',
        'indicators'
    ).distinct()
    
    # Get all ungrouped indicators for this sector
    ungrouped_indicators = Indicator.objects.filter(
        Q(department__sector_id=sector_id),
        groups__isnull=True
    ).select_related('department')
    
    # Helper function to calculate individual indicator performance percentage
    def calculate_indicator_percentage(indicator, year):
        """Calculate a single indicator's performance percentage."""
        annual_plan = AnnualPlan.objects.filter(indicator=indicator, year=year).first()
        if not annual_plan:
            return None
        
        breakdown = QuarterlyBreakdown.objects.filter(plan=annual_plan).first()
        
        if quarter_months:
            quarter_months_map = {1: 3, 2: 6, 3: 9, 4: 12}
            filtered_quarters = [
                q for q in [1, 2, 3, 4]
                if quarter_months_map[q] <= quarter_months
            ]
            performance = QuarterlyPerformance.objects.filter(
                plan=annual_plan, quarter__in=filtered_quarters
            ).aggregate(total=Sum('value'))['total'] or 0
            
            quarterly_target = 0
            if breakdown:
                if quarter_months == 3:
                    quarterly_target = float(breakdown.q1 or 0)
                elif quarter_months == 6:
                    quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0)
                elif quarter_months == 9:
                    quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0) + float(breakdown.q3 or 0)
                elif quarter_months == 12:
                    quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0) + float(breakdown.q3 or 0) + float(breakdown.q4 or 0)
            else:
                quarterly_target = (float(annual_plan.target) * quarter_months) / 12
            target = quarterly_target
        else:
            # For incremental indicators, full-year performance = Q4 value only
            if indicator.is_incremental:
                q4_perf = QuarterlyPerformance.objects.filter(plan=annual_plan, quarter=4).first()
                performance = float(q4_perf.value) if q4_perf and q4_perf.value is not None else 0
            else:
                performance = QuarterlyPerformance.objects.filter(plan=annual_plan).aggregate(
                    total=Sum('value')
                )['total'] or 0
            target = float(annual_plan.target) if annual_plan.target else 0
        
        if target > 0:
            return (float(performance) / float(target)) * 100
        return None

    # Helper function to calculate group performance using average-of-percentages
    def calculate_group_performance(group, year, children_data=None):
        """
        Calculate group performance as the average of:
        - Direct indicator percentages (is_aggregatable=True only)
        - Child group percentages (recursively, but only from non-label groups)
        
        Label groups (is_label=True) are excluded from performance calculations.
        """
        # Skip label groups entirely - they don't have performance percentages
        if group.is_label:
            return {
                'performance_percentage': None,
                'total_components': 0,
                'is_label': True
            }
        
        percentages = []
        
        # Collect direct indicator percentages (only aggregatable)
        for indicator in group.indicators.filter(is_aggregatable=True):
            pct = calculate_indicator_percentage(indicator, year)
            if pct is not None:
                percentages.append(pct)
        
        # Collect child group percentages (only from non-label children)
        if children_data:
            for child in children_data:
                # Skip child groups that are label groups
                if child.get('is_label'):
                    continue
                if child.get('performance_percentage') is not None:
                    percentages.append(child['performance_percentage'])
        
        performance_percentage = (sum(percentages) / len(percentages)) if percentages else None
        
        return {
            'performance_percentage': performance_percentage,
            'total_components': len(percentages),
            'is_label': group.is_label
        }
    
    # Helper function to build group tree with performance (bottom-up)
    def build_group_tree(groups, year):
        result = []
        for group in groups:
            # Build children FIRST (bottom-up) so we have their percentages
            children_data = build_group_tree(group.children.all(), year)
            
            # Get indicators with their performance
            indicators_data = []
            for indicator in group.indicators.all():
                annual_plan = AnnualPlan.objects.filter(indicator=indicator, year=year).first()
                if annual_plan:
                    # Get quarterly breakdown for target calculation
                    breakdown = QuarterlyBreakdown.objects.filter(plan=annual_plan).first()
                    
                    if quarter_months:
                        # Filter performance for specified months
                        quarter_months_map = {1: 3, 2: 6, 3: 9, 4: 12}
                        filtered_quarters = [
                            q for q in [1, 2, 3, 4] 
                            if quarter_months_map[q] <= quarter_months
                        ]
                        performance = QuarterlyPerformance.objects.filter(
                            plan=annual_plan, quarter__in=filtered_quarters
                        ).aggregate(total=Sum('value'))['total'] or 0
                        
                        # Calculate quarterly target
                        quarterly_target = 0
                        if breakdown:
                            if quarter_months == 3:
                                quarterly_target = float(breakdown.q1 or 0)
                            elif quarter_months == 6:
                                quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0)
                            elif quarter_months == 9:
                                quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0) + float(breakdown.q3 or 0)
                        else:
                            # Fallback to proportional
                            quarterly_target = (float(annual_plan.target) * quarter_months) / 12
                        
                        target = quarterly_target
                    else:
                        # Get all quarters performance
                        # For incremental indicators, full-year performance = Q4 value only
                        if indicator.is_incremental:
                            q4_perf = QuarterlyPerformance.objects.filter(plan=annual_plan, quarter=4).first()
                            performance = float(q4_perf.value) if q4_perf and q4_perf.value is not None else 0
                        else:
                            performance = QuarterlyPerformance.objects.filter(plan=annual_plan).aggregate(
                                total=Sum('value')
                            )['total'] or 0
                        target = annual_plan.target
                    
                    indicators_data.append({
                        'id': indicator.id,
                        'name': indicator.name,
                        'unit': indicator.unit,
                        'description': indicator.description,
                        'is_aggregatable': indicator.is_aggregatable,
                        'target': target,
                        'achieved': performance,
                        'performance_percentage': (performance / target * 100) if target > 0 else None
                    })
            
            # Calculate group performance using average-of-percentages (bottom-up)
            performance_data = calculate_group_performance(group, year, children_data)
            
            group_data = {
                'id': group.id,
                'name': group.name,
                'level': group.level,
                'hierarchy_path': group.hierarchy_path,
                'is_parent': group.is_parent,
                'children': children_data,
                'indicators': indicators_data,
                **performance_data
            }
            result.append(group_data)
        return result
    
    # Build the data structure
    root_groups_data = build_group_tree(root_groups, year)
    
    # Get ungrouped indicators with performance
    ungrouped_data = []
    for indicator in ungrouped_indicators:
        annual_plan = AnnualPlan.objects.filter(indicator=indicator, year=year).first()
        if annual_plan:
            # Get quarterly breakdown for target calculation
            breakdown = QuarterlyBreakdown.objects.filter(plan=annual_plan).first()
            
            if quarter_months:
                # Filter performance for specified months
                quarter_months_map = {1: 3, 2: 6, 3: 9, 4: 12}
                filtered_quarters = [
                    q for q in [1, 2, 3, 4] 
                    if quarter_months_map[q] <= quarter_months
                ]
                performance = QuarterlyPerformance.objects.filter(
                    plan=annual_plan, quarter__in=filtered_quarters
                ).aggregate(total=Sum('value'))['total'] or 0
                
                # Calculate quarterly target
                quarterly_target = 0
                if breakdown:
                    if quarter_months == 3:
                        quarterly_target = float(breakdown.q1 or 0)
                    elif quarter_months == 6:
                        quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0)
                    elif quarter_months == 9:
                        quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0) + float(breakdown.q3 or 0)
                else:
                    # Fallback to proportional
                    quarterly_target = (float(annual_plan.target) * quarter_months) / 12
                
                target = quarterly_target
            else:
                # Get all quarters performance
                # For incremental indicators, full-year performance = Q4 value only
                if indicator.is_incremental:
                    q4_perf = QuarterlyPerformance.objects.filter(plan=annual_plan, quarter=4).first()
                    performance = float(q4_perf.value) if q4_perf and q4_perf.value is not None else 0
                else:
                    performance = QuarterlyPerformance.objects.filter(plan=annual_plan).aggregate(
                        total=Sum('value')
                    )['total'] or 0
                target = annual_plan.target
            
            ungrouped_data.append({
                'id': indicator.id,
                'name': indicator.name,
                'unit': indicator.unit,
                'description': indicator.description,
                'is_aggregatable': indicator.is_aggregatable,
                'target': target,
                'achieved': performance,
                'performance_percentage': (performance / target * 100) if target > 0 else None
            })
    
    # Calculate KPIs
    all_indicators = []
    def collect_all_indicators(groups):
        for group in groups:
            all_indicators.extend(group['indicators'])
            collect_all_indicators(group['children'])
    
    collect_all_indicators(root_groups_data)
    all_indicators.extend(ungrouped_data)
    
    total_indicators = len(all_indicators)
    
    # Count groups on track vs lagging (excluding label groups)
    def count_group_performance(groups):
        on_track = 0
        lagging = 0
        for group in groups:
            # Skip label groups - they don't have performance metrics
            if group.get('is_label'):
                child_on_track, child_lagging = count_group_performance(group['children'])
                on_track += child_on_track
                lagging += child_lagging
                continue
                
            if group.get('performance_percentage') is not None:
                if group['performance_percentage'] >= 85:
                    on_track += 1
                else:
                    lagging += 1
            child_on_track, child_lagging = count_group_performance(group['children'])
            on_track += child_on_track
            lagging += child_lagging
        return on_track, lagging
    
    groups_on_track, groups_lagging = count_group_performance(root_groups_data)
    
    # Get department performance using average-of-percentages
    department_performance = []
    quarterly_trends = []
    
    # Get all departments in the sector
    departments = Department.objects.filter(sector_id=sector_id)
    
    for dept in departments:
        # Get all indicators for this department that are aggregatable
        dept_indicators = Indicator.objects.filter(department=dept, is_aggregatable=True)
        
        # Calculate each indicator's percentage individually
        indicator_percentages = []
        indicator_count_dept = 0
        
        for indicator in dept_indicators:
            pct = calculate_indicator_percentage(indicator, year)
            indicator_count_dept += 1
            if pct is not None:
                indicator_percentages.append(pct)
        
        # Department performance = average of indicator percentages
        avg_performance = (sum(indicator_percentages) / len(indicator_percentages)) if indicator_percentages else None
        
        # Add to department performance list
        if indicator_count_dept > 0:
            department_performance.append({
                'department_id': dept.id,
                'department_name': dept.name,
                'average_performance': avg_performance,
                'total_indicators': indicator_count_dept,
            })
            
            # Generate simplified quarterly trend data for this department
            for quarter in range(1, 5):
                quarterly_trends.append({
                    'quarter': f'Q{quarter}',
                    'department_name': dept.name,
                    'performance_percentage': avg_performance,
                })
    
    # Sector overall performance = average of department percentages
    dept_percentages = [
        d['average_performance'] for d in department_performance
        if d['average_performance'] is not None
    ]
    overall_performance = (sum(dept_percentages) / len(dept_percentages)) if dept_percentages else None
    
    # Get sector info
    sector = StateMinisterSector.objects.filter(id=sector_id).first()
    
    return Response({
        'sector': {
            'id': sector.id if sector else 0,
            'name': sector.name if sector else 'Unknown'
        },
        'root_groups': root_groups_data,
        'ungrouped_indicators': ungrouped_data,
        'kpis': {
            'total_indicators': total_indicators,
            'overall_performance': overall_performance,
            'groups_on_track': groups_on_track,
            'groups_lagging': groups_lagging,
        },
        'department_performance': department_performance,
        'quarterly_trends': quarterly_trends,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hierarchical_spreadsheet(request):
    """
    Return hierarchical spreadsheet data for plan or performance view.
    Access restricted to: STATE_MINISTER, LEAD_EXECUTIVE_BODY, STRATEGIC_STAFF, EXECUTIVE.
    Query params:
      - year (required): Gregorian year
      - sector_id (optional): sector to filter (STRATEGIC_STAFF / EXECUTIVE only)
      - view_type: 'plan' (default) or 'performance'
    """
    user = request.user
    role = getattr(user, 'role', '').upper()
    is_super = getattr(user, 'is_superuser', False)

    # ── Role gate ─────────────────────────────────────────────────────────────
    ALLOWED_ROLES = ('STATE_MINISTER', 'LEAD_EXECUTIVE_BODY', 'STRATEGIC_STAFF', 'EXECUTIVE')
    if not is_super and role not in ALLOWED_ROLES:
        return Response({'detail': 'You do not have permission to access the spreadsheet.'}, status=status.HTTP_403_FORBIDDEN)

    year = request.query_params.get('year')
    view_type = request.query_params.get('view_type', 'plan')

    if not year:
        return Response({'detail': 'year is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        year = int(year)
    except ValueError:
        return Response({'detail': 'Invalid year'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Resolve scope based on role ───────────────────────────────────────────
    # filter_sector_ids : list of sector ids the user may see
    # filter_department_id : specific department for LEAD_EXECUTIVE_BODY
    filter_sector_ids = []
    filter_department_id = None

    if is_super or role in ('STRATEGIC_STAFF', 'EXECUTIVE'):
        # Can see all sectors; optionally filter by sector_id param
        req_sector = request.query_params.get('sector_id')
        if req_sector:
            filter_sector_ids = [int(req_sector)]
        else:
            filter_sector_ids = list(StateMinisterSector.objects.values_list('id', flat=True))
    elif role == 'STATE_MINISTER':
        user_sector = getattr(user, 'sector', None)
        if user_sector:
            filter_sector_ids = [user_sector.id]
        else:
            return Response({'detail': 'No sector assigned to your account.'}, status=status.HTTP_400_BAD_REQUEST)
    elif role == 'LEAD_EXECUTIVE_BODY':
        user_dept = getattr(user, 'department', None)
        if user_dept:
            filter_department_id = user_dept.id
            filter_sector_ids = [user_dept.sector_id]
        else:
            return Response({'detail': 'No department assigned to your account.'}, status=status.HTTP_400_BAD_REQUEST)

    if not filter_sector_ids:
        return Response({'detail': 'No sector found for user'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Pre-fetch bulk data ───────────────────────────────────────────────────
    plan_qs = AnnualPlan.objects.filter(year=year).select_related('indicator')
    bd_qs = QuarterlyBreakdown.objects.filter(plan__year=year).select_related('plan')
    perf_qs = QuarterlyPerformance.objects.filter(plan__year=year).select_related('plan')

    all_plans = {ap.indicator_id: ap for ap in plan_qs}
    all_breakdowns = {bd.plan.indicator_id: bd for bd in bd_qs}
    all_perfs = {}
    for perf in perf_qs:
        all_perfs[(perf.plan.indicator_id, perf.quarter)] = perf

    # ── Helper: build one indicator row ───────────────────────────────────────
    def indicator_row(indicator):
        plan = all_plans.get(indicator.id)
        bd = all_breakdowns.get(indicator.id)
        dept = indicator.department
        row = {
            'type': 'indicator',
            'id': indicator.id,
            'name': indicator.name,
            'unit': indicator.get_effective_unit(),
            'baseline': float(indicator.baseline) if indicator.baseline is not None else None,
            'is_aggregatable': indicator.is_aggregatable,
            'is_label': False,
            'annual_target': float(plan.target) if plan else None,
            'sector_name': dept.sector.name if dept and dept.sector else '',
            'department_name': dept.name if dept else '',
        }
        if view_type == 'plan':
            for q in range(1, 5):
                if not indicator.is_quarter_applicable(q):
                    row[f'q{q}'] = None
                    row[f'q{q}_display'] = 'N/A'
                elif bd:
                    val = getattr(bd, f'q{q}')
                    row[f'q{q}'] = float(val) if val is not None else None
                    row[f'q{q}_display'] = f'{val:.2f}' if val is not None else 'N/A'
                else:
                    row[f'q{q}'] = None
                    row[f'q{q}_display'] = '-'
            row['breakdown_status'] = bd.status if bd else None
        else:
            for q in range(1, 5):
                if not indicator.is_quarter_applicable(q):
                    row[f'q{q}'] = None
                    row[f'q{q}_display'] = 'N/A'
                else:
                    perf = all_perfs.get((indicator.id, q))
                    if perf and perf.value is not None:
                        row[f'q{q}'] = float(perf.value)
                        row[f'q{q}_display'] = f'{perf.value:.2f}'
                    elif perf and perf.value is None:
                        row[f'q{q}'] = None
                        row[f'q{q}_display'] = 'N/A'
                    else:
                        row[f'q{q}'] = None
                        row[f'q{q}_display'] = '-'
                row[f'q{q}_status'] = all_perfs.get((indicator.id, q), None)
                if row[f'q{q}_status']:
                    row[f'q{q}_status'] = row[f'q{q}_status'].status
        return row

    # ── Helper: resolve sector/department name for a group ────────────────────
    def group_context(group):
        if group.department:
            return group.department.sector.name if group.department.sector else '', group.department.name
        if group.sector:
            return group.sector.name, ''
        return '', ''

    # ── Recursive tree builder ────────────────────────────────────────────────
    def build_tree(groups):
        result = []
        for group in groups:
            # If LEAD_EXECUTIVE_BODY, skip groups not in their department
            if filter_department_id:
                dept_id = group.department_id
                if dept_id and dept_id != filter_department_id:
                    continue

            children_data = build_tree(group.children.all())
            indicators = list(group.indicators.select_related('department__sector').all())
            # If LEAD_EXECUTIVE_BODY, filter indicators to their department
            if filter_department_id:
                indicators = [i for i in indicators if i.department_id == filter_department_id]

            indicator_rows = [indicator_row(ind) for ind in indicators]

            sec_name, dept_name = group_context(group)

            group_row = {
                'type': 'group',
                'id': group.id,
                'name': group.name,
                'unit': group.get_inherited_unit(),
                'baseline': None,
                'is_aggregatable': False,
                'is_label': group.is_label,
                'annual_target': None,
                'sector_name': sec_name,
                'department_name': dept_name,
                'q1': None, 'q2': None, 'q3': None, 'q4': None,
                'q1_display': '', 'q2_display': '', 'q3_display': '', 'q4_display': '',
                'children': children_data,
                'indicators': indicator_rows,
            }

            if not group.is_label:
                agg_rows = [r for r in indicator_rows if r['is_aggregatable']]
                child_groups = [c for c in children_data if not c['is_label']]

                target_parts = [r['annual_target'] for r in agg_rows if r['annual_target'] is not None]
                target_parts += [c['annual_target'] for c in child_groups if c['annual_target'] is not None]
                if target_parts:
                    group_row['annual_target'] = sum(target_parts)

                bl_parts = [r['baseline'] for r in agg_rows if r['baseline'] is not None]
                bl_parts += [c['baseline'] for c in child_groups if c['baseline'] is not None]
                if bl_parts:
                    group_row['baseline'] = sum(bl_parts)

                for q in range(1, 5):
                    qk = f'q{q}'
                    parts = [r[qk] for r in agg_rows if r[qk] is not None]
                    parts += [c[qk] for c in child_groups if c[qk] is not None]
                    if parts:
                        group_row[qk] = sum(parts)
                        group_row[f'{qk}_display'] = f'{group_row[qk]:.2f}'

            # Only include group if it has children or indicators after filtering
            if children_data or indicator_rows:
                result.append(group_row)

        return result

    # ── Build root query ──────────────────────────────────────────────────────
    group_filter = Q(parent__isnull=True) & (
        Q(department__sector_id__in=filter_sector_ids) | Q(sector_id__in=filter_sector_ids)
    )
    if filter_department_id:
        group_filter = Q(parent__isnull=True) & (
            Q(department_id=filter_department_id) | Q(sector_id__in=filter_sector_ids)
        )

    root_groups = IndicatorGroup.objects.filter(
        group_filter
    ).select_related('department__sector', 'sector').prefetch_related(
        'children', 'indicators'
    ).distinct()

    tree = build_tree(root_groups)

    # Ungrouped indicators
    ungrouped_filter = Q(groups__isnull=True, department__sector_id__in=filter_sector_ids)
    if filter_department_id:
        ungrouped_filter = Q(groups__isnull=True, department_id=filter_department_id)
    ungrouped = Indicator.objects.filter(
        ungrouped_filter
    ).select_related('department__sector')
    ungrouped_rows = [indicator_row(ind) for ind in ungrouped]

    # Sectors list: full list for STRATEGIC_STAFF/EXECUTIVE, single for others
    if is_super or role in ('STRATEGIC_STAFF', 'EXECUTIVE'):
        sectors = list(StateMinisterSector.objects.values('id', 'name').order_by('name'))
    else:
        sectors = list(StateMinisterSector.objects.filter(id__in=filter_sector_ids).values('id', 'name'))

    return Response({
        'year': year,
        'sector_id': filter_sector_ids[0] if len(filter_sector_ids) == 1 else None,
        'view_type': view_type,
        'role': role,
        'sectors': sectors,
        'tree': tree,
        'ungrouped': ungrouped_rows,
    })
