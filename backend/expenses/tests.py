from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Expense, ExpenseCategory


class ExpenseAPITests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.employee = user_model.objects.create_user(
            username='employee-a',
            password='password',
            role='EMPLOYEE',
        )
        self.other_employee = user_model.objects.create_user(
            username='employee-b',
            password='password',
            role='EMPLOYEE',
        )
        self.manager = user_model.objects.create_user(
            username='manager',
            password='password',
            role='MANAGER',
        )
        self.employee.manager = self.manager
        self.employee.save(update_fields=('manager',))
        self.category = ExpenseCategory.objects.create(name='Travel')
        self.inactive_category = ExpenseCategory.objects.create(
            name='Inactive',
            is_active=False,
        )
        self.expenses_url = reverse('expense-list')

    def expense_data(self, category=None, **overrides):
        data = {
            'category': category or self.category.pk,
            'title': 'Taxi fare',
            'amount': '125.50',
            'currency': 'INR',
            'expense_date': date.today().isoformat(),
            'description': 'Taxi from office',
        }
        data.update(overrides)
        return data

    def create_expense(self, employee, **overrides):
        return Expense.objects.create(
            employee=employee,
            category=self.category,
            title='Existing expense',
            amount=Decimal('50.00'),
            currency='INR',
            expense_date=date.today(),
            description='Existing description',
            **overrides,
        )

    def test_unauthenticated_requests_are_rejected(self):
        response = self.client.get(self.expenses_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_expense_creation_defaults_to_pending(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post(self.expenses_url, self.expense_data(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], Expense.Status.PENDING)

    def test_zero_or_negative_amounts_are_rejected(self):
        self.client.force_authenticate(self.employee)
        for amount in ('0', '-1'):
            response = self.client.post(
                self.expenses_url,
                self.expense_data(amount=amount),
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_employee_cannot_list_or_retrieve_another_employees_expense(self):
        expense = self.create_expense(self.other_employee)
        self.client.force_authenticate(self.employee)
        list_response = self.client.get(self.expenses_url)
        detail_response = self.client.get(reverse('expense-detail', args=(expense.pk,)))
        self.assertEqual(list_response.data['count'], 0)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_employee_id_is_not_accepted_for_creation(self):
        self.client.force_authenticate(self.employee)
        data = self.expense_data()
        data['employee'] = self.other_employee.pk
        response = self.client.post(self.expenses_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('employee', response.data)

    def test_inactive_categories_cannot_be_used(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post(
            self.expenses_url,
            self.expense_data(category=self.inactive_category.pk),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_manager_visibility_is_restricted_to_assigned_employees(self):
        assigned_expense = self.create_expense(self.employee)
        unassigned_expense = self.create_expense(self.other_employee)
        self.client.force_authenticate(self.manager)
        response = self.client.get(self.expenses_url)
        returned_ids = {item['id'] for item in response.data['results']}
        self.assertIn(assigned_expense.pk, returned_ids)
        self.assertNotIn(unassigned_expense.pk, returned_ids)

    def test_category_endpoint_returns_only_active_categories(self):
        self.client.force_authenticate(self.employee)
        response = self.client.get(reverse('category-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['name'] for item in response.data['results']], ['Travel'])
