from decimal import Decimal

from rest_framework import serializers

from .models import Expense, ExpenseCategory


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ('id', 'name', 'description')


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
