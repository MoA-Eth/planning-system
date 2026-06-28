from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Sum, Count
from django.utils import timezone
from .models import User
from .serializers import UserSerializer, ProfileSerializer
from indicators.models import Indicator, StateMinisterSector, Department, IndicatorGroup
from plans.models import AnnualPlan, QuarterlyBreakdown, QuarterlyPerformance, PlanStatus, PerformanceStatus, AdminEditLog


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = ProfileSerializer(request.user, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """Allow an authenticated user to change their own password.

    Expects JSON body: {"old_password": "...", "new_password": "..."}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password') or ''
        new_password = request.data.get('new_password') or ''

        if not old_password or not new_password:
            return Response({'detail': 'Both old_password and new_password are required.'}, status=400)

        if not user.check_password(old_password):
            return Response({'detail': 'Old password is incorrect.'}, status=400)

        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password changed successfully.'})


class AdminTargetsBySectorView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        # Sum of AnnualPlan.target grouped by Sector
        qs = (
            AnnualPlan.objects
            .select_related('indicator__department__sector')
            .values('indicator__department__sector__name')
            .annotate(total=Sum('target'))
            .order_by('indicator__department__sector__name')
        )
        data = [
            {
                'sector': row['indicator__department__sector__name'] or 'Unassigned',
                'total': float(row['total'] or 0),
            }
            for row in qs
        ]
        return Response(data)


class AdminIndicatorsByDepartmentView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        # Number of indicators per Department
        qs = (
            Indicator.objects
            .select_related('department')
            .values('department__name')
            .annotate(count=Count('id'))
            .order_by('department__name')
        )
        data = [
            {
                'department': row['department__name'] or 'Unassigned',
                'count': int(row['count'] or 0),
            }
            for row in qs
        ]
        return Response(data)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('sector', 'department').all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]


class AdminStatsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        data = {
            'total_indicators': Indicator.objects.count(),
            'total_annual_plans': AnnualPlan.objects.count(),
            'total_sectors': StateMinisterSector.objects.count(),
            'total_users': User.objects.count(),
        }
        return Response(data)


class IsActivityLogViewer(permissions.BasePermission):
    """Allow only superusers, Strategic Staff, and Executive to view activity logs."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if getattr(user, 'is_superuser', False):
            return True
        role = getattr(user, 'role', '').upper()
        return role in ['STRATEGIC_STAFF', 'EXECUTIVE']


class ActivityLogView(APIView):
    permission_classes = [IsAuthenticated, IsActivityLogViewer]

    def get(self, request):
        """Return a simple combined list of recent actions on breakdowns and performances.

        This uses existing status/actor fields instead of a dedicated log table.
        """
        limit = 200

        bd_events = []
        for bd in QuarterlyBreakdown.objects.select_related('plan__indicator', 'submitted_by', 'reviewed_by', 'validated_by', 'final_approved_by').all():
            indicator_name = getattr(bd.plan.indicator, 'name', '') if bd.plan and bd.plan.indicator else ''
            sector_name = getattr(getattr(bd.plan.indicator.department, 'sector', None), 'name', None) if getattr(bd.plan, 'indicator', None) and getattr(bd.plan.indicator, 'department', None) else None
            department_name = getattr(getattr(bd.plan.indicator, 'department', None), 'name', None) if getattr(bd.plan, 'indicator', None) else None

            if bd.submitted_at:
                bd_events.append({
                    'type': 'BREAKDOWN',
                    'action': 'SUBMITTED',
                    'by': getattr(bd.submitted_by, 'username', None),
                    'at': bd.submitted_at,
                    'status': bd.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': '',
                })
            if bd.reviewed_at:
                bd_events.append({
                    'type': 'BREAKDOWN',
                    'action': 'REVIEWED',
                    'by': getattr(bd.reviewed_by, 'username', None),
                    'at': bd.reviewed_at,
                    'status': bd.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': bd.review_comment or '',
                })
            if bd.validated_at:
                bd_events.append({
                    'type': 'BREAKDOWN',
                    'action': 'VALIDATED',
                    'by': getattr(bd.validated_by, 'username', None),
                    'at': bd.validated_at,
                    'status': bd.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': '',
                })
            if bd.final_approved_at:
                bd_events.append({
                    'type': 'BREAKDOWN',
                    'action': 'FINAL_APPROVED',
                    'by': getattr(bd.final_approved_by, 'username', None),
                    'at': bd.final_approved_at,
                    'status': bd.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': '',
                })

        perf_events = []
        for perf in QuarterlyPerformance.objects.select_related('plan__indicator', 'submitted_by', 'reviewed_by', 'validated_by', 'final_approved_by').all():
            indicator_name = getattr(perf.plan.indicator, 'name', '') if perf.plan and perf.plan.indicator else ''
            sector_name = getattr(getattr(perf.plan.indicator.department, 'sector', None), 'name', None) if getattr(perf.plan, 'indicator', None) and getattr(perf.plan.indicator, 'department', None) else None
            department_name = getattr(getattr(perf.plan.indicator, 'department', None), 'name', None) if getattr(perf.plan, 'indicator', None) else None

            if perf.submitted_at:
                perf_events.append({
                    'type': 'PERFORMANCE',
                    'action': 'SUBMITTED',
                    'by': getattr(perf.submitted_by, 'username', None),
                    'at': perf.submitted_at,
                    'status': perf.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': '',
                })
            if perf.reviewed_at:
                perf_events.append({
                    'type': 'PERFORMANCE',
                    'action': 'REVIEWED',
                    'by': getattr(perf.reviewed_by, 'username', None),
                    'at': perf.reviewed_at,
                    'status': perf.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': perf.review_comment or '',
                })
            if perf.validated_at:
                perf_events.append({
                    'type': 'PERFORMANCE',
                    'action': 'VALIDATED',
                    'by': getattr(perf.validated_by, 'username', None),
                    'at': perf.validated_at,
                    'status': perf.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': '',
                })
            if perf.final_approved_at:
                perf_events.append({
                    'type': 'PERFORMANCE',
                    'action': 'FINAL_APPROVED',
                    'by': getattr(perf.final_approved_by, 'username', None),
                    'at': perf.final_approved_at,
                    'status': perf.status,
                    'indicator': indicator_name,
                    'sector': sector_name,
                    'department': department_name,
                    'comment': '',
                })

        admin_events = []
        for log in AdminEditLog.objects.select_related('edited_by').all():
            admin_events.append({
                'type': 'ADMIN_EDIT',
                'action': log.record_type,
                'by': getattr(log.edited_by, 'username', None),
                'at': log.edited_at,
                'status': log.new_value,
                'indicator': log.indicator_name,
                'sector': log.sector_name or None,
                'department': log.department_name or None,
                'comment': f'Q{log.quarter}: {log.old_value} → {log.new_value}' if log.quarter else f'{log.old_value} → {log.new_value}',
            })

        events = bd_events + perf_events + admin_events
        events.sort(key=lambda e: e['at'] or 0, reverse=True)
        events = events[:limit]

        # Normalize datetime to ISO format
        for e in events:
            if e['at'] is not None:
                e['at'] = e['at'].isoformat()

        return Response(events)


class IsMinisterView(permissions.BasePermission):
    """Allow only MINISTER_VIEW role to access."""
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        role = getattr(user, 'role', '').upper()
        return role == 'MINISTER_VIEW'


class IsIndicatorDashboardViewer(permissions.BasePermission):
    """Allow State Minister, Advisor, Strategic Affairs Staff, Executive, and Minister View to access indicator dashboard."""
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if getattr(user, 'is_superuser', False):
            return True  # ✅ 
        role = getattr(user, 'role', '').upper()
        return role in ['STATE_MINISTER', 'ADVISOR', 'STRATEGIC_STAFF', 'EXECUTIVE', 'MINISTER_VIEW', 'LEAD_EXECUTIVE_BODY']


class MinisterDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsIndicatorDashboardViewer]

    def get(self, request):
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

        # If no year provided, use the most recent year with data
        if not year:
            latest_plan = AnnualPlan.objects.order_by('-year').first()
            if latest_plan:
                year = latest_plan.year
            else:
                # No data at all, return empty response
                return Response({
                    'kpis': {
                        'total_annual_target': 0,
                        'total_achieved_performance': 0,
                        'achievement_percentage': 0,
                        'indicators_on_track': 0,
                        'indicators_lagging': 0,
                    },
                    'sector_comparison': [],
                    'quarterly_trend': [
                        {'quarter': 'Q1', 'planned': 0, 'actual': 0},
                        {'quarter': 'Q2', 'planned': 0, 'actual': 0},
                        {'quarter': 'Q3', 'planned': 0, 'actual': 0},
                        {'quarter': 'Q4', 'planned': 0, 'actual': 0},
                    ],
                    'approval_status': {'approved': 0, 'pending': 0, 'rejected': 0},
                    'approval_stages': {
                        'draft': 0, 'submitted': 0, 'approved': 0,
                        'validated': 0, 'final_approved': 0, 'rejected': 0,
                    },
                    'sector_summaries': [],
                    'indicators_at_risk': [],
                    'late_or_rejected': [],
                })

        # Get all plans (Minister can see all) - filter by year
        plans_qs = AnnualPlan.objects.select_related(
            'indicator__department__sector'
        ).filter(year=year)

        # Get breakdowns and performances (only approved or higher) - filter by year
        breakdowns_qs = QuarterlyBreakdown.objects.select_related(
            'plan__indicator__department__sector'
        ).filter(
            plan__year=year,
            status__in=[PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED]
        )

        perfs_qs = QuarterlyPerformance.objects.select_related(
            'plan__indicator__department__sector'
        ).filter(
            plan__year=year,
            status__in=[PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED, PerformanceStatus.FINAL_APPROVED]
        )

        # 1. KPI Cards
        total_annual_target = sum(float(p.target) for p in plans_qs)
        
        # Total achieved performance (sum of quarterly performances, filtered by quarter_months)
        if quarter_months:
            quarter_months_map = {1: 3, 2: 6, 3: 9, 4: 12}
            in_period = [
                p for p in perfs_qs
                if quarter_months_map[p.quarter] <= quarter_months
            ]
            # For incremental indicators: keep only the last non-null quarter within the period
            last_incremental = {}
            for p in in_period:
                if p.plan.indicator.is_incremental and p.value is not None:
                    prev = last_incremental.get(p.plan_id)
                    if prev is None or p.quarter > prev.quarter:
                        last_incremental[p.plan_id] = p
            filtered_perfs = [
                p for p in in_period
                if not p.plan.indicator.is_incremental
                or last_incremental.get(p.plan_id) is p
            ]
        else:
            # For full year: for incremental indicators keep only the last non-null quarter per indicator
            last_incremental = {}
            for p in perfs_qs:
                if p.plan.indicator.is_incremental and p.value is not None:
                    prev = last_incremental.get(p.plan_id)
                    if prev is None or p.quarter > prev.quarter:
                        last_incremental[p.plan_id] = p
            filtered_perfs = [
                p for p in perfs_qs
                if not p.plan.indicator.is_incremental
                or last_incremental.get(p.plan_id) is p
            ]
        
        total_achieved = sum(float(p.value) for p in filtered_perfs if p.value is not None)
        
        # Calculate target based on quarterly breakdowns for the specified period
        target_for_percentage = total_annual_target
        if quarter_months:
            # Get actual quarterly targets from breakdowns
            quarterly_target_totals = {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0}
            for bd in breakdowns_qs:
                quarterly_target_totals['Q1'] += float(bd.q1 or 0)
                quarterly_target_totals['Q2'] += float(bd.q2 or 0)
                quarterly_target_totals['Q3'] += float(bd.q3 or 0)
                quarterly_target_totals['Q4'] += float(bd.q4 or 0)
            
            # Sum targets for the specified months
            if quarter_months == 3:
                target_for_percentage = quarterly_target_totals['Q1']
            elif quarter_months == 6:
                target_for_percentage = quarterly_target_totals['Q1'] + quarterly_target_totals['Q2']
            elif quarter_months == 9:
                target_for_percentage = quarterly_target_totals['Q1'] + quarterly_target_totals['Q2'] + quarterly_target_totals['Q3']
            # If quarter_months is 12 or None, use total annual target
        
        achievement_percentage = (total_achieved / target_for_percentage * 100) if target_for_percentage > 0 else 0

        # Indicators on track vs lagging (using same quarter filtering)
        indicator_performance = {}
        for perf in filtered_perfs:
            plan_id = perf.plan_id
            if plan_id not in indicator_performance:
                try:
                    plan = plans_qs.get(id=plan_id)
                    indicator_performance[plan_id] = {
                        'target': float(plan.target),
                        'achieved': 0,
                        'indicator_name': plan.indicator.name,
                    }
                except AnnualPlan.DoesNotExist:
                    continue
            indicator_performance[plan_id]['achieved'] += float(perf.value) if perf.value is not None else 0

        # Apply quarterly targets for quarter filtering
        if quarter_months:
            for plan_id in indicator_performance:
                # Get quarterly breakdown for this plan
                try:
                    breakdown = breakdowns_qs.get(plan_id=plan_id)
                    quarterly_target = 0
                    if quarter_months == 3:
                        quarterly_target = float(breakdown.q1 or 0)
                    elif quarter_months == 6:
                        quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0)
                    elif quarter_months == 9:
                        quarterly_target = float(breakdown.q1 or 0) + float(breakdown.q2 or 0) + float(breakdown.q3 or 0)
                    indicator_performance[plan_id]['target'] = quarterly_target
                except QuarterlyBreakdown.DoesNotExist:
                    # Fallback to proportional if no breakdown exists
                    indicator_performance[plan_id]['target'] = (indicator_performance[plan_id]['target'] * quarter_months) / 12

        on_track = 0
        lagging = 0
        for perf_data in indicator_performance.values():
            progress_pct = (perf_data['achieved'] / perf_data['target'] * 100) if perf_data['target'] > 0 else 0
            if progress_pct >= 75:
                on_track += 1
            else:
                lagging += 1

        # 2. Sector-wise performance comparison
        sector_data = {}
        for plan in plans_qs:
            sector_id = plan.indicator.department.sector.id
            sector_name = plan.indicator.department.sector.name
            if sector_id not in sector_data:
                sector_data[sector_id] = {
                    'sector_id': sector_id,
                    'sector_name': sector_name,
                    'target': 0,
                    'achieved': 0,
                }
            sector_data[sector_id]['target'] += float(plan.target)

        # Apply quarterly targets for sector filtering
        if quarter_months:
            for sector_id in sector_data:
                # Get all plans for this sector
                sector_plans = plans_qs.filter(indicator__department__sector_id=sector_id)
                sector_quarterly_target = 0
                
                for plan in sector_plans:
                    try:
                        breakdown = breakdowns_qs.get(plan_id=plan.id)
                        if quarter_months == 3:
                            sector_quarterly_target += float(breakdown.q1 or 0)
                        elif quarter_months == 6:
                            sector_quarterly_target += float(breakdown.q1 or 0) + float(breakdown.q2 or 0)
                        elif quarter_months == 9:
                            sector_quarterly_target += float(breakdown.q1 or 0) + float(breakdown.q2 or 0) + float(breakdown.q3 or 0)
                    except QuarterlyBreakdown.DoesNotExist:
                        # Fallback to proportional if no breakdown exists
                        sector_quarterly_target += (float(plan.target) * quarter_months) / 12
                
                sector_data[sector_id]['target'] = sector_quarterly_target

        for perf in filtered_perfs:
            try:
                plan = plans_qs.get(id=perf.plan_id)
                sector_id = plan.indicator.department.sector.id
                if sector_id in sector_data:
                    sector_data[sector_id]['achieved'] += float(perf.value) if perf.value is not None else 0
            except AnnualPlan.DoesNotExist:
                continue

        sector_comparison = list(sector_data.values())

        # 3. Quarterly trend data
        quarterly_planned = {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0}
        quarterly_actual = {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0}

        for bd in breakdowns_qs:
            quarterly_planned['Q1'] += float(bd.q1 or 0)
            quarterly_planned['Q2'] += float(bd.q2 or 0)
            quarterly_planned['Q3'] += float(bd.q3 or 0)
            quarterly_planned['Q4'] += float(bd.q4 or 0)

        # Use filtered performances for quarterly actuals
        for perf in filtered_perfs:
            q_key = f'Q{perf.quarter}'
            if q_key in quarterly_actual:
                quarterly_actual[q_key] += float(perf.value) if perf.value is not None else 0

        quarterly_trend = [
            {'quarter': 'Q1', 'planned': quarterly_planned['Q1'], 'actual': quarterly_actual['Q1']},
            {'quarter': 'Q2', 'planned': quarterly_planned['Q2'], 'actual': quarterly_actual['Q2']},
            {'quarter': 'Q3', 'planned': quarterly_planned['Q3'], 'actual': quarterly_actual['Q3']},
            {'quarter': 'Q4', 'planned': quarterly_planned['Q4'], 'actual': quarterly_actual['Q4']},
        ]

        # 4. Approval status (for all breakdowns and performances, not just approved) - filter by year
        all_breakdowns = QuarterlyBreakdown.objects.select_related(
            'plan__indicator__department__sector'
        ).filter(plan__year=year)
        all_perfs = QuarterlyPerformance.objects.select_related(
            'plan__indicator__department__sector'
        ).filter(plan__year=year)

        approved_count = 0
        pending_count = 0
        rejected_count = 0

        for bd in all_breakdowns:
            status = bd.status.upper()
            if status == 'FINAL_APPROVED':
                approved_count += 1
            elif status == 'REJECTED':
                rejected_count += 1
            else:
                pending_count += 1

        for perf in all_perfs:
            status = perf.status.upper()
            if status == 'FINAL_APPROVED':
                approved_count += 1
            elif status == 'REJECTED':
                rejected_count += 1
            else:
                pending_count += 1

        approval_status = {
            'approved': approved_count,
            'pending': pending_count,
            'rejected': rejected_count,
        }

        # Approval stage breakdown
        stage_counts = {
            'draft': 0,
            'submitted': 0,
            'approved': 0,
            'validated': 0,
            'final_approved': 0,
            'rejected': 0,
        }

        for bd in all_breakdowns:
            status_lower = bd.status.lower()
            if status_lower in stage_counts:
                stage_counts[status_lower] += 1

        for perf in all_perfs:
            status_lower = perf.status.lower()
            if status_lower in stage_counts:
                stage_counts[status_lower] += 1

        # 5. Sector summary cards
        sector_summaries = []
        for sector_id, data in sector_data.items():
            progress_rate = (data['achieved'] / data['target'] * 100) if data['target'] > 0 else 0
            sector_summaries.append({
                'sector_id': sector_id,
                'sector_name': data['sector_name'],
                'annual_target': data['target'],
                'performance_achieved': data['achieved'],
                'progress_rate': progress_rate,
            })
        sector_summaries.sort(key=lambda x: x['sector_name'])

        # 6. Indicators at Risk
        indicators_at_risk = []
        for plan_id, perf_data in indicator_performance.items():
            try:
                plan = plans_qs.get(id=plan_id)
                progress_pct = (perf_data['achieved'] / perf_data['target'] * 100) if perf_data['target'] > 0 else 0
                gap = perf_data['target'] - perf_data['achieved']
                
                # Determine risk level
                if progress_pct < 50:
                    risk_level = 'HIGH'
                elif progress_pct < 75:
                    risk_level = 'MEDIUM'
                else:
                    risk_level = 'LOW'

                # Only include if lagging
                if progress_pct < 75:
                    indicators_at_risk.append({
                        'indicator_name': perf_data['indicator_name'],
                        'sector_name': plan.indicator.department.sector.name,
                        'department_name': plan.indicator.department.name,
                        'target': perf_data['target'],
                        'achieved': perf_data['achieved'],
                        'gap': gap,
                        'progress_pct': progress_pct,
                        'risk_level': risk_level,
                    })
            except AnnualPlan.DoesNotExist:
                continue

        indicators_at_risk.sort(key=lambda x: x['progress_pct'])

        # 7. Late or rejected submissions
        late_or_rejected = []
        now = timezone.now()
        
        for bd in all_breakdowns:
            if bd.status == 'REJECTED':
                try:
                    plan = plans_qs.get(id=bd.plan_id)
                    late_or_rejected.append({
                        'type': 'BREAKDOWN',
                        'indicator_name': plan.indicator.name,
                        'sector_name': plan.indicator.department.sector.name,
                        'department_name': plan.indicator.department.name,
                        'status': 'REJECTED',
                        'submitted_at': bd.submitted_at.isoformat() if bd.submitted_at else None,
                        'reviewed_at': bd.reviewed_at.isoformat() if bd.reviewed_at else None,
                        'comment': bd.review_comment or '',
                    })
                except AnnualPlan.DoesNotExist:
                    continue
            elif bd.status == 'SUBMITTED' and bd.submitted_at:
                days_since_submission = (now - bd.submitted_at).days
                if days_since_submission > 30:
                    try:
                        plan = plans_qs.get(id=bd.plan_id)
                        late_or_rejected.append({
                            'type': 'BREAKDOWN',
                            'indicator_name': plan.indicator.name,
                            'sector_name': plan.indicator.department.sector.name,
                            'department_name': plan.indicator.department.name,
                            'status': 'LATE',
                            'submitted_at': bd.submitted_at.isoformat(),
                            'days_late': days_since_submission - 30,
                            'comment': '',
                        })
                    except AnnualPlan.DoesNotExist:
                        continue

        for perf in all_perfs:
            if perf.status == 'REJECTED':
                try:
                    plan = plans_qs.get(id=perf.plan_id)
                    late_or_rejected.append({
                        'type': 'PERFORMANCE',
                        'indicator_name': plan.indicator.name,
                        'sector_name': plan.indicator.department.sector.name,
                        'department_name': plan.indicator.department.name,
                        'quarter': perf.quarter,
                        'status': 'REJECTED',
                        'submitted_at': perf.submitted_at.isoformat() if perf.submitted_at else None,
                        'reviewed_at': perf.reviewed_at.isoformat() if perf.reviewed_at else None,
                        'comment': perf.review_comment or '',
                    })
                except AnnualPlan.DoesNotExist:
                    continue
            elif perf.status == 'SUBMITTED' and perf.submitted_at:
                days_since_submission = (now - perf.submitted_at).days
                if days_since_submission > 30:
                    try:
                        plan = plans_qs.get(id=perf.plan_id)
                        late_or_rejected.append({
                            'type': 'PERFORMANCE',
                            'indicator_name': plan.indicator.name,
                            'sector_name': plan.indicator.department.sector.name,
                            'department_name': plan.indicator.department.name,
                            'quarter': perf.quarter,
                            'status': 'LATE',
                            'submitted_at': perf.submitted_at.isoformat(),
                            'days_late': days_since_submission - 30,
                            'comment': '',
                        })
                    except AnnualPlan.DoesNotExist:
                        continue

        return Response({
            'kpis': {
                'total_annual_target': total_annual_target,
                'total_achieved_performance': total_achieved,
                'achievement_percentage': achievement_percentage,
                'indicators_on_track': on_track,
                'indicators_lagging': lagging,
            },
            'sector_comparison': sector_comparison,
            'quarterly_trend': quarterly_trend,
            'approval_status': approval_status,
            'approval_stages': stage_counts,
            'sector_summaries': sector_summaries,
            'indicators_at_risk': indicators_at_risk[:20],
            'late_or_rejected': late_or_rejected[:50],
        })


