from django.urls import path

from .views import CategoryListView, ExpenseDetailView, ExpenseListCreateView

urlpatterns = [
    path('expenses/', ExpenseListCreateView.as_view(), name='expense-list'),
    path('expenses/<int:pk>/', ExpenseDetailView.as_view(), name='expense-detail'),
    path('categories/', CategoryListView.as_view(), name='category-list'),
]
