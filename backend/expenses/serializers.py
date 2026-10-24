from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from rest_framework import serializers

from .models import Expense, ExpenseCategory, ExpenseDecision

MAX_RECEIPT_SIZE = 5 * 1024 * 1024
RECEIPT_SIGNATURES = {
    '.pdf': (b'%PDF-',),
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.png': (b'\x89PNG\r\n\x1a\n',),
}


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ('id', 'name', 'description')


class ExpenseDecisionSerializer(serializers.ModelSerializer):
    manager = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ExpenseDecision
        fields = ('id', 'manager', 'decision', 'comment', 'decided_at')
        read_only_fields = fields


class DashboardSerializer(serializers.Serializer):
    total_expenses = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    approved_count = serializers.IntegerField()
    rejected_count = serializers.IntegerField()
    total_amount_submitted = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_amount_approved = serializers.DecimalField(max_digits=14, decimal_places=2)


class ExpenseSerializer(serializers.ModelSerializer):
    employee = serializers.StringRelatedField(read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=ExpenseCategory.objects.filter(is_active=True),
    )
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    decisions = ExpenseDecisionSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = (
            'id',
            'employee',
            'category',
            'title',
            'amount',
            'currency',
            'expense_date',
            'description',
            'status',
            'receipt',
            'decisions',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'employee', 'status', 'created_at', 'updated_at')

    def validate(self, attrs):
        protected_fields = {
            'employee',
            'status',
            'actor',
            'audit',
            'audit_event',
            'decided_at',
            'decision',
        }
        supplied_protected_fields = protected_fields.intersection(self.initial_data)
        if supplied_protected_fields:
            field = sorted(supplied_protected_fields)[0]
            raise serializers.ValidationError(
                {field: 'This field cannot be set when creating an expense.'}
            )
        return attrs

    def validate_receipt(self, receipt):
        if receipt.size > MAX_RECEIPT_SIZE:
            raise serializers.ValidationError('Receipt must not exceed 5 MB.')

        suffix = Path(receipt.name or '').suffix.lower()
        signatures = RECEIPT_SIGNATURES.get(suffix)
        if not signatures:
            raise serializers.ValidationError(
                'Receipt format must be PDF, JPEG, or PNG.'
            )

        initial_bytes = receipt.read(16)
        receipt.seek(0)
        if not any(initial_bytes.startswith(signature) for signature in signatures):
            raise serializers.ValidationError(
                'Receipt content does not match an allowed format.'
            )

        receipt.name = f'{uuid4().hex}{suffix}'
        return receipt


class ApprovalSerializer(serializers.Serializer):
    comment = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )


class RejectionSerializer(serializers.Serializer):
    comment = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_comment(self, value):
        if not value:
            raise serializers.ValidationError('A rejection reason is required.')
        return value
