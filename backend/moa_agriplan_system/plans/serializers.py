from rest_framework import serializers
from .models import AnnualPlan, QuarterlyBreakdown, QuarterlyPerformance, FileAttachment, SubmissionWindow, AdvisorComment, Document
from indicators.serializers import IndicatorGroupSerializer


class NullableDecimalField(serializers.DecimalField):
    """Custom DecimalField that converts empty strings and 'N/A' to None, but preserves 0"""
    
    def to_internal_value(self, data):
        if data == '' or data is None or data == 'N/A':
            return None
        # Explicitly handle 0 to ensure it's preserved as 0, not converted to None
        if data == 0 or data == '0' or data == '0.00':
            return 0
        return super().to_internal_value(data)


class AnnualPlanSerializer(serializers.ModelSerializer):
    indicator_name = serializers.CharField(source='indicator.name', read_only=True)
    indicator_name_with_group = serializers.SerializerMethodField()
    department_id = serializers.IntegerField(source='indicator.department.id', read_only=True)
    department_name = serializers.CharField(source='indicator.department.name', read_only=True)
    sector_id = serializers.IntegerField(source='indicator.department.sector.id', read_only=True)
    sector_name = serializers.CharField(source='indicator.department.sector.name', read_only=True)
    indicator_unit = serializers.CharField(source='indicator.unit', read_only=True)
    indicator_group = serializers.SerializerMethodField()
    indicator_group_name = serializers.SerializerMethodField()
    indicator_is_aggregatable = serializers.BooleanField(source='indicator.is_aggregatable', read_only=True)
    indicator_is_incremental = serializers.BooleanField(source='indicator.is_incremental', read_only=True)

    class Meta:
        model = AnnualPlan
        fields = [
            'id', 'year', 'indicator', 'indicator_name', 'indicator_name_with_group', 'indicator_unit',
            'indicator_group', 'indicator_group_name', 'indicator_is_aggregatable', 'indicator_is_incremental',
            'department_id', 'department_name', 'sector_id', 'sector_name',
            'target', 'created_by', 'created_at'
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_indicator_group(self, obj):
        group = obj.indicator.groups.first()
        return IndicatorGroupSerializer(group).data if group else None

    def get_indicator_group_name(self, obj):
        group = obj.indicator.groups.first()
        return group.name if group else None

    def get_indicator_name_with_group(self, obj):
        """Return indicator name combined with group name for easy identification"""
        group = obj.indicator.groups.first()
        if group:
            return f"{obj.indicator.name} ({group.name})"
        return obj.indicator.name


class QuarterlyBreakdownSerializer(serializers.ModelSerializer):
    indicator_name = serializers.CharField(source='plan.indicator.name', read_only=True)
    indicator_name_with_group = serializers.SerializerMethodField()
    total = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    quarter_applicability = serializers.SerializerMethodField()
    quarter_values = serializers.SerializerMethodField()
    quarter_values_display = serializers.SerializerMethodField()
    indicator_group = serializers.SerializerMethodField()
    
    # Use custom nullable decimal fields
    q1 = NullableDecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True)
    q2 = NullableDecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True)
    q3 = NullableDecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True)
    q4 = NullableDecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = QuarterlyBreakdown
        fields = [
            'id', 'plan', 'indicator_name', 'indicator_name_with_group', 'q1', 'q2', 'q3', 'q4', 'total', 'status',
            'submitted_by', 'submitted_at', 'reviewed_by', 'review_comment', 'reviewed_at',
            'validated_by', 'validated_at', 'final_approved_by', 'final_approved_at',
            'quarter_applicability', 'quarter_values', 'quarter_values_display',
            'indicator_group'
        ]
        read_only_fields = [
            'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at',
            'validated_by', 'validated_at', 'final_approved_by', 'final_approved_at', 
            'total', 'quarter_applicability', 'quarter_values', 'quarter_values_display'
        ]

    def get_quarter_applicability(self, obj):
        """Return which quarters are applicable for this indicator"""
        indicator = obj.plan.indicator
        return {
            'q1': indicator.is_quarter_applicable(1),
            'q2': indicator.is_quarter_applicable(2),
            'q3': indicator.is_quarter_applicable(3),
            'q4': indicator.is_quarter_applicable(4),
        }

    def get_quarter_values_display(self, obj):
        """Return quarter values formatted for display with N/A vs 0 distinction"""
        indicator = obj.plan.indicator
        result = {}
        for quarter, value in [(1, obj.q1), (2, obj.q2), (3, obj.q3), (4, obj.q4)]:
            if not indicator.is_quarter_applicable(quarter):
                result[f'q{quarter}'] = 'N/A'
            elif value is None:
                result[f'q{quarter}'] = 'N/A'
            elif value == 0:
                result[f'q{quarter}'] = '0.00'
            else:
                result[f'q{quarter}'] = f"{value:.2f}"
        return result

    def get_quarter_values(self, obj):
        """Return quarter values with NULL for non-applicable quarters"""
        indicator = obj.plan.indicator
        return {
            'q1': obj.get_quarter_value(1) if indicator.is_quarter_applicable(1) else None,
            'q2': obj.get_quarter_value(2) if indicator.is_quarter_applicable(2) else None,
            'q3': obj.get_quarter_value(3) if indicator.is_quarter_applicable(3) else None,
            'q4': obj.get_quarter_value(4) if indicator.is_quarter_applicable(4) else None,
        }

    def get_indicator_group(self, obj):
        group = obj.plan.indicator.groups.first()
        return IndicatorGroupSerializer(group).data if group else None

    def get_indicator_name_with_group(self, obj):
        """Return indicator name combined with group name for easy identification"""
        group = obj.plan.indicator.groups.first()
        if group:
            return f"{obj.plan.indicator.name} ({group.name})"
        return obj.plan.indicator.name

    # Do not enforce sum==target here; this will be checked during submit action
    # to allow drafting partial quarterly values.
    def validate(self, attrs):
        # Convert empty strings to None for quarterly fields
        for quarter_field in ['q1', 'q2', 'q3', 'q4']:
            if quarter_field in attrs:
                value = attrs[quarter_field]
                if value == '' or value is None:
                    attrs[quarter_field] = None
                elif value == 0:
                    # Keep 0 as 0 (explicit zero value)
                    attrs[quarter_field] = 0
        return attrs

    def validate_q1(self, value):
        """Validate Q1 field - convert empty to None"""
        if value == '' or value is None:
            return None
        return value

    def validate_q2(self, value):
        """Validate Q2 field - convert empty to None"""
        if value == '' or value is None:
            return None
        return value

    def validate_q3(self, value):
        """Validate Q3 field - convert empty to None"""
        if value == '' or value is None:
            return None
        return value

    def validate_q4(self, value):
        """Validate Q4 field - convert empty to None"""
        if value == '' or value is None:
            return None
        return value


