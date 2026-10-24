from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from .models import AuditEvent, Expense, ExpenseDecision


class DecisionConflict(Exception):
    """Raised when an expense is no longer pending."""


def expenses_visible_to(user):
    queryset = Expense.objects.select_related('employee', 'category').prefetch_related(
        'decisions__manager',
    )

    if user.role == 'ADMIN':
        return queryset
    if user.role == 'MANAGER':
        return queryset.filter(employee__manager=user) | queryset.filter(employee=user)
    return queryset.filter(employee=user)


def dashboard_expenses_for(user, dashboard):
    if dashboard == 'employee':
        return Expense.objects.filter(employee=user)
    if user.role == 'ADMIN':
        return Expense.objects.all()
    return Expense.objects.filter(employee__manager=user)


def expense_dashboard_summary(queryset):
    aggregates = queryset.aggregate(
        total_amount=Sum('amount'),
        approved_amount=Sum(
            'amount',
            filter=Q(status=Expense.Status.APPROVED),
        ),
        total_count=Count('id'),
        pending_count=Count('id', filter=Q(status=Expense.Status.PENDING)),
        approved_count=Count('id', filter=Q(status=Expense.Status.APPROVED)),
        rejected_count=Count('id', filter=Q(status=Expense.Status.REJECTED)),
    )
    return {
        'total_expenses': aggregates['total_count'],
        'pending_count': aggregates['pending_count'],
        'approved_count': aggregates['approved_count'],
        'rejected_count': aggregates['rejected_count'],
        'total_amount_submitted': f"{aggregates['total_amount'] or 0:.2f}",
        'total_amount_approved': f"{aggregates['approved_amount'] or 0:.2f}",
    }


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


def decision_visible_expenses(user):
    queryset = Expense.objects.select_related('employee', 'category').prefetch_related(
        'decisions__manager',
    )
    if user.role == 'ADMIN':
        return queryset
    if user.role == 'MANAGER':
        return queryset.filter(employee__manager=user)
    return queryset.none()


def pending_expenses_for_decision(user):
    return decision_visible_expenses(user).filter(
        status=Expense.Status.PENDING,
    )


def _ensure_can_decide(*, expense, manager):
    if manager.role == 'ADMIN':
        return
    if (
        manager.role != 'MANAGER'
        or expense.employee_id == manager.id
        or expense.employee.manager_id != manager.id
    ):
        raise PermissionDenied('You are not authorized to decide this expense.')


@transaction.atomic
def decide_expense(*, expense_id, manager, decision, comment=''):
    # SQLite does not provide row-level locks for select_for_update. This
    # conditional update re-checks authorization and status atomically for
    # the database's supported write behavior.
    if manager.role == 'ADMIN':
        pending_expense = Expense.objects.filter(
            pk=expense_id,
            status=Expense.Status.PENDING,
        )
    elif manager.role == 'MANAGER':
        pending_expense = Expense.objects.filter(
            pk=expense_id,
            status=Expense.Status.PENDING,
            employee__manager=manager,
        ).exclude(employee_id=manager.id)
    else:
        raise PermissionDenied('You are not authorized to decide expenses.')

    updated = pending_expense.update(status=decision)
    if updated != 1:
        expense = Expense.objects.select_related('employee').get(pk=expense_id)
        _ensure_can_decide(expense=expense, manager=manager)
        raise DecisionConflict('Only pending expenses can be decided.')

    expense = Expense.objects.select_related('employee').get(pk=expense_id)

    decided_at = timezone.now()
    ExpenseDecision.objects.create(
        expense=expense,
        manager=manager,
        decision=decision,
        comment=comment,
        decided_at=decided_at,
    )
    action = (
        'EXPENSE_APPROVED'
        if decision == ExpenseDecision.Decision.APPROVED
        else 'EXPENSE_REJECTED'
    )
    AuditEvent.objects.create(
        actor=manager,
        expense=expense,
        action=action,
        details={
            'decision': decision,
            'comment': comment,
        },
    )
    expense.status = decision
    return expense


def approve_expense(*, expense_id, manager, comment=''):
    return decide_expense(
        expense_id=expense_id,
        manager=manager,
        decision=ExpenseDecision.Decision.APPROVED,
        comment=comment,
    )


def reject_expense(*, expense_id, manager, comment):
    return decide_expense(
        expense_id=expense_id,
        manager=manager,
        decision=ExpenseDecision.Decision.REJECTED,
        comment=comment,
    )
