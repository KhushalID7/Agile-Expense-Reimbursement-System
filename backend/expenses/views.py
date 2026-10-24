from rest_framework import generics

from .models import ExpenseCategory
from .permissions import CanCreateExpense
from .serializers import ExpenseCategorySerializer, ExpenseSerializer
from .services import create_expense, expenses_visible_to


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return expenses_visible_to(self.request.user)

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
