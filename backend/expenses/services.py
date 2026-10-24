from django.db import transaction

from .models import AuditEvent, Expense


def expenses_visible_to(user):
    queryset = Expense.objects.select_related('employee', 'category')

    if user.role == 'ADMIN':
        return queryset
    if user.role == 'MANAGER':
        return queryset.filter(employee__manager=user) | queryset.filter(employee=user)
    return queryset.filter(employee=user)


@transaction.atomic
def create_expense(*, employee, category, validated_data):
    expense = Expense.objects.create(
        employee=employee,
        category=category,
        status=Expense.Status.PENDING,
        **validated_data,
    )
    AuditEvent.objects.create(
        actor=employee,
        expense=expense,
        action='EXPENSE_CREATED',
        details={'status': expense.status},
    )
    return expense
