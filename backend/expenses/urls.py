from django.urls import path

from .views import (
    ApproveExpenseView,
    CategoryListView,
    ExpenseDetailView,
    ExpenseListCreateView,
    EmployeeDashboardView,
    ExpenseReceiptView,
    ManagerDashboardView,
    PendingApprovalListView,
    RejectExpenseView,
)

urlpatterns = [
    path('expenses/', ExpenseListCreateView.as_view(), name='expense-list'),
    path('expenses/<int:pk>/', ExpenseDetailView.as_view(), name='expense-detail'),
    path(
        'expenses/<int:pk>/receipt/',
        ExpenseReceiptView.as_view(),
        name='expense-receipt',
    ),
    path(
        'approvals/pending/',
        PendingApprovalListView.as_view(),
        name='approval-pending-list',
    ),
    path(
        'expenses/<int:pk>/approve/',
        ApproveExpenseView.as_view(),
        name='expense-approve',
    ),
    path(
        'expenses/<int:pk>/reject/',
        RejectExpenseView.as_view(),
        name='expense-reject',
    ),
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path(
        'dashboard/employee/',
        EmployeeDashboardView.as_view(),
        name='dashboard-employee',
    ),
    path(
        'dashboard/manager/',
        ManagerDashboardView.as_view(),
        name='dashboard-manager',
    ),
]
