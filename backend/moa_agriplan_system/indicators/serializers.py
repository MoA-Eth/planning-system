from rest_framework import serializers
from .models import StateMinisterSector, Department, Indicator, IndicatorGroup


class StateMinisterSectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = StateMinisterSector
        fields = ['id', 'name']


class DepartmentSerializer(serializers.ModelSerializer):
    sector = StateMinisterSectorSerializer(read_only=True)
    sector_id = serializers.PrimaryKeyRelatedField(
        queryset=StateMinisterSector.objects.all(), source='sector', write_only=True
    )

    class Meta:
        model = Department
        fields = ['id', 'name', 'sector', 'sector_id']


class IndicatorGroupSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), source='department', write_only=True, required=False, allow_null=True
    )
    sector = StateMinisterSectorSerializer(read_only=True)
    sector_id = serializers.PrimaryKeyRelatedField(
        queryset=StateMinisterSector.objects.all(), source='sector', write_only=True, required=False, allow_null=True
    )
    parent = serializers.SerializerMethodField()
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=IndicatorGroup.objects.all(), source='parent', write_only=True, required=False, allow_null=True
    )
    children = serializers.SerializerMethodField()
    level = serializers.SerializerMethodField()
    hierarchy_path = serializers.SerializerMethodField()
    is_parent = serializers.SerializerMethodField()
    inherited_unit = serializers.SerializerMethodField()
    annual_target_aggregate = serializers.SerializerMethodField()
    quarterly_breakdown_aggregate = serializers.SerializerMethodField()
    performance_aggregate = serializers.SerializerMethodField()

    class Meta:
        model = IndicatorGroup
        fields = [
            'id', 'name', 'department', 'department_id', 'sector', 'sector_id',
            'parent', 'parent_id', 'unit', 'is_label', 'display_order', 'status',
            'children', 'level', 'hierarchy_path', 
            'is_parent', 'inherited_unit', 'annual_target_aggregate', 
            'quarterly_breakdown_aggregate', 'performance_aggregate'
        ]

    def validate(self, data):
        """Ensure that either department or sector is provided, but not both"""
        department = data.get('department')
        sector = data.get('sector')
        
        if not department and not sector:
            raise serializers.ValidationError(
                "Either department or sector must be specified."
            )
        
        if department and sector:
            raise serializers.ValidationError(
                "Cannot specify both department and sector. Choose one."
            )
        
        return data

    def get_parent(self, obj):
        if obj.parent:
            return {
                'id': obj.parent.id,
                'name': obj.parent.name
            }
        return None

    def get_children(self, obj):
        return [
            {
                'id': child.id,
                'name': child.name,
                'level': child.level
            }
            for child in obj.children.all()
        ]

    def get_level(self, obj):
        return obj.level

    def get_hierarchy_path(self, obj):
        return obj.hierarchy_path

    def get_is_parent(self, obj):
        return obj.is_parent

    def get_inherited_unit(self, obj):
        return obj.get_inherited_unit()

    def get_annual_target_aggregate(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'query_params') and request.query_params.get('include_aggregates'):
            year = request.query_params.get('year')
            if year:
                return obj.get_annual_target_aggregate(int(year))
        return None

    def get_quarterly_breakdown_aggregate(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'query_params') and request.query_params.get('include_aggregates'):
            year = request.query_params.get('year')
            if year:
                return obj.get_quarterly_breakdown_aggregate(int(year))
        return None

    def get_performance_aggregate(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'query_params') and request.query_params.get('include_aggregates'):
            year = request.query_params.get('year')
            quarter = request.query_params.get('quarter')
            if year and quarter:
                return obj.get_performance_aggregate(int(year), int(quarter))
        return None


class IndicatorSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), source='department', write_only=True
    )
    groups = IndicatorGroupSerializer(many=True, read_only=True)
    group_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=IndicatorGroup.objects.all(),
        source='groups',
        write_only=True,
        required=False,
        allow_null=True
    )
    effective_unit = serializers.ReadOnlyField()
    hierarchy_context = serializers.SerializerMethodField()
    applicable_quarters = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=4),
        required=False,
        allow_empty=True
    )

    class Meta:
        model = Indicator
        fields = [
            'id', 'name', 'unit', 'description', 'department', 'department_id', 
            'groups', 'group_ids', 'is_aggregatable', 'is_incremental', 'effective_unit', 'hierarchy_context',
            'applicable_quarters', 'baseline', 'display_order'
        ]

    def get_hierarchy_context(self, obj):
        return obj.get_hierarchy_context()
