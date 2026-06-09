"""
Utility functions for aggregating indicator data with proper NULL handling.
This module provides clean, scalable aggregation logic that respects quarter applicability
and avoids N+1 query issues.
"""

from django.db.models import Sum, Q, Case, When, Value, IntegerField, F, Count, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal
from typing import Dict, List, Optional, Any


class QuarterAggregationMixin:
    """
    Mixin providing methods for quarter-aware aggregation.
    This handles NULL vs 0 properly and respects quarter applicability.
    """
    
    @staticmethod
    def get_quarter_condition(quarter: int) -> Q:
        """Get Q object for filtering by quarter applicability"""
        return Q(
            indicator__applicable_quarters__contains=quarter
        ) | Q(indicator__applicable_quarters=[])
    
    @staticmethod
    def get_quarter_sum_with_null_handling(queryset, quarter_field: str) -> Dict[str, Any]:
        """
        Get sum for a quarter field, preserving NULL for non-applicable quarters.
        
        Args:
            queryset: Base queryset to aggregate
            quarter_field: Field name (e.g., 'q1', 'q2', 'q3', 'q4')
            
        Returns:
            Dict with sum and count of applicable indicators
        """
        # Get applicable indicators for each quarter
        quarter_num = int(quarter_field[1])  # Extract number from 'q1', 'q2', etc.
        
        # Separate applicable and non-applicable indicators
        applicable_qs = queryset.filter(
            QuarterAggregationMixin.get_quarter_condition(quarter_num)
        )
        
        # Sum only applicable indicators, treating NULL as 0 for calculation
        # but keeping track of whether any values exist
        result = applicable_qs.aggregate(
            total=Sum(Coalesce(quarter_field, Value(0))),
            has_values=Count('id', filter=Q(**{f"{quarter_field}__isnull": False}))
        )
        
        return {
            'sum': result['total'] or Decimal('0'),
            'has_data': result['has_values'] > 0,
            'is_applicable': applicable_qs.exists()
        }


def get_group_quarterly_breakdown_aggregate(group, year: int) -> Dict[str, Optional[Decimal]]:
    """
    Calculate aggregate quarterly breakdown for a group, respecting quarter applicability.
    This is an optimized version that avoids N+1 queries.
    
    Args:
        group: IndicatorGroup instance
        year: Year to aggregate for
        
    Returns:
        Dict with quarterly values (None for non-applicable quarters)
    """
    from plans.models import AnnualPlan, QuarterlyBreakdown
    
    # Get all direct child indicators that are aggregatable
    direct_indicators = group.indicators.filter(is_aggregatable=True)
    
    # Get all child groups for recursive aggregation (only non-label groups)
    child_groups = group.children.filter(is_label=False)
    
    # Start with empty result
    result = {'q1': None, 'q2': None, 'q3': None, 'q4': None}
    
    # Process direct indicators
    if direct_indicators.exists():
        # Get all quarterly breakdowns for direct indicators in one query
        breakdowns = QuarterlyBreakdown.objects.filter(
            plan__indicator__in=direct_indicators,
            plan__year=year
        ).select_related('plan__indicator')
        
        # Group by quarter applicability and calculate sums
        for quarter_num in range(1, 5):
            quarter_field = f'q{quarter_num}'
            
            # Filter breakdowns by quarter applicability
            applicable_breakdowns = [
                bd for bd in breakdowns 
                if bd.plan.indicator.is_quarter_applicable(quarter_num)
            ]
            
            if applicable_breakdowns:
                # Sum values, treating NULL as 0 for applicable quarters
                quarter_sum = sum(
                    getattr(bd, quarter_field) or Decimal('0') 
                    for bd in applicable_breakdowns
                )
                result[quarter_field] = quarter_sum
            else:
                result[quarter_field] = None
    
    # Process child groups recursively (but optimize to avoid N+1)
    if child_groups.exists():
        # Collect all child group data in bulk
        child_breakdowns = {}
        for child_group in child_groups:
            child_result = get_group_quarterly_breakdown_aggregate(child_group, year)
            child_breakdowns[child_group.id] = child_result
        
        # Aggregate child results
        for quarter_num in range(1, 5):
            quarter_field = f'q{quarter_num}'
            child_sum = Decimal('0')
            has_applicable_children = False
            
            for child_result in child_breakdowns.values():
                if child_result[quarter_field] is not None:
                    child_sum += child_result[quarter_field]
                    has_applicable_children = True
            
            if has_applicable_children:
                # Combine direct indicators with child aggregates
                if result[quarter_field] is not None:
                    result[quarter_field] += child_sum
                else:
                    result[quarter_field] = child_sum
    
    return result