class IndicatorPerformanceView(APIView):
    permission_classes = [IsAuthenticated, IsIndicatorDashboardViewer]

    def get(self, request):
        """Returns hierarchical indicator performance data organized by sector, departments, indicator groups, and indicators."""
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

        if not year:
            latest_plan = AnnualPlan.objects.order_by('-year').first()
            if latest_plan:
                year = latest_plan.year
            else:
                return Response({'ministry_performance': None, 'sectors': []})

        plans_qs = AnnualPlan.objects.select_related(
            'indicator__department__sector'
        ).prefetch_related(
            'indicator__groups'
        ).filter(year=year)

        perfs_qs = QuarterlyPerformance.objects.select_related(
            'plan__indicator__department__sector'
        ).filter(
            plan__year=year,
            status__in=[PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED, PerformanceStatus.FINAL_APPROVED]
        )

        breakdowns_qs = QuarterlyBreakdown.objects.select_related(
            'plan__indicator__department__sector'
        ).filter(
            plan__year=year,
            status__in=[PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED]
        )

        # Build data structure
        sectors_dict = {}
        
        for plan in plans_qs:
            sector = plan.indicator.department.sector
            dept = plan.indicator.department
            
            if sector.id not in sectors_dict:
                sectors_dict[sector.id] = {
                    'id': sector.id,
                    'name': sector.name,
                    'departments': {}
                }
                
            if dept.id not in sectors_dict[sector.id]['departments']:
                sectors_dict[sector.id]['departments'][dept.id] = {
                    'id': dept.id,
                    'name': dept.name,
                    'indicators': [],
                }
                
            indicator_perfs = perfs_qs.filter(plan_id=plan.id)
            
            if quarter_months:
                quarter_months_map = {1: 3, 2: 6, 3: 9, 4: 12}
                in_period = [p for p in indicator_perfs if quarter_months_map.get(p.quarter, 12) <= quarter_months]
                if plan.indicator.is_incremental:
                    # Last non-null quarter within the period
                    filtered_perfs = []
                    for q in sorted({p.quarter for p in in_period}, reverse=True):
                        candidates = [p for p in in_period if p.quarter == q and p.value is not None]
                        if candidates:
                            filtered_perfs = candidates
                            break
                else:
                    filtered_perfs = in_period
            else:
                # For full year: incremental indicators use last non-null quarter
                if plan.indicator.is_incremental:
                    filtered_perfs = []
                    for q in range(4, 0, -1):
                        candidates = [p for p in indicator_perfs if p.quarter == q and p.value is not None]
                        if candidates:
                            filtered_perfs = candidates
                            break
                else:
                    filtered_perfs = list(indicator_perfs)
                
            is_na_target = (plan.target is None or plan.target == '' or plan.target == 'N/A')
            target = 0
            if not is_na_target:
                try:
                    target = float(plan.target)
                    if quarter_months:
                        try:
                            breakdown = breakdowns_qs.get(plan_id=plan.id)
                            quarter_months_map = {1: 3, 2: 6, 3: 9, 4: 12}
                            in_period_quarters = [q for q in [1, 2, 3, 4] if quarter_months_map[q] <= quarter_months]
                            if plan.indicator.is_incremental:
                                qt = 0
                                for q in sorted(in_period_quarters, reverse=True):
                                    v = getattr(breakdown, f'q{q}', None)
                                    if v is not None:
                                        qt = float(v)
                                        break
                            else:
                                qt = 0
                                if quarter_months >= 3: qt += float(breakdown.q1 or 0)
                                if quarter_months >= 6: qt += float(breakdown.q2 or 0)
                                if quarter_months >= 9: qt += float(breakdown.q3 or 0)
                                if quarter_months >= 12: qt += float(breakdown.q4 or 0)
                            target = qt
                        except QuarterlyBreakdown.DoesNotExist:
                            target = (target * quarter_months) / 12
                except (ValueError, TypeError):
                    is_na_target = True
                    target = 0
                    
            all_performances_na = all(p.value is None or p.value == '' or str(p.value).upper() == 'N/A' for p in filtered_perfs)
            total_achieved = sum(float(p.value) for p in filtered_perfs if p.value is not None and p.value != '' and str(p.value).upper() != 'N/A')
            
            if is_na_target or all_performances_na or target <= 0:
                performance_pct = None
            else:
                performance_pct = (total_achieved / target) * 100
                if performance_pct > 100:
                    performance_pct = 100.0
                    
            groups = plan.indicator.groups.all()
            group_id = groups.first().id if groups.exists() else None
            group_name = groups.first().name if groups.exists() else None
            
            sectors_dict[sector.id]['departments'][dept.id]['indicators'].append({
                'id': plan.indicator.id,
                'plan_id': plan.id,
                'name': plan.indicator.name,
                'unit': plan.indicator.unit,
                'description': plan.indicator.description,
                'is_aggregatable': plan.indicator.is_aggregatable,
                'target': 0 if is_na_target else target,
                'achieved': 0 if all_performances_na else total_achieved,
                'performance_percentage': performance_pct,
                'group_id': group_id,
                'group_name': group_name
            })

        # Calculate percentages
        sectors_result = []
        for s_id, s_data in sectors_dict.items():
            depts_result = []
            for d_id, d_data in s_data['departments'].items():
                
                # Department percent: average of all aggregatable indicators
                agg_ind_pcts = [
                    ind['performance_percentage'] 
                    for ind in d_data['indicators'] 
                    if ind.get('is_aggregatable', True) and ind['performance_percentage'] is not None
                ]
                dept_perf = sum(agg_ind_pcts) / len(agg_ind_pcts) if agg_ind_pcts else None
                
                # Group indicators by group
                groups_dict = {}
                ungrouped = []
                for ind in d_data['indicators']:
                    if ind['group_id']:
                        if ind['group_id'] not in groups_dict:
                            groups_dict[ind['group_id']] = {
                                'id': ind['group_id'],
                                'name': ind['group_name'],
                                'indicators': []
                            }
                        groups_dict[ind['group_id']]['indicators'].append(ind)
                    else:
                        ungrouped.append(ind)
                        
                groups_result = []
                for g_id, g_data in groups_dict.items():
                    # Group percent: average of aggregatable indicators only
                    # Skip label groups - they don't participate in calculations
                    g_agg_pcts = [
                        ind['performance_percentage']
                        for ind in g_data['indicators']
                        if ind.get('is_aggregatable', True) and ind['performance_percentage'] is not None
                    ]
                    g_perf = sum(g_agg_pcts) / len(g_agg_pcts) if g_agg_pcts else None
                    
                    # Check if this is a label group by querying the database
                    try:
                        group_obj = IndicatorGroup.objects.get(id=g_id)
                        is_label_group = group_obj.is_label
                    except IndicatorGroup.DoesNotExist:
                        is_label_group = False
                    
                    # Label groups get None performance percentage
                    if is_label_group:
                        g_perf = None
                    
                    groups_result.append({
                        'id': g_data['id'],
                        'name': g_data['name'],
                        'performance_percentage': g_perf,
                        'indicators': g_data['indicators'],
                        'is_label': is_label_group
                    })
                
                depts_result.append({
                    'id': d_data['id'],
                    'name': d_data['name'],
                    'performance_percentage': dept_perf,
                    'groups': groups_result,
                    'ungrouped_indicators': ungrouped
                })
                
            # Sector percent: average of departments
            dept_pcts = [
                d['performance_percentage']
                for d in depts_result
                if d['performance_percentage'] is not None
            ]
            sector_perf = sum(dept_pcts) / len(dept_pcts) if dept_pcts else None
            
            sectors_result.append({
                'id': s_data['id'],
                'name': s_data['name'],
                'performance_percentage': sector_perf,
                'departments': depts_result
            })
            
        # Ministry percent: average of sectors
        sector_pcts = [
            s['performance_percentage']
            for s in sectors_result
            if s['performance_percentage'] is not None
        ]
        ministry_perf = sum(sector_pcts) / len(sector_pcts) if sector_pcts else None
        
        return Response({
            'year': year,
            'quarter_months': quarter_months,
            'ministry_performance': ministry_perf,
            'sectors': sectors_result
        })


