from django.shortcuts import render
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from decimal import Decimal
from .models import (
    AnnualPlan,
    QuarterlyBreakdown,
    QuarterlyPerformance,
    FileAttachment,
    SubmissionWindow,
    PlanStatus,
    PerformanceStatus,
    within_annual_breakdown_window,
    within_quarter_submission_window,
    AdvisorComment,
)
from .serializers import (
    AnnualPlanSerializer,
    QuarterlyBreakdownSerializer,
    QuarterlyPerformanceSerializer,
    FileAttachmentSerializer,
    SubmissionWindowSerializer,
    AdvisorCommentSerializer,
)

class SuperuserWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

class AnnualPlanViewSet(viewsets.ModelViewSet):
    queryset = AnnualPlan.objects.select_related('indicator', 'indicator__department', 'indicator__department__sector').all()
    serializer_class = AnnualPlanSerializer
    permission_classes = [SuperuserWritePermission]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Filter by year if provided
        year = self.request.query_params.get('year')
        if year:
            try:
                qs = qs.filter(year=int(year))
            except ValueError:
                pass
        # Superuser and Strategic Staff see all (unless department assigned)
        if getattr(user, 'is_superuser', False):
            return qs

        role = getattr(user, 'role', '').upper()
        if role == 'STRATEGIC_STAFF':
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                return qs.filter(indicator__department__id=dept_id)
            return qs
        if role == 'EXECUTIVE':
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                return qs.filter(indicator__department__id=dept_id)
            return qs
        if role == 'MINISTER_VIEW':
            # Read-only: show approved or higher plans (context)
            return qs
        if role == 'STATE_MINISTER':
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if sector_id:
                qs = qs.filter(indicator__department__sector__id=sector_id)
        elif role == 'ADVISOR':
            # Advisors see only their sector's annual plans
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if sector_id:
                qs = qs.filter(indicator__department__sector__id=sector_id)
        elif role == 'LEAD_EXECUTIVE_BODY':
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                qs = qs.filter(indicator__department__id=dept_id)
        return qs


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def submission_window_status(request):
    """Return current submission window status for breakdown and performance.

    Optional query params:
      - year: Gregorian year to check breakdown window for (defaults to now.year)

    Uses existing helpers within_annual_breakdown_window and within_quarter_submission_window.
    """
    now = timezone.now()

    # Year: allow explicit param, default to current year
    year_param = request.query_params.get('year')
    try:
        year = int(year_param) if year_param is not None else now.year
    except ValueError:
        year = now.year

    # For breakdowns we only care if *today* is within the configured breakdown window
    breakdown_open = within_annual_breakdown_window(now)

    # For performance, we check each quarter using the helper
    perf_windows = {}
    for q in (1, 2, 3, 4):
        perf_windows[str(q)] = within_quarter_submission_window(now, q)

    return Response(
        {
            'year': year,
            'is_breakdown_window_open': bool(breakdown_open),
            'performance_windows': perf_windows,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def minister_review_summary(request):
    """Summary of expected vs approved breakdowns and performances for State Minister.

    Rules:
      - Expected breakdowns: all annual plans in the minister's scope/year (each should have one breakdown).
      - Expected performances: only for quarters whose submission window has already closed
        (e.g. if only Q1 and Q2 windows passed, then 2 expected per indicator).
    """
    user = request.user
    role = getattr(user, 'role', '').upper()
    if role != 'STATE_MINISTER':
        return Response({'detail': 'Only State Minister can access this summary.'}, status=status.HTTP_403_FORBIDDEN)

    now = timezone.now()
    # Year is Gregorian; if not provided, default to current year
    year_param = request.query_params.get('year')
    try:
        year = int(year_param) if year_param is not None else now.year
    except ValueError:
        year = now.year

    # Determine scope (sector/department) from user
    dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
    sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)

    plans_qs = AnnualPlan.objects.select_related('indicator__department__sector').filter(year=year)
    if dept_id:
        plans_qs = plans_qs.filter(indicator__department__id=dept_id)
    elif sector_id:
        plans_qs = plans_qs.filter(indicator__department__sector__id=sector_id)

    # Department-wise aggregation
    departments = {}

    # Helper: which quarters are expected (current performance period only)
    # A quarter is considered in the performance period if its submission window is open.
    open_quarters = []
    for q in (1, 2, 3, 4):
        if within_quarter_submission_window(now, q):
            open_quarters.append(q)

    # Preload breakdowns and performances
    b_qs = QuarterlyBreakdown.objects.select_related('plan__indicator__department').filter(plan__in=plans_qs)
    p_qs = QuarterlyPerformance.objects.select_related('plan__indicator__department').filter(plan__in=plans_qs)

    # Map for quick lookup
    bd_by_plan = {bd.plan_id: bd for bd in b_qs}
    perfs_by_plan = {}
    for pr in p_qs:
        perfs_by_plan.setdefault(pr.plan_id, []).append(pr)

    approved_status_plan = {PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED}
    approved_status_perf = {PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED, PerformanceStatus.FINAL_APPROVED}

    for plan in plans_qs:
        dept = plan.indicator.department
        did = dept.id
        if did not in departments:
            departments[did] = {
                'department_id': did,
                'department_name': getattr(dept, 'name', ''),
                'expected_breakdowns': 0,
                'approved_breakdowns': 0,
                'expected_performances': 0,
                'approved_performances': 0,
            }

        info = departments[did]

        # Breakdown expectation: one per annual plan
        info['expected_breakdowns'] += 1
        bd = bd_by_plan.get(plan.id)
        if bd and bd.status in approved_status_plan:
            info['approved_breakdowns'] += 1

        # Performance expectation: one per *current* performance quarter for this plan
        perf_list = perfs_by_plan.get(plan.id, [])
        for q in open_quarters:
            info['expected_performances'] += 1
            perf = next((p for p in perf_list if p.quarter == q), None)
            if perf and perf.status in approved_status_perf:
                info['approved_performances'] += 1

    # Totals and overall flags
    total_expected_bd = sum(d['expected_breakdowns'] for d in departments.values())
    total_approved_bd = sum(d['approved_breakdowns'] for d in departments.values())
    total_expected_pf = sum(d['expected_performances'] for d in departments.values())
    total_approved_pf = sum(d['approved_performances'] for d in departments.values())

    all_breakdowns_approved = total_expected_bd > 0 and total_expected_bd == total_approved_bd
    all_performances_approved = total_expected_pf > 0 and total_expected_pf == total_approved_pf

    return Response(
        {
            'year': year,
            'departments': list(departments.values()),
            'totals': {
                'expected_breakdowns': total_expected_bd,
                'approved_breakdowns': total_approved_bd,
                'expected_performances': total_expected_pf,
                'approved_performances': total_approved_pf,
            },
            'all_breakdowns_approved': all_breakdowns_approved,
            'all_performances_approved': all_performances_approved,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_to_strategic(request):
    """Batch endpoint used by State Minister to send approved items to Strategic Affairs Staff.

    Frontend (Reviews.tsx) calls this with:
      {
        "breakdown_ids": [1, 2, ...],
        "performance_ids": [10, 11, ...]
      }

    Only items with status=APPROVED are marked as sent_to_strategic.
    """
    role = getattr(request.user, 'role', '').upper()
    if role != 'STATE_MINISTER':
        return Response({'detail': 'Only State Minister can submit to Strategic Affairs Staff.'}, status=status.HTTP_403_FORBIDDEN)

    # Optional mode to allow submitting plans and performances separately.
    # mode can be:
    #   - 'plans': only breakdown plans are submitted/validated
    #   - 'performances': only quarterly performances are submitted/validated
    #   - anything else / missing: treat as both together (original behaviour)
    mode = (request.data.get('mode') or '').strip().lower()

    breakdown_ids = request.data.get('breakdown_ids') or []
    performance_ids = request.data.get('performance_ids') or []

    if not isinstance(breakdown_ids, list) or not isinstance(performance_ids, list):
        return Response({'detail': 'Invalid payload. Expected lists of IDs.'}, status=status.HTTP_400_BAD_REQUEST)

    # Scope: limit consistency checks to the State Minister's area (sector/department)
    scope_breakdowns = QuarterlyBreakdown.objects.select_related('plan', 'plan__indicator__department__sector')
    scope_perfs = QuarterlyPerformance.objects.select_related('plan', 'plan__indicator__department__sector')

    user = request.user
    dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
    sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)

    if dept_id:
        scope_breakdowns = scope_breakdowns.filter(plan__indicator__department__id=dept_id)
        scope_perfs = scope_perfs.filter(plan__indicator__department__id=dept_id)
    elif sector_id:
        scope_breakdowns = scope_breakdowns.filter(plan__indicator__department__sector__id=sector_id)
        scope_perfs = scope_perfs.filter(plan__indicator__department__sector__id=sector_id)

    # Determine relevant years from the items being submitted
    submit_bd_qs = QuarterlyBreakdown.objects.filter(id__in=breakdown_ids)
    submit_pf_qs = QuarterlyPerformance.objects.filter(id__in=performance_ids)
    years = set()
    if mode in ('', 'both', 'plans'):
        years.update(submit_bd_qs.values_list('plan__year', flat=True))
    if mode in ('', 'both', 'performances'):
        years.update(submit_pf_qs.values_list('plan__year', flat=True))

    # Business rule: State Minister can submit only when ALL items of the selected type
    # (plans and/or performances) from all Lead Executive Bodies (in their scope and year)
    # are approved (no draft/submitted/rejected left). Partial submission within each
    # category is not allowed.
    blocking_statuses_plan = [PlanStatus.DRAFT, PlanStatus.SUBMITTED, PlanStatus.REJECTED]
    blocking_statuses_perf = [
        PerformanceStatus.DRAFT,
        PerformanceStatus.SUBMITTED,
        PerformanceStatus.REJECTED,
    ]

    for y in years:
        pending_bd = scope_breakdowns.filter(plan__year=y, status__in=blocking_statuses_plan)
        pending_pf = scope_perfs.filter(plan__year=y, status__in=blocking_statuses_perf)

        block_plans = mode in ('', 'both', 'plans') and pending_bd.exists()
        block_perfs = mode in ('', 'both', 'performances') and pending_pf.exists()

        if block_plans or block_perfs:
            if mode in ('plans',):
                detail = 'Submission blocked: all quarterly breakdown plans for the year must be approved before sending to Strategic Affairs Staff. Please ensure there are no draft/submitted/rejected items.'
            elif mode in ('performances',):
                detail = 'Submission blocked: all quarterly performance reports for the year must be approved before sending to Strategic Affairs Staff. Please ensure there are no draft/submitted/rejected items.'
            else:
                detail = 'Submission blocked: all quarterly breakdown plans and performance reports for the year must be approved before sending to Strategic Affairs Staff. Please ensure there are no draft/submitted/rejected items.'

            return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)

    # At this point, all relevant items in scope and year(s) are approved/validated/final approved.
    # Update only APPROVED items so flow is: SUBMITTED -> APPROVED (State Minister)
    # -> sent_to_strategic=True -> VALIDATED (Strategic).
    breakdowns_sent = 0
    performances_sent = 0

    if mode in ('', 'both', 'plans') and breakdown_ids:
        bqs = scope_breakdowns.filter(id__in=breakdown_ids, status=PlanStatus.APPROVED)
        breakdowns_sent = bqs.update(sent_to_strategic=True)

    if mode in ('', 'both', 'performances') and performance_ids:
        pqs = scope_perfs.filter(id__in=performance_ids, status=PerformanceStatus.APPROVED)
        performances_sent = pqs.update(sent_to_strategic=True)

    return Response(
        {
            'detail': 'Approved items submitted to Strategic Affairs Staff.',
            'breakdowns_sent': breakdowns_sent,
            'performances_sent': performances_sent,
        },
        status=status.HTTP_200_OK,
    )


class QuarterlyBreakdownViewSet(viewsets.ModelViewSet):
    queryset = QuarterlyBreakdown.objects.select_related('plan', 'plan__indicator').all()
    serializer_class = QuarterlyBreakdownSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Superusers see all
        if getattr(user, 'is_superuser', False):
            return qs
        role = getattr(user, 'role', '').upper()
        if role == 'STRATEGIC_STAFF':
            # Strategic Affairs Staff should only see items explicitly sent to them
            qs = qs.filter(sent_to_strategic=True)
            # If user is tied to a department, restrict to that department
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                return qs.filter(plan__indicator__department__id=dept_id)
            return qs
        if role == 'EXECUTIVE':
            # If user is tied to a department, restrict to that department
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                return qs.filter(plan__indicator__department__id=dept_id)
            return qs
        if role == 'MINISTER_VIEW':
            # Read-only: show approved or higher breakdowns
            return qs.filter(status__in=[PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED])
        if role == 'STATE_MINISTER':
            # Limit to user's sector/department
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                qs = qs.filter(plan__indicator__department__id=dept_id)
            elif sector_id:
                qs = qs.filter(plan__indicator__department__sector__id=sector_id)
        elif role == 'ADVISOR':
            # Advisors see only their sector's data
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if sector_id:
                qs = qs.filter(plan__indicator__department__sector__id=sector_id)
        elif role == 'LEAD_EXECUTIVE_BODY':
            # Lead Executive Body can see all unless assigned to a department; then restrict
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                qs = qs.filter(plan__indicator__department__id=dept_id)
        return qs

    def _allow_plan_edit(self, request):
        role = getattr(request.user, 'role', '').upper()
        # Only Lead Executive Body encodes (creates/updates) quarterly breakdowns.
        # Other roles, including State Minister and Advisors, are read-only for
        # the underlying records and may only review or approve.
        if role != 'LEAD_EXECUTIVE_BODY':
            return False
        return True

    def create(self, request, *args, **kwargs):
        if not self._allow_plan_edit(request):
            return Response({'detail': 'Only Lead Executive Body can create quarterly breakdowns.'}, status=status.HTTP_403_FORBIDDEN)
        # Enforce department scope on create
        try:
            plan_id = int(request.data.get('plan'))
        except Exception:
            plan_id = None
        if plan_id:
            try:
                plan = AnnualPlan.objects.select_related('indicator__department').get(id=plan_id)
            except AnnualPlan.DoesNotExist:
                return Response({'detail': 'Invalid plan.'}, status=status.HTTP_400_BAD_REQUEST)
            user_dept = getattr(getattr(request.user, 'department', None), 'id', None) or getattr(request.user, 'department', None)
            if user_dept and getattr(plan.indicator.department, 'id', plan.indicator.department) != user_dept:
                return Response({'detail': 'You can only create breakdowns for your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        # Also enforce annual breakdown submission window on create
        now = timezone.now()
        if not within_annual_breakdown_window(now):
            return Response({'detail': 'Entry window closed for annual breakdown.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._allow_plan_edit(request):
            return Response({'detail': 'Only Lead Executive Body can update quarterly breakdowns.'}, status=status.HTTP_403_FORBIDDEN)
        # Enforce department scope on update
        obj = self.get_object()
        user_dept = getattr(getattr(request.user, 'department', None), 'id', None) or getattr(request.user, 'department', None)
        if user_dept and getattr(obj.plan.indicator.department, 'id', obj.plan.indicator.department) != user_dept:
            return Response({'detail': 'You can only update breakdowns for your assigned department.'}, status=status.HTTP_403_FORBIDDEN)
        # Enforce annual breakdown submission window on update as well
        now = timezone.now()
        if not within_annual_breakdown_window(now):
            return Response({'detail': 'Entry window closed for annual breakdown.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        obj = self.get_object()
        now = timezone.now()
        # Only LEAD_EXECUTIVE_BODY can submit plans
        role = getattr(request.user, 'role', '')
        if role != 'LEAD_EXECUTIVE_BODY':
            return Response({'detail': 'Only Lead Executive Body can submit quarterly breakdowns.'}, status=status.HTTP_403_FORBIDDEN)
            
        if not within_annual_breakdown_window(now):
            return Response({'detail': 'Submission window closed (15 days from Jan 1).'}, status=status.HTTP_400_BAD_REQUEST)
            
        if obj.status not in [PlanStatus.DRAFT, PlanStatus.REJECTED]:
            return Response({'detail': 'Only draft or rejected breakdowns can be submitted.'}, status=status.HTTP_400_BAD_REQUEST)

        # For non-incremental indicators, quarterly totals must match the annual target
        indicator = obj.plan.indicator
        if not indicator.is_incremental:
            applicable_values = []
            for quarter, value in [(1, obj.q1), (2, obj.q2), (3, obj.q3), (4, obj.q4)]:
                if indicator.is_quarter_applicable(quarter):
                    applicable_values.append(value or 0)
            quarter_sum = sum(applicable_values)
            annual_target = obj.plan.target
            if abs(quarter_sum - annual_target) > 0.01:
                return Response(
                    {'detail': f'Quarter breakdown total ({quarter_sum:.2f}) must equal the annual plan target ({annual_target:.2f}). Please adjust the quarterly values before submitting.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Set status to SUBMITTED (goes directly to State Minister)
        # Advisors can still view and comment, but their verification is not required
        obj.status = PlanStatus.SUBMITTED
        obj.submitted_by = request.user
        obj.submitted_at = now
        obj.save()
        
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        obj = self.get_object()
        if request.user.role != 'STATE_MINISTER':
            return Response({'detail': 'Only State Minister can approve.'}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != PlanStatus.SUBMITTED:
            return Response({'detail': 'Only submitted breakdowns can be approved.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PlanStatus.APPROVED
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.review_comment = request.data.get('comment', '')
        obj.save()
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        obj = self.get_object()
        if request.user.role != 'STRATEGIC_STAFF':
            return Response({'detail': 'Only Strategic Affairs Staff can validate.'}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != PlanStatus.APPROVED:
            return Response({'detail': 'Only approved breakdowns can be validated.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PlanStatus.VALIDATED
        obj.validated_by = request.user
        obj.validated_at = timezone.now()
        obj.save()
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def final_approve(self, request, pk=None):
        obj = self.get_object()
        if request.user.role != 'EXECUTIVE':
            return Response({'detail': 'Only Executive Officer can final approve.'}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != PlanStatus.VALIDATED:
            return Response({'detail': 'Only validated breakdowns can be final approved.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PlanStatus.FINAL_APPROVED
        obj.final_approved_by = request.user
        obj.final_approved_at = timezone.now()
        obj.save()
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        obj = self.get_object()
        # Only reviewer roles can reject
        if request.user.role not in ['STATE_MINISTER', 'STRATEGIC_STAFF', 'EXECUTIVE']:
            return Response({'detail': 'Only reviewer roles can reject.'}, status=status.HTTP_403_FORBIDDEN)
        # Strategic Staff must provide a rejection note
        comment = (request.data.get('comment', '') or '').strip()
        if request.user.role == 'STRATEGIC_STAFF' and not comment:
            return Response({'detail': 'Rejection note is required for Strategic Affairs Staff.'}, status=status.HTTP_400_BAD_REQUEST)
        if obj.status not in [PlanStatus.SUBMITTED, PlanStatus.APPROVED, PlanStatus.VALIDATED]:
            return Response({'detail': 'Only submitted or in-approval breakdowns can be rejected.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PlanStatus.REJECTED
        obj.review_comment = comment
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.save()
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def advisor_review(self, request, pk=None):
        """Allow advisors to add a review comment without changing status.

        This is purely for documentation/feedback; the official status still
        moves only through submit/approve/validate/final_approve/reject.
        """
        obj = self.get_object()
        role = getattr(request.user, 'role', '')
        if role != 'ADVISOR':
            return Response({'detail': 'Only Advisor can use advisor_review.'}, status=status.HTTP_403_FORBIDDEN)

        comment = (request.data.get('comment', '') or '').strip()
        if not comment:
            return Response({'detail': 'Comment is required.'}, status=status.HTTP_400_BAD_REQUEST)

        prefix = 'Advisor: '
        new_note = prefix + comment
        if obj.review_comment:
            obj.review_comment = obj.review_comment + '\n' + new_note
        else:
            obj.review_comment = new_note
        obj.save(update_fields=['review_comment'])
        return Response(self.get_serializer(obj).data)


class QuarterlyPerformanceViewSet(viewsets.ModelViewSet):
    queryset = QuarterlyPerformance.objects.select_related('plan', 'plan__indicator').all()
    serializer_class = QuarterlyPerformanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Optional filters
        year = self.request.query_params.get('year')
        quarter = self.request.query_params.get('quarter')
        if year:
            try:
                qs = qs.filter(plan__year=int(year))
            except ValueError:
                pass
        if quarter:
            try:
                qs = qs.filter(quarter=int(quarter))
            except ValueError:
                pass
        if getattr(user, 'is_superuser', False):
            return qs
        role = getattr(user, 'role', '').upper()
        if role == 'STRATEGIC_STAFF':
            # Strategic Affairs Staff should only see items explicitly sent to them
            qs = qs.filter(sent_to_strategic=True)
            # Restrict to user's department if assigned
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                return qs.filter(plan__indicator__department__id=dept_id)
            return qs
        if role == 'EXECUTIVE':
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                return qs.filter(plan__indicator__department__id=dept_id)
            return qs
        if role == 'MINISTER_VIEW':
            # Read-only: show approved or higher performances
            return qs.filter(status__in=[PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED, PerformanceStatus.FINAL_APPROVED])
        if role == 'STATE_MINISTER':
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                qs = qs.filter(plan__indicator__department__id=dept_id)
            elif sector_id:
                qs = qs.filter(plan__indicator__department__sector__id=sector_id)
        elif role == 'ADVISOR':
            # Advisors see only their sector's data
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            if sector_id:
                qs = qs.filter(plan__indicator__department__sector__id=sector_id)
        elif role == 'LEAD_EXECUTIVE_BODY':
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                qs = qs.filter(plan__indicator__department__id=dept_id)
        return qs
    def _advisor_can_edit_perf(self, plan):
        bd = QuarterlyBreakdown.objects.filter(plan=plan).first()
        if not bd:
            return False
        # Advisors are allowed to work with performance only after the quarterly breakdown
        # has reached at least State Minister approval (APPROVED or beyond).
        return bd.status in [PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED]

    def _allow_perf_edit(self, request, plan, is_na_performance=False):
        # Nobody can edit quarterly performance until the related quarterly breakdown
        # has reached at least State Minister approval, and only Lead Executive Body
        # and State Minister can encode (create/update) the performance values.
        # Exception: N/A performances can be created without approved breakdown since there's nothing to track
        if not is_na_performance:
            bd = QuarterlyBreakdown.objects.filter(plan=plan).first()
            if not bd or bd.status not in [PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED]:
                return False

        role = getattr(request.user, 'role', '')
        if role not in ['LEAD_EXECUTIVE_BODY', 'STATE_MINISTER']:
            return False
        # Department scope enforcement
        user_dept = getattr(getattr(request.user, 'department', None), 'id', None) or getattr(request.user, 'department', None)
        if user_dept and getattr(plan.indicator.department, 'id', plan.indicator.department) != user_dept:
            return False
        return True

    def create(self, request, *args, **kwargs):
        plan_id = request.data.get('plan')
        try:
            plan = AnnualPlan.objects.get(id=plan_id)
        except AnnualPlan.DoesNotExist:
            return Response({'detail': 'Invalid plan.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if this is an N/A performance
        value = request.data.get('value')
        status = request.data.get('status', 'DRAFT')
        is_na_performance = value is None or value == '' or value == 'N/A'
        
        if not self._allow_perf_edit(request, plan, is_na_performance):
            return Response({'detail': 'Only Lead Executive Body can create performance for an approved quarterly plan.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Enforce quarter submission window on create (except for N/A performances)
        try:
            quarter = int(request.data.get('quarter'))
        except (TypeError, ValueError):
            quarter = None
        if quarter is not None and not is_na_performance:
            now = timezone.now()
            if not within_quarter_submission_window(now, quarter):
                return Response({'detail': 'Entry window closed for this quarter performance.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # For N/A performances, default status to FINAL_APPROVED
        if is_na_performance:
            response = super().create(request, *args, **kwargs)
            perf = QuarterlyPerformance.objects.get(id=response.data['id'])
            perf.status = PerformanceStatus.FINAL_APPROVED
            perf.final_approved_by = request.user
            perf.final_approved_at = timezone.now()
            perf.save()
            serializer = self.get_serializer(perf)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        # Do not allow any edits after the performance has been approved/validated/final approved.
        # State Minister, however, is allowed to make corrections on SUBMITTED items
        # during the review stage.
        if obj.status not in [PerformanceStatus.DRAFT, PerformanceStatus.REJECTED, PerformanceStatus.SUBMITTED]:
            return Response({'detail': 'Performance cannot be edited after approval/validation. Please request a rejection to make changes.'}, status=status.HTTP_400_BAD_REQUEST)
        if obj.status == PerformanceStatus.SUBMITTED and getattr(request.user, 'role', '') != 'STATE_MINISTER':
            return Response({'detail': 'Only State Minister can edit submitted performance.'}, status=status.HTTP_403_FORBIDDEN)

        # Check if this is an N/A performance
        value = request.data.get('value', obj.value)
        is_na_performance = value is None or value == '' or value == 'N/A'
        
        if not self._allow_perf_edit(request, obj.plan, is_na_performance):
            return Response({'detail': 'Only Lead Executive Body can update performance for an approved quarterly plan.'}, status=status.HTTP_403_FORBIDDEN)
        # Enforce quarter submission window on update (except for N/A performances)
        if not is_na_performance:
            now = timezone.now()
            if not within_quarter_submission_window(now, obj.quarter):
                return Response({'detail': 'Entry window closed for this quarter performance.'}, status=status.HTTP_400_BAD_REQUEST)
        response = super().update(request, *args, **kwargs)

        # Auto-final approve N/A performances after update
        if is_na_performance:
            obj.refresh_from_db()
            obj.status = PerformanceStatus.FINAL_APPROVED
            obj.final_approved_by = request.user
            obj.final_approved_at = timezone.now()
            obj.save()
            serializer = self.get_serializer(obj)
            return Response(serializer.data)

        return response

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        obj = self.get_object()
        now = timezone.now()
        # Only LEAD_EXECUTIVE_BODY can submit performance reports
        role = getattr(request.user, 'role', '')
        if role != 'LEAD_EXECUTIVE_BODY':
            return Response({'detail': 'Only Lead Executive Body can submit performance reports.'}, status=status.HTTP_403_FORBIDDEN)

        if obj.status not in [PerformanceStatus.DRAFT, PerformanceStatus.REJECTED]:
            return Response({'detail': 'Only draft or rejected performance can be submitted.'}, status=status.HTTP_400_BAD_REQUEST)

        # N/A performances (value is None) bypass window and breakdown checks,
        # consistent with how create() and update() handle them.
        is_na_performance = obj.value is None

        if not is_na_performance:
            if not within_quarter_submission_window(now, obj.quarter):
                return Response({'detail': 'Submission window closed (10 days after quarter end).'}, status=status.HTTP_400_BAD_REQUEST)

            # Ensure the related quarterly breakdown plan is APPROVED by the State Minister
            bd = QuarterlyBreakdown.objects.filter(plan=obj.plan).first()
            if not bd or bd.status not in [PlanStatus.APPROVED, PlanStatus.VALIDATED, PlanStatus.FINAL_APPROVED]:
                return Response({'detail': 'Quarterly performance cannot be submitted until the corresponding quarterly breakdown plan is approved by the State Minister.'}, status=status.HTTP_400_BAD_REQUEST)

        # When the quarter performance is <84% or >110% of the quarterly target,
        # require the submitting Lead Executive Body to provide a description.
        # N/A performances have no numeric value so this check is skipped.
        if not is_na_performance:
            q_target = None
            if obj.quarter == 1:
                q_target = bd.q1 or 0
            elif obj.quarter == 2:
                q_target = bd.q2 or 0
            elif obj.quarter == 3:
                q_target = bd.q3 or 0
            elif obj.quarter == 4:
                q_target = bd.q4 or 0

            # Only perform the check when the quarterly target is positive.
            from decimal import Decimal
            if q_target and Decimal(q_target) > 0:
                perf_pct = (Decimal(obj.value) / Decimal(q_target)) * Decimal('100')
                if perf_pct < Decimal('84') or perf_pct > Decimal('110'):
                    variance_description = (request.data.get('variance_description') or '').strip()
                    if not variance_description:
                        return Response({'detail': 'Variance description is required when quarterly performance is less than 84% or greater than 110% of the target.'}, status=status.HTTP_400_BAD_REQUEST)
                    obj.variance_description = variance_description

        # Set status to SUBMITTED (goes directly to State Minister)
        # Advisors can still view and comment, but their verification is not required
        obj.status = PerformanceStatus.SUBMITTED
        obj.submitted_by = request.user
        obj.submitted_at = now
        obj.save()

        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        obj = self.get_object()
        if request.user.role != 'STATE_MINISTER':
            return Response({'detail': 'Only State Minister can approve.'}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != PerformanceStatus.SUBMITTED:
            return Response({'detail': 'Only submitted performance can be approved.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PerformanceStatus.APPROVED
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.review_comment = request.data.get('comment', '')
        obj.save()
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        obj = self.get_object()
        if request.user.role != 'STRATEGIC_STAFF':
            return Response({'detail': 'Only Strategic Affairs Staff can validate.'}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != PerformanceStatus.APPROVED:
            return Response({'detail': 'Only approved performance can be validated.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PerformanceStatus.VALIDATED
        obj.validated_by = request.user
        obj.validated_at = timezone.now()
        obj.save()
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def final_approve(self, request, pk=None):
        obj = self.get_object()
        if request.user.role != 'EXECUTIVE':
            return Response({'detail': 'Only Executive Officer can final approve.'}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != PerformanceStatus.VALIDATED:
            return Response({'detail': 'Only validated performance can be final approved.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PerformanceStatus.FINAL_APPROVED
        obj.final_approved_by = request.user
        obj.final_approved_at = timezone.now()
        obj.save()
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        obj = self.get_object()
        # Only reviewer roles can reject
        if request.user.role not in ['STATE_MINISTER', 'STRATEGIC_STAFF', 'EXECUTIVE']:
            return Response({'detail': 'Only reviewer roles can reject.'}, status=status.HTTP_403_FORBIDDEN)
        # Strategic Staff must provide a rejection note
        comment = (request.data.get('comment', '') or '').strip()
        if request.user.role == 'STRATEGIC_STAFF' and not comment:
            return Response({'detail': 'Rejection note is required for Strategic Affairs Staff.'}, status=status.HTTP_400_BAD_REQUEST)
        if obj.status not in [PerformanceStatus.SUBMITTED, PerformanceStatus.APPROVED, PerformanceStatus.VALIDATED]:
            return Response({'detail': 'Only submitted or in-approval performance can be rejected.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = PerformanceStatus.REJECTED
        obj.review_comment = comment
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.save()
        return Response(self.get_serializer(obj).data)


class FileAttachmentViewSet(viewsets.ModelViewSet):
    queryset = FileAttachment.objects.select_related('annual_plan', 'performance').all()
    serializer_class = FileAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

# Create your views here.


class SuperuserOnlyPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class SubmissionWindowViewSet(viewsets.ModelViewSet):
    queryset = SubmissionWindow.objects.all().order_by('-year', 'window_type')
    serializer_class = SubmissionWindowSerializer
    permission_classes = [SuperuserOnlyPermission]


class AdvisorCommentViewSet(viewsets.ModelViewSet):
    queryset = AdvisorComment.objects.select_related('author', 'sector', 'department').all().order_by('-created_at')
    serializer_class = AdvisorCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, 'role', '').upper()

        # Filters
        year = self.request.query_params.get('year')
        sector = self.request.query_params.get('sector')
        department = self.request.query_params.get('department')
        if year:
            try:
                qs = qs.filter(year=int(year))
            except ValueError:
                pass
        if department:
            try:
                qs = qs.filter(department_id=int(department))
            except ValueError:
                pass
        if sector:
            try:
                qs = qs.filter(sector_id=int(sector))
            except ValueError:
                pass

        # Visibility rules
        if getattr(user, 'is_superuser', False):
            return qs
        if role == 'LEAD_EXECUTIVE_BODY':
            return qs
        if role == 'STATE_MINISTER':
            # Limit to minister's sector/department
            sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
            dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
            if dept_id:
                qs = qs.filter(department_id=dept_id)
            elif sector_id:
                qs = qs.filter(sector_id=sector_id)
            return qs
        if role == 'ADVISOR':
            return qs.filter(author=user)
        # Others no access by default
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        role = getattr(user, 'role', '').upper()
        if role != 'ADVISOR':
            raise permissions.PermissionDenied('Only Advisor can create advisor comments.')
        # Default sector/department from user if not provided
        data = serializer.validated_data
        sector = data.get('sector') or getattr(user, 'sector', None)
        department = data.get('department') or getattr(user, 'department', None)
        serializer.save(author=user, sector=sector, department=department)