def get_group_performance_aggregate(group, year: int, quarter: int) -> Optional[Decimal]:
    """
    Calculate aggregate performance for a group, respecting quarter applicability.
    
    Args:
        group: IndicatorGroup instance
        year: Year to aggregate for
        quarter: Quarter to aggregate for
        
    Returns:
        Decimal sum or None if quarter not applicable for any indicators
    """
    from plans.models import AnnualPlan, QuarterlyPerformance
    
    # Get all direct child indicators that are aggregatable
    direct_indicators = group.indicators.filter(is_aggregatable=True)
    
    # Filter indicators where this quarter is applicable
    applicable_indicators = [
        ind for ind in direct_indicators 
        if ind.is_quarter_applicable(quarter)
    ]
    
    if not applicable_indicators:
        # Check child groups (only non-label groups)
        child_groups = group.children.filter(is_label=False)
        child_sum = Decimal('0')
        has_applicable_children = False
        
        for child_group in child_groups:
            child_result = get_group_performance_aggregate(child_group, year, quarter)
            if child_result is not None:
                child_sum += child_result
                has_applicable_children = True
        
        return child_sum if has_applicable_children else None
    
    # Get performance data for applicable indicators
    total = QuarterlyPerformance.objects.filter(
        plan__indicator__in=applicable_indicators,
        plan__year=year,
        quarter=quarter
    ).aggregate(
        total=Sum(Coalesce('value', Value(Decimal('0')), output_field=DecimalField()))
    )['total'] or Decimal('0')
    
    # Add child group aggregates (only from non-label groups)
    child_groups = group.children.filter(is_label=False)
    for child_group in child_groups:
        child_result = get_group_performance_aggregate(child_group, year, quarter)
        if child_result is not None:
            total += child_result
    
    return total


def get_group_quarterly_target_aggregate(group, year: int, quarter_months: int = None) -> Dict[str, Optional[Decimal]]:
    """
    Calculate aggregate quarterly targets for a group for specified months.
    
    Args:
        group: IndicatorGroup instance
        year: Year to aggregate for
        quarter_months: Number of months (3, 6, 9, or None for all)
        
    Returns:
        Dict with quarterly target values for specified period
    """
    from plans.models import AnnualPlan, QuarterlyBreakdown
    
    # Get all direct child indicators that are aggregatable
    direct_indicators = group.indicators.filter(is_aggregatable=True)
    
    # Get all child groups for recursive aggregation (only non-label groups)
    child_groups = group.children.filter(is_label=False)
    
    # Start with empty result
    result = {'q1': None, 'q2': None, 'q3': None, 'q4': None}
    
    # Process direct indicators
    if direct_indicators.exists():
        # Get all quarterly breakdowns for direct indicators in one query
        breakdowns = QuarterlyBreakdown.objects.filter(
            plan__indicator__in=direct_indicators,
            plan__year=year
        ).select_related('plan__indicator')
        
        # Group by quarter applicability and calculate sums
        for quarter_num in range(1, 5):
            quarter_field = f'q{quarter_num}'
            
            # Filter breakdowns by quarter applicability
            applicable_breakdowns = [
                bd for bd in breakdowns 
                if bd.plan.indicator.is_quarter_applicable(quarter_num)
            ]
            
            if applicable_breakdowns:
                # Sum values, treating NULL as 0 for applicable quarters
                quarter_sum = sum(
                    getattr(bd, quarter_field) or Decimal('0') 
                    for bd in applicable_breakdowns
                )
                result[quarter_field] = quarter_sum
            else:
                result[quarter_field] = None
    
    # Process child groups recursively
    if child_groups.exists():
        for child_group in child_groups:
            child_result = get_group_quarterly_target_aggregate(child_group, year)
            
            for quarter_num in range(1, 5):
                quarter_field = f'q{quarter_num}'
                if child_result[quarter_field] is not None:
                    if result[quarter_field] is None:
                        result[quarter_field] = Decimal('0')
                    result[quarter_field] += child_result[quarter_field]
    
    # If quarter_months is specified, calculate total for that period
    if quarter_months:
        total_target = Decimal('0')
        if quarter_months >= 3 and result['q1'] is not None:
            total_target += result['q1']
        if quarter_months >= 6 and result['q2'] is not None:
            total_target += result['q2']
        if quarter_months >= 9 and result['q3'] is not None:
            total_target += result['q3']
        if quarter_months >= 12 and result['q4'] is not None:
            total_target += result['q4']
        
        return {'period_target': total_target}
    
    return result