class IndicatorDetailView(APIView):
    permission_classes = [IsAuthenticated, IsIndicatorDashboardViewer]

    def get(self, request):
        """Returns yearly and quarterly performance data for a specific indicator."""
        indicator_id = request.query_params.get('indicator_id')
        if not indicator_id:
            return Response({'error': 'indicator_id is required'}, status=400)

        try:
            indicator_id = int(indicator_id)
        except ValueError:
            return Response({'error': 'invalid indicator_id'}, status=400)

        current_year = request.query_params.get('year')
        if current_year:
            try:
                current_year = int(current_year)
            except ValueError:
                current_year = None

        if not current_year:
            latest_plan = AnnualPlan.objects.filter(indicator_id=indicator_id).order_by('-year').first()
            if latest_plan:
                current_year = latest_plan.year
            else:
                return Response({
                    'indicator': None,
                    'yearly_data': [],
                    'current_year_quarters': [],
                    'last_year_quarters': []
                })

        try:
            indicator = Indicator.objects.select_related('department', 'department__sector').get(id=indicator_id)
        except Indicator.DoesNotExist:
            return Response({'error': 'indicator not found'}, status=404)

        # Get yearly data (4 consecutive years ending in current_year)
        years_list = list(range(current_year - 3, current_year + 1))
        yearly_data = []
        for y in years_list:
            try:
                plan = AnnualPlan.objects.get(indicator_id=indicator_id, year=y)
                target = float(plan.target) if plan.target and str(plan.target).upper() != 'N/A' else 0

                perfs = QuarterlyPerformance.objects.filter(
                    plan_id=plan.id,
                    status__in=[PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED, PerformanceStatus.FINAL_APPROVED]
                )
                if indicator.is_incremental:
                    achieved = 0
                    for q in range(4, 0, -1):
                        p = perfs.filter(quarter=q).first()
                        if p and p.value is not None and str(p.value).upper() != 'N/A':
                            achieved = float(p.value)
                            break
                else:
                    achieved = sum(float(p.value) for p in perfs if p.value is not None and str(p.value).upper() != 'N/A')
                pct = (achieved / target * 100) if target > 0 else None
                if pct is not None and pct > 100: pct = 100.0

                yearly_data.append({
                    'year': y,
                    'target': target,
                    'achieved': achieved,
                    'percentage': pct
                })
            except AnnualPlan.DoesNotExist:
                yearly_data.append({
                    'year': y,
                    'target': 0,
                    'achieved': 0,
                    'percentage': None
                })

        def get_quarters_for_year(y):
            data = []
            try:
                plan = AnnualPlan.objects.get(indicator_id=indicator_id, year=y)
                try:
                    breakdown = QuarterlyBreakdown.objects.get(plan_id=plan.id)
                except QuarterlyBreakdown.DoesNotExist:
                    breakdown = None

                perfs = QuarterlyPerformance.objects.filter(
                    plan_id=plan.id,
                    status__in=[PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED, PerformanceStatus.FINAL_APPROVED]
                )

                for q in [1, 2, 3, 4]:
                    if breakdown:
                        if q == 1: q_target = float(breakdown.q1 or 0)
                        elif q == 2: q_target = float(breakdown.q2 or 0)
                        elif q == 3: q_target = float(breakdown.q3 or 0)
                        else: q_target = float(breakdown.q4 or 0)
                    else:
                        target_val = float(plan.target) if plan.target and str(plan.target).upper() != 'N/A' else 0
                        q_target = target_val / 4

                    q_perf = perfs.filter(quarter=q).first()
                    q_achieved = float(q_perf.value) if q_perf and q_perf.value is not None and str(q_perf.value).upper() != 'N/A' else None
                    
                    q_percentage = None
                    if q_target > 0 and q_achieved is not None:
                        q_percentage = (q_achieved / q_target) * 100
                        if q_percentage > 100: q_percentage = 100.0

                    data.append({
                        'quarter': q,
                        'target': q_target,
                        'achieved': q_achieved,
                        'percentage': q_percentage
                    })
            except AnnualPlan.DoesNotExist:
                for q in [1, 2, 3, 4]:
                    data.append({'quarter': q, 'target': 0, 'achieved': None, 'percentage': None})
            return data

        current_year_quarters = get_quarters_for_year(current_year)
        last_year_quarters = get_quarters_for_year(current_year - 1)

        return Response({
            'indicator': {
                'id': indicator.id,
                'name': indicator.name,
                'unit': indicator.unit or '',
                'description': indicator.description or '',
                'department_name': indicator.department.name,
                'kpi_characteristics': getattr(indicator, 'kpi_characteristics', '')
            },
            'yearly_data': yearly_data,
            'current_year_quarters': current_year_quarters,
            'last_year_quarters': last_year_quarters,
        })


class DepartmentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Returns department-scoped performance dashboard for LEAD_EXECUTIVE_BODY users."""
        from rest_framework import status as drf_status
        user = request.user
        role = getattr(user, 'role', '').upper()
        is_super = getattr(user, 'is_superuser', False)

        if not is_super and role != 'LEAD_EXECUTIVE_BODY':
            return Response({'detail': 'Permission denied.'}, status=403)

        dept_obj = getattr(user, 'department', None)
        if not dept_obj:
            return Response({'detail': 'No department assigned to your account.'}, status=400)

        dept_id = dept_obj.id

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

        if not year:
            latest_plan = AnnualPlan.objects.filter(indicator__department_id=dept_id).order_by('-year').first()
            if latest_plan:
                year = latest_plan.year
            else:
                return Response({
                    'year': None, 'quarter_months': None,
                    'department': {'id': dept_id, 'name': dept_obj.name, 'performance_percentage': None},
                    'groups': [], 'ungrouped_indicators': []
                })

        plans_qs = list(AnnualPlan.objects.select_related(
            'indicator__department__sector'
        ).prefetch_related(
            'indicator__groups'
        ).filter(year=year, indicator__department_id=dept_id))

        perfs_qs = list(QuarterlyPerformance.objects.select_related('plan').filter(
            plan__year=year,
            plan__indicator__department_id=dept_id,
            status__in=[PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED, PerformanceStatus.FINAL_APPROVED]
        ))

        breakdowns_qs = list(QuarterlyBreakdown.objects.select_related('plan').filter(
            plan__year=year,
            plan__indicator__department_id=dept_id,
            status__in=[PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED]
        ))

        perfs_by_plan = {}
        for p in perfs_qs:
            perfs_by_plan.setdefault(p.plan_id, []).append(p)

        bds_by_plan = {bd.plan_id: bd for bd in breakdowns_qs}

        indicators_data = []
        for plan in plans_qs:
            indicator = plan.indicator
            indicator_perfs = perfs_by_plan.get(plan.id, [])

            if quarter_months:
                qm_map = {1: 3, 2: 6, 3: 9, 4: 12}
                in_period = [p for p in indicator_perfs if qm_map.get(p.quarter, 12) <= quarter_months]
                if getattr(indicator, 'is_incremental', False):
                    filtered_perfs = []
                    for q in sorted({p.quarter for p in in_period}, reverse=True):
                        candidates = [p for p in in_period if p.quarter == q and p.value is not None]
                        if candidates:
                            filtered_perfs = candidates
                            break
                else:
                    filtered_perfs = in_period
            else:
                if getattr(indicator, 'is_incremental', False):
                    filtered_perfs = []
                    for q in range(4, 0, -1):
                        candidates = [p for p in indicator_perfs if p.quarter == q and p.value is not None]
                        if candidates:
                            filtered_perfs = candidates
                            break
                else:
                    filtered_perfs = indicator_perfs

            is_na_target = plan.target is None or plan.target == '' or str(plan.target).upper() == 'N/A'
            target = 0
            if not is_na_target:
                try:
                    target = float(plan.target)
                    if quarter_months:
                        bd = bds_by_plan.get(plan.id)
                        if bd:
                            qm_map = {1: 3, 2: 6, 3: 9, 4: 12}
                            in_period_quarters = [q for q in [1, 2, 3, 4] if qm_map[q] <= quarter_months]
                            if getattr(indicator, 'is_incremental', False):
                                qt = 0
                                for q in sorted(in_period_quarters, reverse=True):
                                    v = getattr(bd, f'q{q}', None)
                                    if v is not None:
                                        qt = float(v)
                                        break
                            else:
                                qt = 0
                                if quarter_months >= 3: qt += float(bd.q1 or 0)
                                if quarter_months >= 6: qt += float(bd.q2 or 0)
                                if quarter_months >= 9: qt += float(bd.q3 or 0)
                                if quarter_months >= 12: qt += float(bd.q4 or 0)
                            target = qt
                        else:
                            target = (target * quarter_months) / 12
                except (ValueError, TypeError):
                    is_na_target = True
                    target = 0

            all_perf_na = all(
                p.value is None or p.value == '' or str(p.value).upper() == 'N/A'
                for p in filtered_perfs
            ) if filtered_perfs else True
            total_achieved = sum(
                float(p.value) for p in filtered_perfs
                if p.value is not None and p.value != '' and str(p.value).upper() != 'N/A'
            )

            if is_na_target or all_perf_na or target <= 0:
                perf_pct = None
            else:
                perf_pct = min((total_achieved / target) * 100, 100.0)

            groups = indicator.groups.all()
            group_id = groups.first().id if groups.exists() else None
            group_name = groups.first().name if groups.exists() else None

            indicators_data.append({
                'id': indicator.id,
                'plan_id': plan.id,
                'name': indicator.name,
                'unit': indicator.unit,
                'description': indicator.description,
                'is_aggregatable': indicator.is_aggregatable,
                'target': 0 if is_na_target else target,
                'achieved': 0 if all_perf_na else total_achieved,
                'performance_percentage': perf_pct,
                'group_id': group_id,
                'group_name': group_name,
                'kpi_characteristics': getattr(indicator, 'kpi_characteristics', ''),
            })

        groups_dict = {}
        ungrouped = []
        for ind in indicators_data:
            if ind['group_id']:
                gid = ind['group_id']
                if gid not in groups_dict:
                    groups_dict[gid] = {'id': gid, 'name': ind['group_name'], 'indicators': []}
                groups_dict[gid]['indicators'].append(ind)
            else:
                ungrouped.append(ind)

        groups_result = []
        for g_id, g_data in groups_dict.items():
            g_agg_pcts = [
                ind['performance_percentage']
                for ind in g_data['indicators']
                if ind.get('is_aggregatable', True) and ind['performance_percentage'] is not None
            ]
            g_perf = sum(g_agg_pcts) / len(g_agg_pcts) if g_agg_pcts else None
            try:
                group_obj = IndicatorGroup.objects.get(id=g_id)
                is_label = group_obj.is_label
            except IndicatorGroup.DoesNotExist:
                is_label = False
            if is_label:
                g_perf = None
            groups_result.append({
                'id': g_data['id'],
                'name': g_data['name'],
                'performance_percentage': g_perf,
                'indicators': g_data['indicators'],
                'is_label': is_label,
            })

        agg_pcts = [
            ind['performance_percentage']
            for ind in indicators_data
            if ind.get('is_aggregatable', True) and ind['performance_percentage'] is not None
        ]
        dept_perf = sum(agg_pcts) / len(agg_pcts) if agg_pcts else None

        return Response({
            'year': year,
            'quarter_months': quarter_months,
            'department': {
                'id': dept_id,
                'name': dept_obj.name,
                'performance_percentage': dept_perf,
            },
            'groups': groups_result,
            'ungrouped_indicators': ungrouped,
        })


class MinistryPerformanceTrendsView(APIView):
    """
    Ministry-wide indicator achievement percentage per fiscal year, across
    multiple years, for trend charts (e.g. performance vs budget utilization).

    Query params:
      - years (optional, default 5): number of most-recent years to include.

    Response:
      {
        "trends": [
          {"year": 2017, "achievement_percentage": 82.4,
           "total_target": 1000.0, "total_achieved": 824.0},
          ...
        ]
      }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            num_years = int(request.query_params.get('years', 5))
        except (TypeError, ValueError):
            num_years = 5
        num_years = max(1, min(num_years, 20))

        # Distinct years that have annual plans, most recent first
        all_years = list(
            AnnualPlan.objects.order_by('-year')
            .values_list('year', flat=True)
            .distinct()
        )
        selected_years = sorted(all_years[:num_years])

        approved_statuses = [
            PerformanceStatus.APPROVED,
            PerformanceStatus.VALIDATED,
            PerformanceStatus.FINAL_APPROVED,
        ]

        trends = []
        for year in selected_years:
            plans_qs = AnnualPlan.objects.select_related('indicator').filter(year=year)
            perfs_qs = QuarterlyPerformance.objects.select_related('plan__indicator').filter(
                plan__year=year,
                status__in=approved_statuses,
            )

            total_target = sum(float(p.target) for p in plans_qs if p.target is not None)

            # For incremental indicators keep only the last non-null quarter per plan
            last_incremental = {}
            for p in perfs_qs:
                if p.plan.indicator.is_incremental and p.value is not None:
                    prev = last_incremental.get(p.plan_id)
                    if prev is None or p.quarter > prev.quarter:
                        last_incremental[p.plan_id] = p
            filtered_perfs = [
                p for p in perfs_qs
                if not p.plan.indicator.is_incremental
                or last_incremental.get(p.plan_id) is p
            ]

            total_achieved = sum(
                float(p.value) for p in filtered_perfs if p.value is not None
            )

            achievement_percentage = (
                round(total_achieved / total_target * 100, 1)
                if total_target > 0 else 0
            )

            trends.append({
                'year': year,
                'achievement_percentage': achievement_percentage,
                'total_target': total_target,
                'total_achieved': total_achieved,
            })

        return Response({'trends': trends})