class QuarterlyPerformanceSerializer(serializers.ModelSerializer):
    indicator_name = serializers.CharField(source='plan.indicator.name', read_only=True)
    indicator_name_with_group = serializers.SerializerMethodField()
    value = NullableDecimalField(max_digits=20, decimal_places=2, required=False, allow_null=True)
    value_display = serializers.SerializerMethodField()
    indicator_group = serializers.SerializerMethodField()
    
    class Meta:
        model = QuarterlyPerformance
        fields = [
            'id', 'plan', 'quarter', 'indicator_name', 'indicator_name_with_group', 'value', 'value_display', 'status', 'variance_description',
            'submitted_by', 'submitted_at', 'reviewed_by', 'review_comment', 'reviewed_at',
            'validated_by', 'validated_at', 'final_approved_by', 'final_approved_at',
            'indicator_group'
        ]
        read_only_fields = [
            'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at',
            'validated_by', 'validated_at', 'final_approved_by', 'final_approved_at'
        ]
    
    def get_value_display(self, obj):
        if obj.value is None:
            return 'N/A'
        # Format 0 as '0.00' for consistency
        if obj.value == 0:
            return '0.00'
        return f"{obj.value:.2f}"

    def get_indicator_group(self, obj):
        group = obj.plan.indicator.groups.first()
        return IndicatorGroupSerializer(group).data if group else None

    def get_indicator_name_with_group(self, obj):
        """Return indicator name combined with group name for easy identification"""
        group = obj.plan.indicator.groups.first()
        if group:
            return f"{obj.plan.indicator.name} ({group.name})"
        return obj.plan.indicator.name


class FileAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileAttachment
        fields = ['id', 'uploaded_by', 'uploaded_at', 'file', 'annual_plan', 'performance', 'description']
        read_only_fields = ['uploaded_by', 'uploaded_at']


class SubmissionWindowSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionWindow
        fields = [
            'id', 'window_type', 'year', 'always_open', 'start', 'end', 'active'
        ]


class AdvisorCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = AdvisorComment
        fields = [
            'id', 'author', 'author_username', 'year', 'sector', 'department', 'comment', 'created_at'
        ]
        read_only_fields = ['author', 'created_at']


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    sector_name = serializers.CharField(source='sector.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    quarter_display = serializers.CharField(source='get_quarter_display', read_only=True)
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'name', 'description', 'document_type', 'document_type_display',
            'sector', 'sector_name', 'department', 'department_name',
            'year', 'quarter', 'quarter_display',
            'file', 'file_url', 'file_name', 'uploaded_by', 'uploaded_by_username', 'uploaded_at'
        ]
        read_only_fields = ['uploaded_by', 'uploaded_at', 'sector', 'department']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def validate_file(self, value):
        import os
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in ['.doc', '.docx']:
            raise serializers.ValidationError('Only Word documents (.doc, .docx) are allowed.')
        return value

    def get_file_name(self, obj):
        if obj.file:
            import os
            return os.path.basename(obj.file.name)
        return None
