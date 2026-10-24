from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AuditEvent, Expense, ExpenseCategory, ExpenseDecision


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
        data = {
            'employee': employee,
            'category': self.category,
            'title': 'Existing expense',
            'amount': Decimal('50.00'),
            'currency': 'INR',
            'expense_date': date.today(),
            'description': 'Existing description',
        }
        data.update(overrides)
        return Expense.objects.create(**data)

    def approve_url(self, expense):
        return reverse('expense-approve', args=(expense.pk,))

    def reject_url(self, expense):
        return reverse('expense-reject', args=(expense.pk,))

    def dashboard_url(self, role):
        return reverse(f'dashboard-{role}')

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

    def test_assigned_manager_can_approve_pending_expense(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expense.refresh_from_db()
        self.assertEqual(expense.status, Expense.Status.APPROVED)

    def test_assigned_manager_can_reject_with_reason(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            self.reject_url(expense),
            {'comment': 'Receipt is missing.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expense.refresh_from_db()
        self.assertEqual(expense.status, Expense.Status.REJECTED)

    def test_rejection_requires_a_non_empty_reason(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            self.reject_url(expense),
            {'comment': '  '},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ExpenseDecision.objects.count(), 0)

    def test_employee_cannot_decide_expenses(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.employee)
        approve_response = self.client.post(self.approve_url(expense), {}, format='json')
        reject_response = self.client.post(
            self.reject_url(expense),
            {'comment': 'Not valid.'},
            format='json',
        )
        self.assertEqual(approve_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(reject_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_cannot_decide_another_managers_employee(self):
        user_model = get_user_model()
        other_manager = user_model.objects.create_user(
            username='other-manager',
            password='password',
            role='MANAGER',
        )
        other_employee = user_model.objects.create_user(
            username='other-managed-employee',
            password='password',
            role='EMPLOYEE',
            manager=other_manager,
        )
        expense = self.create_expense(other_employee)
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_cannot_decide_their_own_expense(self):
        expense = self.create_expense(self.manager)
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_approved_expense_cannot_be_rejected(self):
        expense = self.create_expense(self.employee, status=Expense.Status.APPROVED)
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            self.reject_url(expense),
            {'comment': 'Too late.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_rejected_expense_cannot_be_approved(self):
        expense = self.create_expense(self.employee, status=Expense.Status.REJECTED)
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_repeated_decisions_are_rejected(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.manager)
        first_response = self.client.post(self.approve_url(expense), {}, format='json')
        second_response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_409_CONFLICT)

    def test_successful_decision_creates_one_decision_and_audit_event(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            self.reject_url(expense),
            {'comment': 'Outside policy.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        decision = ExpenseDecision.objects.get(expense=expense)
        audit = AuditEvent.objects.get(expense=expense)
        self.assertEqual(ExpenseDecision.objects.filter(expense=expense).count(), 1)
        self.assertEqual(AuditEvent.objects.filter(expense=expense).count(), 1)
        self.assertEqual(decision.manager, self.manager)
        self.assertEqual(decision.decision, ExpenseDecision.Decision.REJECTED)
        self.assertEqual(decision.comment, 'Outside policy.')
        self.assertEqual(audit.action, 'EXPENSE_REJECTED')
        self.assertEqual(audit.actor, self.manager)

    def test_failed_decision_creates_no_records(self):
        expense = self.create_expense(self.employee, status=Expense.Status.APPROVED)
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(ExpenseDecision.objects.filter(expense=expense).count(), 0)
        self.assertEqual(AuditEvent.objects.filter(expense=expense).count(), 0)

    def test_unauthenticated_users_cannot_access_approval_endpoints(self):
        expense = self.create_expense(self.employee)
        queue_response = self.client.get(reverse('approval-pending-list'))
        approve_response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(queue_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(approve_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pending_queue_excludes_decided_expenses(self):
        pending_expense = self.create_expense(self.employee)
        approved_expense = self.create_expense(
            self.employee,
            title='Approved expense',
            status=Expense.Status.APPROVED,
        )
        self.client.force_authenticate(self.manager)
        response = self.client.get(reverse('approval-pending-list'))
        returned_ids = {item['id'] for item in response.data['results']}
        self.assertIn(pending_expense.pk, returned_ids)
        self.assertNotIn(approved_expense.pk, returned_ids)

    def test_unauthorized_user_cannot_use_decision_endpoint_for_expense(self):
        expense = self.create_expense(self.other_employee)
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_employee_dashboard_contains_scoped_counts_and_totals(self):
        self.create_expense(self.employee, amount=Decimal('100.00'))
        self.create_expense(
            self.employee,
            amount=Decimal('25.00'),
            status=Expense.Status.APPROVED,
        )
        self.create_expense(
            self.other_employee,
            amount=Decimal('999.00'),
            status=Expense.Status.APPROVED,
        )
        self.client.force_authenticate(self.employee)
        response = self.client.get(self.dashboard_url('employee'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_expenses'], 2)
        self.assertEqual(response.data['pending_count'], 1)
        self.assertEqual(response.data['approved_count'], 1)
        self.assertEqual(response.data['rejected_count'], 0)
        self.assertEqual(response.data['total_amount_submitted'], '125.00')
        self.assertEqual(response.data['total_amount_approved'], '25.00')

    def test_manager_dashboard_is_scoped_to_assigned_employees(self):
        self.create_expense(self.employee, amount=Decimal('100.00'))
        self.create_expense(
            self.employee,
            amount=Decimal('25.00'),
            status=Expense.Status.REJECTED,
        )
        self.create_expense(
            self.other_employee,
            amount=Decimal('999.00'),
            status=Expense.Status.APPROVED,
        )
        self.client.force_authenticate(self.manager)
        response = self.client.get(self.dashboard_url('manager'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_expenses'], 2)
        self.assertEqual(response.data['pending_count'], 1)
        self.assertEqual(response.data['approved_count'], 0)
        self.assertEqual(response.data['rejected_count'], 1)
        self.assertEqual(response.data['total_amount_submitted'], '125.00')
        self.assertEqual(response.data['total_amount_approved'], '0.00')

    def test_dashboard_permissions_are_role_restricted(self):
        self.client.force_authenticate(self.employee)
        employee_response = self.client.get(self.dashboard_url('manager'))
        self.assertEqual(employee_response.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.manager)
        manager_response = self.client.get(self.dashboard_url('employee'))
        self.assertEqual(manager_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_expense_filters_are_applied(self):
        matching = self.create_expense(
            self.employee,
            amount=Decimal('75.00'),
            expense_date=date(2026, 1, 15),
            status=Expense.Status.APPROVED,
        )
        self.create_expense(
            self.employee,
            amount=Decimal('10.00'),
            expense_date=date(2025, 1, 15),
        )
        self.client.force_authenticate(self.employee)
        response = self.client.get(
            self.expenses_url,
            {
                'status': Expense.Status.APPROVED,
                'category': self.category.pk,
                'date_from': '2026-01-01',
                'date_to': '2026-01-31',
                'min_amount': '50.00',
                'max_amount': '100.00',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data['results']], [matching.pk])

    def test_invalid_expense_filters_are_rejected(self):
        self.client.force_authenticate(self.employee)
        invalid_filters = (
            {'status': 'UNKNOWN'},
            {'category': 'not-an-id'},
            {'date_from': '2026-02-30'},
            {'date_from': '2026-02-01', 'date_to': '2026-01-01'},
            {'min_amount': 'not-a-number'},
            {'min_amount': '20', 'max_amount': '10'},
        )
        for query_params in invalid_filters:
            response = self.client.get(self.expenses_url, query_params)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expense_list_remains_paginated(self):
        for index in range(21):
            self.create_expense(self.employee, title=f'Expense {index}')
        self.client.force_authenticate(self.employee)
        response = self.client.get(self.expenses_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 20)
        self.assertIsNotNone(response.data['next'])

    def test_receipt_upload_rejects_oversized_and_invalid_content(self):
        self.client.force_authenticate(self.employee)
        oversized = SimpleUploadedFile(
            'receipt.pdf',
            b'%PDF-' + b'x' * (5 * 1024 * 1024),
            content_type='application/pdf',
        )
        oversized_response = self.client.post(
            self.expenses_url,
            self.expense_data(receipt=oversized),
            format='multipart',
        )
        self.assertEqual(oversized_response.status_code, status.HTTP_400_BAD_REQUEST)

        invalid_content = SimpleUploadedFile(
            'receipt.pdf',
            b'not a pdf',
            content_type='application/pdf',
        )
        invalid_response = self.client.post(
            self.expenses_url,
            self.expense_data(receipt=invalid_content),
            format='multipart',
        )
        self.assertEqual(invalid_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_receipt_endpoint_requires_a_receipt(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.employee)
        response = self.client.get(reverse('expense-receipt', args=(expense.pk,)))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_receipt_access_is_authorized(self):
        receipt = SimpleUploadedFile(
            'original-name.pdf',
            b'%PDF-1.7 receipt',
            content_type='application/pdf',
        )
        self.client.force_authenticate(self.employee)
        create_response = self.client.post(
            self.expenses_url,
            self.expense_data(receipt=receipt),
            format='multipart',
        )
        expense = Expense.objects.get(pk=create_response.data['id'])
        self.client.force_authenticate(self.other_employee)
        unauthorized_response = self.client.get(
            reverse('expense-receipt', args=(expense.pk,)),
        )
        self.assertEqual(unauthorized_response.status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(self.employee)
        receipt_response = self.client.get(
            reverse('expense-receipt', args=(expense.pk,)),
        )
        self.assertEqual(receipt_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt_response['Content-Type'], 'application/pdf')

    def test_decision_history_is_visible_only_to_authorized_expense_viewers(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.manager)
        decision_response = self.client.post(self.approve_url(expense), {}, format='json')
        self.assertEqual(decision_response.status_code, status.HTTP_200_OK)
        detail_response = self.client.get(
            reverse('expense-detail', args=(expense.pk,)),
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail_response.data['decisions']), 1)
        self.client.force_authenticate(self.other_employee)
        unauthorized_detail = self.client.get(
            reverse('expense-detail', args=(expense.pk,)),
        )
        self.assertEqual(unauthorized_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_decision_history_cannot_be_modified_through_expense_endpoint(self):
        expense = self.create_expense(self.employee)
        self.client.force_authenticate(self.manager)
        self.client.post(self.approve_url(expense), {}, format='json')
        response = self.client.patch(
            reverse('expense-detail', args=(expense.pk,)),
            {'status': Expense.Status.REJECTED},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
