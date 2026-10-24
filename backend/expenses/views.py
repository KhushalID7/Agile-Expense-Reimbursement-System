from datetime import date
from decimal import Decimal, InvalidOperation
from mimetypes import guess_type

from django.http import FileResponse
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Expense, ExpenseCategory
from .permissions import (
    CanCreateExpense,
    CanMakeExpenseDecision,
    IsEmployeeRole,
    IsManagerOrAdminRole,
)
from .serializers import (
    ApprovalSerializer,
    DashboardSerializer,
    ExpenseCategorySerializer,
    ExpenseSerializer,
    RejectionSerializer,
)
from .services import (
    DecisionConflict,
    approve_expense,
    create_expense,
    decision_visible_expenses,
    dashboard_expenses_for,
    expense_dashboard_summary,
    expenses_visible_to,
    pending_expenses_for_decision,
    reject_expense,
)


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        queryset = expenses_visible_to(self.request.user)
        params = self.request.query_params

        status_value = params.get('status')
        if status_value:
            if status_value not in Expense.Status.values:
                raise ValidationError({'status': 'Unsupported expense status.'})
            queryset = queryset.filter(status=status_value)

        category_value = params.get('category')
        if category_value:
            try:
                category_id = int(category_value)
            except (TypeError, ValueError):
                raise ValidationError({'category': 'Category must be an integer ID.'})
            if category_id < 1:
                raise ValidationError({'category': 'Category must be a positive ID.'})
            queryset = queryset.filter(category_id=category_id)

        date_from = self._parse_date(params.get('date_from'), 'date_from')
        date_to = self._parse_date(params.get('date_to'), 'date_to')
        if date_from and date_to and date_from > date_to:
            raise ValidationError({'date_range': 'date_from cannot be after date_to.'})
        if date_from:
            queryset = queryset.filter(expense_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(expense_date__lte=date_to)

        min_amount = self._parse_amount(params.get('min_amount'), 'min_amount')
        max_amount = self._parse_amount(params.get('max_amount'), 'max_amount')
        if min_amount is not None and max_amount is not None and min_amount > max_amount:
            raise ValidationError({'amount_range': 'min_amount cannot exceed max_amount.'})
        if min_amount is not None:
            queryset = queryset.filter(amount__gte=min_amount)
        if max_amount is not None:
            queryset = queryset.filter(amount__lte=max_amount)
        return queryset

    @staticmethod
    def _parse_date(value, field):
        if not value:
            return None
        try:
            return date.fromisoformat(value)
        except (TypeError, ValueError):
            raise ValidationError({field: 'Use the YYYY-MM-DD date format.'})

    @staticmethod
    def _parse_amount(value, field):
        if not value:
            return None
        try:
            amount = Decimal(value)
        except (InvalidOperation, TypeError, ValueError):
            raise ValidationError({field: 'Amount must be a valid decimal.'})
        if not amount.is_finite() or amount < 0:
            raise ValidationError({field: 'Amount must be zero or greater.'})
        return amount

    def get_permissions(self):
        permissions = super().get_permissions()
        if self.request.method == 'POST':
            permissions.append(CanCreateExpense())
        return permissions

    def perform_create(self, serializer):
        expense = create_expense(
            employee=self.request.user,
            category=serializer.validated_data.pop('category'),
            validated_data=serializer.validated_data,
        )
        serializer.instance = expense


class ExpenseDetailView(generics.RetrieveAPIView):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return expenses_visible_to(self.request.user)


class CategoryListView(generics.ListAPIView):
    serializer_class = ExpenseCategorySerializer

    def get_queryset(self):
        return ExpenseCategory.objects.filter(is_active=True)


class PendingApprovalListView(generics.ListAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = (CanMakeExpenseDecision,)

    def get_queryset(self):
        return pending_expenses_for_decision(self.request.user)


class ExpenseDecisionView(APIView):
    permission_classes = (CanMakeExpenseDecision,)
    request_serializer_class = ApprovalSerializer

    def get_expense(self, expense_id):
        try:
            return decision_visible_expenses(self.request.user).get(pk=expense_id)
        except Expense.DoesNotExist:
            raise NotFound('Expense not found.')

    def post(self, request, pk):
        request_serializer = self.request_serializer_class(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        expense = self.get_expense(pk)
        try:
            updated_expense = self.make_decision(
                expense_id=expense.pk,
                manager=request.user,
                comment=request_serializer.validated_data.get('comment', ''),
            )
        except DecisionConflict as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            ExpenseSerializer(updated_expense).data,
            status=status.HTTP_200_OK,
        )


class ApproveExpenseView(ExpenseDecisionView):
    def make_decision(self, *, expense_id, manager, comment):
        return approve_expense(
            expense_id=expense_id,
            manager=manager,
            comment=comment,
        )


class RejectExpenseView(ExpenseDecisionView):
    request_serializer_class = RejectionSerializer

    def make_decision(self, *, expense_id, manager, comment):
        return reject_expense(
            expense_id=expense_id,
            manager=manager,
            comment=comment,
        )


class EmployeeDashboardView(APIView):
    permission_classes = (IsEmployeeRole,)

    def get(self, request):
        data = expense_dashboard_summary(
            dashboard_expenses_for(request.user, 'employee'),
        )
        return Response(DashboardSerializer(data).data)


class ManagerDashboardView(APIView):
    permission_classes = (IsManagerOrAdminRole,)

    def get(self, request):
        data = expense_dashboard_summary(
            dashboard_expenses_for(request.user, 'manager'),
        )
        return Response(DashboardSerializer(data).data)


class ExpenseReceiptView(APIView):
    def get(self, request, pk):
        try:
            expense = expenses_visible_to(request.user).get(pk=pk)
        except Expense.DoesNotExist:
            raise NotFound('Expense not found.')
        if not expense.receipt:
            raise NotFound('This expense has no receipt.')

        try:
            receipt = expense.receipt.open('rb')
        except (FileNotFoundError, OSError):
            raise NotFound('Receipt is not available.')

        content_type = guess_type(expense.receipt.name)[0] or 'application/octet-stream'
        return FileResponse(
            receipt,
            content_type=content_type,
            as_attachment=True,
            filename='receipt',
        )
