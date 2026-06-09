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
    Document,
)
from .serializers import (
    AnnualPlanSerializer,
    QuarterlyBreakdownSerializer,
    QuarterlyPerformanceSerializer,
    FileAttachmentSerializer,
    SubmissionWindowSerializer,
    AdvisorCommentSerializer,
    DocumentSerializer,
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


class DocumentPermission(permissions.BasePermission):
    UPLOAD_ROLES = {'LEAD_EXECUTIVE_BODY', 'ADVISOR'}
    VIEW_ROLES = {'LEAD_EXECUTIVE_BODY', 'ADVISOR', 'STATE_MINISTER', 'STRATEGIC_STAFF', 'EXECUTIVE', 'MINISTER_VIEW'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        role = getattr(request.user, 'role', '').upper()
        if request.method in permissions.SAFE_METHODS:
            return role in self.VIEW_ROLES
        return role in self.UPLOAD_ROLES

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        role = getattr(request.user, 'role', '').upper()
        if request.method in permissions.SAFE_METHODS:
            return role in self.VIEW_ROLES
        # Only uploader or superuser can modify/delete
        return obj.uploaded_by == request.user


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.select_related('uploaded_by', 'sector', 'department').all()
    serializer_class = DocumentSerializer
    permission_classes = [DocumentPermission]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        user = self.request.user
        role = getattr(user, 'role', '').upper()
        if role not in DocumentPermission.UPLOAD_ROLES and not user.is_superuser:
            raise permissions.PermissionDenied('Only Lead Executive Body or Advisors can upload documents.')
        sector = getattr(user, 'sector', None)
        department = getattr(user, 'department', None)
        serializer.save(uploaded_by=user, sector=sector, department=department)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, 'role', '').upper()
        if not user.is_superuser:
            if role == 'STATE_MINISTER':
                sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
                if sector_id:
                    qs = qs.filter(sector_id=sector_id)
            elif role == 'LEAD_EXECUTIVE_BODY':
                dept_id = getattr(getattr(user, 'department', None), 'id', None) or getattr(user, 'department', None)
                if dept_id:
                    qs = qs.filter(department_id=dept_id)
            elif role == 'ADVISOR':
                sector_id = getattr(getattr(user, 'sector', None), 'id', None) or getattr(user, 'sector', None)
                if sector_id:
                    qs = qs.filter(sector_id=sector_id)
        sector_filter = self.request.query_params.get('sector')
        if sector_filter:
            qs = qs.filter(sector_id=sector_filter)
        dept_filter = self.request.query_params.get('department')
        if dept_filter:
            qs = qs.filter(department_id=dept_filter)
        doc_type = self.request.query_params.get('document_type')
        if doc_type:
            qs = qs.filter(document_type=doc_type)
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(year=year)
        quarter = self.request.query_params.get('quarter')
        if quarter:
            qs = qs.filter(quarter=quarter)
        return qs


# ---------------------------------------------------------------------------
# SuperAdmin Quarterly Data Management
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def superadmin_quarterly_data(request):
    """Return full Q1–Q4 plan & performance data for a given indicator + year.

    Query params:
      - indicator  (required) : Indicator ID
      - year       (required) : Gregorian fiscal year
    """
    if not request.user.is_superuser:
        return Response({'detail': 'Superadmin access required.'}, status=status.HTTP_403_FORBIDDEN)

    indicator_id = request.query_params.get('indicator')
    year_param = request.query_params.get('year')
    if not indicator_id or not year_param:
        return Response({'detail': 'Both indicator and year query params are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from indicators.models import Indicator
        indicator = Indicator.objects.select_related('department', 'department__sector').get(id=int(indicator_id))
    except (Indicator.DoesNotExist, ValueError):
        return Response({'detail': 'Indicator not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        year = int(year_param)
    except ValueError:
        return Response({'detail': 'Invalid year.'}, status=status.HTTP_400_BAD_REQUEST)

    group = indicator.groups.first()
    annual_plan = AnnualPlan.objects.filter(indicator=indicator, year=year).first()

    breakdown = None
    if annual_plan:
        breakdown = QuarterlyBreakdown.objects.filter(plan=annual_plan).first()

    performances = {}
    if annual_plan:
        for perf in QuarterlyPerformance.objects.filter(plan=annual_plan):
            performances[perf.quarter] = perf

    def _perf_data(q):
        p = performances.get(q)
        if not p:
            return None
        return {
            'id': p.id,
            'value': str(p.value) if p.value is not None else None,
            'status': p.status,
            'submitted_at': p.submitted_at,
            'reviewed_at': p.reviewed_at,
            'validated_at': p.validated_at,
            'final_approved_at': p.final_approved_at,
        }

    quarters_data = {}
    for q in (1, 2, 3, 4):
        applicable = indicator.is_quarter_applicable(q)
        plan_value = None
        if breakdown:
            plan_value = str(getattr(breakdown, f'q{q}')) if getattr(breakdown, f'q{q}') is not None else None
        quarters_data[f'q{q}'] = {
            'applicable': applicable,
            'plan': {
                'breakdown_id': breakdown.id if breakdown else None,
                'value': plan_value,
                'status': breakdown.status if breakdown else None,
            } if breakdown else None,
            'performance': _perf_data(q),
        }

    return Response({
        'indicator': {
            'id': indicator.id,
            'name': indicator.name,
            'unit': indicator.unit,
            'group_name': group.name if group else None,
            'department': indicator.department.name,
            'sector': indicator.department.sector.name,
            'applicable_quarters': indicator.get_applicable_quarters(),
        },
        'annual_plan': {
            'id': annual_plan.id if annual_plan else None,
            'target': str(annual_plan.target) if annual_plan else None,
            'year': year,
        },
        'breakdown': {
            'id': breakdown.id if breakdown else None,
            'status': breakdown.status if breakdown else None,
        } if breakdown else None,
        'quarters': quarters_data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def superadmin_update_quarterly(request):
    """SuperAdmin endpoint to update a plan value/status or performance value/status.

    Body (JSON):
      {
        "type":        "plan_value" | "plan_status" | "performance_value" | "performance_status",
        "breakdown_id": <int>  (required for plan_* types),
        "performance_id": <int> (required for performance_* types),
        "quarter":     1|2|3|4  (always required),
        "value":       <string|number>,
        "year":        <int>   (for context / logging)
      }
    """
    from .models import AdminEditLog

    if not request.user.is_superuser:
        return Response({'detail': 'Superadmin access required.'}, status=status.HTTP_403_FORBIDDEN)

    action_type = (request.data.get('type') or '').strip()
    quarter = request.data.get('quarter')
    new_value = request.data.get('value')
    year = request.data.get('year')

    VALID_PLAN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'VALIDATED', 'FINAL_APPROVED', 'REJECTED']
    VALID_PERF_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'VALIDATED', 'FINAL_APPROVED', 'REJECTED']

    try:
        quarter = int(quarter) if quarter is not None else None
    except (TypeError, ValueError):
        quarter = None

    if action_type in ('plan_value', 'plan_status'):
        breakdown_id = request.data.get('breakdown_id')
        if not breakdown_id:
            return Response({'detail': 'breakdown_id is required for plan edits.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            breakdown = QuarterlyBreakdown.objects.select_related(
                'plan__indicator__department__sector'
            ).get(id=int(breakdown_id))
        except (QuarterlyBreakdown.DoesNotExist, ValueError):
            return Response({'detail': 'QuarterlyBreakdown not found.'}, status=status.HTTP_404_NOT_FOUND)

        indicator = breakdown.plan.indicator
        dept = indicator.department
        sector = dept.sector

        if action_type == 'plan_value':
            if quarter not in (1, 2, 3, 4):
                return Response({'detail': 'Valid quarter (1-4) required.'}, status=status.HTTP_400_BAD_REQUEST)
            field = f'q{quarter}'
            old_val = str(getattr(breakdown, field)) if getattr(breakdown, field) is not None else 'N/A'
            if new_value == '' or new_value is None:
                setattr(breakdown, field, None)
            else:
                try:
                    from decimal import Decimal
                    setattr(breakdown, field, Decimal(str(new_value)))
                except Exception:
                    return Response({'detail': 'Invalid numeric value.'}, status=status.HTTP_400_BAD_REQUEST)
            breakdown.save(update_fields=[field])
            new_val = str(getattr(breakdown, field)) if getattr(breakdown, field) is not None else 'N/A'
            AdminEditLog.objects.create(
                edited_by=request.user,
                record_type=AdminEditLog.RecordType.PLAN_VALUE,
                quarter=quarter,
                year=breakdown.plan.year,
                indicator_name=indicator.name,
                sector_name=getattr(sector, 'name', ''),
                department_name=getattr(dept, 'name', ''),
                old_value=old_val,
                new_value=new_val,
                breakdown_id=breakdown.id,
            )
            return Response({'detail': f'Q{quarter} plan value updated successfully.', 'new_value': new_val})

        else:  # plan_status
            if new_value not in VALID_PLAN_STATUSES:
                return Response({'detail': f'Invalid status. Choose from: {", ".join(VALID_PLAN_STATUSES)}'}, status=status.HTTP_400_BAD_REQUEST)
            old_val = breakdown.status
            breakdown.status = new_value
            breakdown.save(update_fields=['status'])
            AdminEditLog.objects.create(
                edited_by=request.user,
                record_type=AdminEditLog.RecordType.PLAN_STATUS,
                quarter=quarter,
                year=breakdown.plan.year,
                indicator_name=indicator.name,
                sector_name=getattr(sector, 'name', ''),
                department_name=getattr(dept, 'name', ''),
                old_value=old_val,
                new_value=new_value,
                breakdown_id=breakdown.id,
            )
            return Response({'detail': 'Plan status updated successfully.', 'new_status': new_value})

    elif action_type in ('performance_value', 'performance_status'):
        performance_id = request.data.get('performance_id')
        if not performance_id:
            return Response({'detail': 'performance_id is required for performance edits.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            perf = QuarterlyPerformance.objects.select_related(
                'plan__indicator__department__sector'
            ).get(id=int(performance_id))
        except (QuarterlyPerformance.DoesNotExist, ValueError):
            return Response({'detail': 'QuarterlyPerformance not found.'}, status=status.HTTP_404_NOT_FOUND)

        indicator = perf.plan.indicator
        dept = indicator.department
        sector = dept.sector

        if action_type == 'performance_value':
            old_val = str(perf.value) if perf.value is not None else 'N/A'
            if new_value == '' or new_value is None:
                perf.value = None
            else:
                try:
                    from decimal import Decimal
                    perf.value = Decimal(str(new_value))
                except Exception:
                    return Response({'detail': 'Invalid numeric value.'}, status=status.HTTP_400_BAD_REQUEST)
            perf.save(update_fields=['value'])
            new_val = str(perf.value) if perf.value is not None else 'N/A'
            AdminEditLog.objects.create(
                edited_by=request.user,
                record_type=AdminEditLog.RecordType.PERFORMANCE_VALUE,
                quarter=perf.quarter,
                year=perf.plan.year,
                indicator_name=indicator.name,
                sector_name=getattr(sector, 'name', ''),
                department_name=getattr(dept, 'name', ''),
                old_value=old_val,
                new_value=new_val,
                performance_id=perf.id,
            )
            return Response({'detail': f'Q{perf.quarter} performance value updated successfully.', 'new_value': new_val})

        else:  # performance_status
            if new_value not in VALID_PERF_STATUSES:
                return Response({'detail': f'Invalid status. Choose from: {", ".join(VALID_PERF_STATUSES)}'}, status=status.HTTP_400_BAD_REQUEST)
            old_val = perf.status
            perf.status = new_value
            perf.save(update_fields=['status'])
            AdminEditLog.objects.create(
                edited_by=request.user,
                record_type=AdminEditLog.RecordType.PERFORMANCE_STATUS,
                quarter=perf.quarter,
                year=perf.plan.year,
                indicator_name=indicator.name,
                sector_name=getattr(sector, 'name', ''),
                department_name=getattr(dept, 'name', ''),
                old_value=old_val,
                new_value=new_value,
                performance_id=perf.id,
            )
            return Response({'detail': 'Performance status updated successfully.', 'new_status': new_value})

    return Response({'detail': 'Invalid action type. Use plan_value, plan_status, performance_value, or performance_status.'}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Excel Export  (hierarchical grouping mirrors the Spreadsheet view)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def excel_export(request):
    """Stream a hierarchical Excel file with KPI plan & performance data.

    Rows are organised identically to the Spreadsheet view:
      Sector → Department → Group tree (sub-groups then indicators) → Ungrouped

    Group rows show aggregated totals (is_aggregatable indicators only).
    Label groups are section headers with no values.

    Query params:
      - year   : Gregorian fiscal year (e.g. 2024)
      - period : 3 | 6 | 9 | 12  (months; maps to Q1–Q4)

    Columns (8):
      KPI | Unit | [Year] Plan | Q[X] Plan | Q[X] Performance |
      [N] Month Plan Target | [N] Month Performance | [N] Month Performance %
    """
    import io
    from django.http import HttpResponse
    from decimal import Decimal as _D

    allowed_roles = {'STRATEGIC_STAFF', 'EXECUTIVE'}
    user_role = getattr(request.user, 'role', '').upper()
    if not request.user.is_superuser and user_role not in allowed_roles:
        return Response({'detail': 'You do not have permission to export Excel reports.'}, status=status.HTTP_403_FORBIDDEN)

    year_param   = request.query_params.get('year')
    period_param = request.query_params.get('period')

    if not year_param or not period_param:
        return Response(
            {'detail': 'Both year and period query params are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    period_to_quarter = {'3': 1, '6': 2, '9': 3, '12': 4}
    quarter_num = period_to_quarter.get(str(period_param))
    if not quarter_num:
        return Response(
            {'detail': 'period must be one of: 3, 6, 9, 12.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        year   = int(year_param)
        months = int(period_param)
    except ValueError:
        return Response({'detail': 'Invalid year or period.'}, status=status.HTTP_400_BAD_REQUEST)

    # Convert Gregorian year to Ethiopian calendar year for display (2025 GC = 2018 EC)
    et_year = year - 7

    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
    except ImportError:
        return Response(
            {'detail': 'openpyxl is not installed. Run: pip install openpyxl'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    from indicators.models import IndicatorGroup, Indicator

    # ── Pre-fetch all plan / breakdown / performance data in bulk ─────────────
    all_plans = {
        ap.indicator_id: ap
        for ap in AnnualPlan.objects.filter(year=year).select_related('indicator')
    }
    all_breakdowns = {
        bd.plan.indicator_id: bd
        for bd in QuarterlyBreakdown.objects.filter(plan__year=year).select_related('plan')
    }
    all_perfs = {}
    for perf in QuarterlyPerformance.objects.filter(plan__year=year).select_related('plan'):
        all_perfs[(perf.plan.indicator_id, perf.quarter)] = perf

    # ── Compute the 8-column values for a single indicator ───────────────────
    def ind_vals(indicator):
        plan = all_plans.get(indicator.id)
        bd   = all_breakdowns.get(indicator.id)

        qx_plan = None
        if bd and indicator.is_quarter_applicable(quarter_num):
            qx_plan = getattr(bd, f'q{quarter_num}', None)

        qx_perf = None
        p = all_perfs.get((indicator.id, quarter_num))
        if p and p.value is not None and indicator.is_quarter_applicable(quarter_num):
            qx_perf = p.value

        cum_plan = None
        if bd:
            if indicator.is_incremental:
                for q in range(quarter_num, 0, -1):
                    if indicator.is_quarter_applicable(q):
                        v = getattr(bd, f'q{q}', None)
                        if v is not None:
                            cum_plan = v
                            break
            else:
                vlist = []
                for q in range(1, quarter_num + 1):
                    if indicator.is_quarter_applicable(q):
                        v = getattr(bd, f'q{q}', None)
                        if v is not None:
                            vlist.append(v)
                if vlist:
                    cum_plan = sum(vlist, _D('0'))

        cum_perf = None
        if indicator.is_incremental:
            for q in range(quarter_num, 0, -1):
                p2 = all_perfs.get((indicator.id, q))
                if p2 and p2.value is not None:
                    cum_perf = p2.value
                    break
        else:
            pv = []
            for q in range(1, quarter_num + 1):
                p2 = all_perfs.get((indicator.id, q))
                if p2 and p2.value is not None:
                    pv.append(p2.value)
            if pv:
                cum_perf = sum(pv, _D('0'))

        pct = None
        if cum_plan is not None and cum_plan != 0 and cum_perf is not None:
            pct = round(float(cum_perf) / float(cum_plan) * 100, 2)

        return {
            'annual_target': float(plan.target) if plan else None,
            'qx_plan':  float(qx_plan)  if qx_plan  is not None else None,
            'qx_perf':  float(qx_perf)  if qx_perf  is not None else None,
            'cum_plan': float(cum_plan)  if cum_plan is not None else None,
            'cum_perf': float(cum_perf)  if cum_perf is not None else None,
            'pct':      pct,
            'unit':     indicator.get_effective_unit() or '',
            'is_aggregatable': indicator.is_aggregatable,
        }

    from django.db.models import F as _F

    # ── Recursive tree builder — ordered by display_order ────────────────────
    def build_node(group):
        child_nodes = [
            build_node(c)
            for c in group.children.all()
            .order_by(_F('display_order').asc(nulls_last=True), 'name')
        ]
        ind_list = list(
            group.indicators
            .order_by(_F('display_order').asc(nulls_last=True), 'name')
        )
        ind_nodes = [
            {'type': 'indicator', 'name': ind.name, 'is_label': False,
             'unit': ind.get_effective_unit() or '', 'vals': ind_vals(ind)}
            for ind in ind_list
        ]

        grp = {'annual_target': None, 'qx_plan': None, 'qx_perf': None,
               'cum_plan': None, 'cum_perf': None, 'pct': None}

        if not group.is_label:
            agg_iv = [n['vals'] for n in ind_nodes if n['vals']['is_aggregatable']]
            agg_cv = [c['grp']  for c in child_nodes if not c['is_label']]

            for fld in ('annual_target', 'qx_plan', 'qx_perf', 'cum_plan', 'cum_perf'):
                parts = [v[fld] for v in agg_iv if v[fld] is not None]
                parts += [v[fld] for v in agg_cv if v[fld] is not None]
                if parts:
                    grp[fld] = sum(parts)

            if grp['cum_plan'] and grp['cum_plan'] != 0 and grp['cum_perf'] is not None:
                grp['pct'] = round(grp['cum_perf'] / grp['cum_plan'] * 100, 2)

        return {
            'type': 'group', 'name': group.name, 'is_label': group.is_label,
            'unit': group.get_inherited_unit(), 'grp': grp,
            'status': group.status,
            'children': child_nodes, 'indicators': ind_nodes,
        }

    # ── Flatten tree — each group coloured by its own status only ────────────
    def flatten(nodes, level, out):
        for n in nodes:
            node_status = n.get('status') if n['type'] == 'group' else None
            out.append({**n, 'level': level, 'row_status': node_status})
            if n['type'] == 'group':
                flatten(n.get('children',   []), level + 1, out)
                flatten(n.get('indicators', []), level + 1, out)

    # ── Root groups ordered strictly by display_order ─────────────────────────
    root_groups = (
        IndicatorGroup.objects
        .filter(parent__isnull=True)
        .prefetch_related('children', 'indicators')
        .order_by(_F('display_order').asc(nulls_last=True), 'name')
    )

    # ── Workbook & styles ─────────────────────────────────────────────────────
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Q{quarter_num} {et_year}"

    _thin     = Side(style='thin', color='CCCCCC')
    _thin_brd = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)

    _hdr_font  = Font(bold=True, color='000000', size=10)
    _hdr_fill  = PatternFill(start_color='F6BE92', end_color='F6BE92', fill_type='solid')
    _hdr_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

    # Status-based fills (High=orange, Medium=dark-green, Low=grey)
    _status_fill = {
        'HIGH':   PatternFill(start_color='4997D0', end_color='4997D0', fill_type='solid'),
        'MEDIUM': PatternFill(start_color='A0DB5A', end_color='A0DB5A', fill_type='solid'),
        'LOW':    PatternFill(start_color='DBDBDB', end_color='DBDBDB', fill_type='solid'),
    }
    # Text colour per status (white on dark green, dark on the lighter colours)
    _status_txt = {'HIGH': 'FFFFFF', 'MEDIUM': '1A1A1A', 'LOW': '1A1A1A'}
    _no_status_fill = None

    _label_font = Font(bold=True, color='000000', size=10)
    _label_fill = PatternFill(start_color='808080', end_color='808080', fill_type='solid')
    _data_font  = Font(bold=True, color='000000', size=10)

    _left_align  = Alignment(horizontal='left',   vertical='center', wrap_text=True)
    _ctr_align   = Alignment(horizontal='center', vertical='center')
    _right_align = Alignment(horizontal='right',  vertical='center')

    NUM_FMT_COMMA = '#,##0.00'
    NUM_FMT_PCT   = '0.00"%"'

    headers    = [
        'የቁልፍ አፈፃፀም አመልካቾች', 'መለኪያ', f'{et_year} ዕቅድ',
        f' የ{quarter_num}ኛ ሩብ ዓመት ዒላማ', f' የQ{quarter_num}ኛ ሩብ ዓመት አፈፃፀም',
        f' የ{months}ወር ዒላማ', f' የ{months} ወር አፈፃፀም',
        f'የ{months} ወር አፈፃፀም በመቶኛ',
    ]
    col_widths = [52, 12, 15, 15, 20, 24, 24, 26]

    # Column header row
    for col, (hdr, width) in enumerate(zip(headers, col_widths), 1):
        cell = ws.cell(row=1, column=col, value=hdr)
        cell.font = _hdr_font; cell.fill = _hdr_fill
        cell.alignment = _hdr_align; cell.border = _thin_brd
        ws.column_dimensions[get_column_letter(col)].width = width
    ws.row_dimensions[1].height = 42

    # ── Row-writing helpers ───────────────────────────────────────────────────
    row_num  = 2

    def write_data_row(row_data, d_font, d_fill):
        nonlocal row_num
        for col, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col, value=val)
            cell.border = _thin_brd
            cell.font   = d_font
            if d_fill:
                cell.fill = d_fill
            if col == 1:
                cell.alignment = _left_align
            elif col == 2:
                cell.alignment = _ctr_align
            elif col == 8:
                cell.alignment = _right_align
                if val is not None:
                    cell.number_format = NUM_FMT_PCT
            else:
                cell.alignment = _right_align
                if val is not None and col > 2:
                    cell.number_format = NUM_FMT_COMMA
        ws.row_dimensions[row_num].height = 18
        row_num += 1

    def write_flat_rows(flat_rows):
        for fr in flat_rows:
            level  = fr['level']
            indent = '  ' * level
            name   = indent + fr['name']
            rs     = fr.get('row_status')  # 'HIGH' | 'MEDIUM' | 'LOW' | None

            s_fill = _status_fill.get(rs) if rs else _no_status_fill
            s_txt  = _status_txt.get(rs, '1A1A1A') if rs else '1A1A1A'

            if fr['type'] == 'group':
                if fr.get('is_label'):
                    write_data_row(
                        [name, fr.get('unit', ''), None, None, None, None, None, None],
                        _label_font, _label_fill,
                    )
                else:
                    grp_v = fr.get('grp', {})
                    write_data_row(
                        [name, fr.get('unit', ''),
                         grp_v.get('annual_target'), grp_v.get('qx_plan'),
                         grp_v.get('qx_perf'),       grp_v.get('cum_plan'),
                         grp_v.get('cum_perf'),       grp_v.get('pct')],
                        Font(bold=True, color='000000', size=10), s_fill,
                    )
            else:
                v = fr.get('vals', {})
                write_data_row(
                    [name, fr.get('unit', ''),
                     v.get('annual_target'), v.get('qx_plan'),
                     v.get('qx_perf'),       v.get('cum_plan'),
                     v.get('cum_perf'),       v.get('pct')],
                    Font(bold=True, color='000000', size=10), s_fill,
                )

    # ── Write all root groups strictly in display_order sequence ─────────────
    for grp in root_groups:
        node = build_node(grp)
        flat = []
        flatten([node], 0, flat)
        write_flat_rows(flat)

    # ── Ungrouped indicators (no sector/dept headers) ─────────────────────────
    ungrouped_inds = list(
        Indicator.objects
        .filter(groups__isnull=True)
        .order_by(_F('display_order').asc(nulls_last=True), 'name')
    )
    for ind in ungrouped_inds:
        v = ind_vals(ind)
        write_data_row(
            [ind.name, v['unit'],
             v.get('annual_target'), v.get('qx_plan'),
             v.get('qx_perf'),       v.get('cum_plan'),
             v.get('cum_perf'),       v.get('pct')],
            _data_font, _no_status_fill,
        )

    # Freeze header row
    ws.freeze_panes = ws['A2']

    # ── Stream response ───────────────────────────────────────────────────────
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"MOA_Q{quarter_num}_{months}Month_Report_{year}.xlsx"
    response = HttpResponse(
        buf.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