def get_group_performance_for_period(group, year: int, quarter_months: int = None) -> Optional[Decimal]:
    """
    Calculate aggregate performance for a group for specified months.
    
    Args:
        group: IndicatorGroup instance
        year: Year to aggregate for
        quarter_months: Number of months (3, 6, 9, or None for all)
        
    Returns:
        Decimal sum or None if no applicable data
    """
    from plans.models import AnnualPlan, QuarterlyPerformance
    
    # Get all direct child indicators that are aggregatable
    direct_indicators = group.indicators.filter(is_aggregatable=True)
    
    # Determine which quarters to include
    quarters_to_include = [1, 2, 3, 4]
    if quarter_months:
        quarter_months_map = {1: 3, 2: 6, 3: 9, 4: 12}
        quarters_to_include = [
            q for q in [1, 2, 3, 4] 
            if quarter_months_map[q] <= quarter_months
        ]
    
    total = Decimal('0')
    has_data = False

    # Separate incremental and non-incremental indicators
    incremental_indicators = [ind for ind in direct_indicators if ind.is_incremental]
    non_incremental_indicators = [ind for ind in direct_indicators if not ind.is_incremental]

    # For incremental indicators: use the last non-null quarter value within the period
    if incremental_indicators:
        perfs = (
            QuarterlyPerformance.objects
            .filter(
                plan__indicator__in=incremental_indicators,
                plan__year=year,
                quarter__in=quarters_to_include,
            )
            .select_related('plan__indicator')
            .order_by('quarter')
        )
        # Keep the highest-quarter non-null value per indicator
        last_val = {}
        for perf in perfs:
            if perf.value is not None:
                last_val[perf.plan.indicator_id] = perf.value
        for val in last_val.values():
            total += val
            has_data = True

    # For non-incremental indicators: sum all applicable quarters in the period
    for quarter in quarters_to_include:
        applicable_indicators = [
            ind for ind in non_incremental_indicators
            if ind.is_quarter_applicable(quarter)
        ]
        if applicable_indicators:
            quarter_total = QuarterlyPerformance.objects.filter(
                plan__indicator__in=applicable_indicators,
                plan__year=year,
                quarter=quarter
            ).aggregate(
                total=Sum(Coalesce('value', Value(Decimal('0')), output_field=DecimalField()))
            )['total'] or Decimal('0')
            total += quarter_total
            has_data = True
    
    # Add child group aggregates (only from non-label groups)
    child_groups = group.children.filter(is_label=False)
    for child_group in child_groups:
        child_result = get_group_performance_for_period(child_group, year, quarter_months)
        if child_result is not None:
            total += child_result
            has_data = True
    
    return total if has_data else None


def get_bulk_quarterly_aggregates(groups: List, year: int) -> Dict[int, Dict[str, Optional[Decimal]]]:
    """
    Get quarterly aggregates for multiple groups in bulk to avoid N+1 queries.
    
    Args:
        groups: List of IndicatorGroup instances
        year: Year to aggregate for
        
    Returns:
        Dict mapping group_id to quarterly breakdown dict
    """
    from plans.models import AnnualPlan, QuarterlyBreakdown
    
    # Collect all indicators from all groups
    all_indicator_ids = set()
    group_indicator_map = {}
    
    for group in groups:
        direct_indicators = group.indicators.filter(is_aggregatable=True)
        indicator_ids = list(direct_indicators.values_list('id', flat=True))
        all_indicator_ids.update(indicator_ids)
        group_indicator_map[group.id] = indicator_ids
    
    if not all_indicator_ids:
        return {group.id: {'q1': None, 'q2': None, 'q3': None, 'q4': None} for group in groups}
    
    # Get all breakdowns in one query
    breakdowns = QuarterlyBreakdown.objects.filter(
        plan__indicator__in=all_indicator_ids,
        plan__year=year
    ).select_related('plan__indicator')
    
    # Group breakdowns by indicator
    indicator_breakdowns = {}
    for bd in breakdowns:
        indicator_id = bd.plan.indicator_id
        if indicator_id not in indicator_breakdowns:
            indicator_breakdowns[indicator_id] = bd
        else:
            # Handle multiple breakdowns per indicator (shouldn't happen with OneToOne)
            pass
    
    # Calculate aggregates for each group
    results = {}
    for group in groups:
        result = {'q1': None, 'q2': None, 'q3': None, 'q4': None}
        
        for indicator_id in group_indicator_map[group.id]:
            if indicator_id in indicator_breakdowns:
                bd = indicator_breakdowns[indicator_id]
                indicator = bd.plan.indicator
                
                for quarter_num in range(1, 5):
                    quarter_field = f'q{quarter_num}'
                    if indicator.is_quarter_applicable(quarter_num):
                        value = getattr(bd, quarter_field)
                        if value is not None:
                            if result[quarter_field] is None:
                                result[quarter_field] = Decimal('0')
                            result[quarter_field] += value
        
        results[group.id] = result
    
    return results
