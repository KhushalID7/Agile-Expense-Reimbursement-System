from rest_framework.permissions import BasePermission


class CanCreateExpense(BasePermission):
    message = 'Only employees can submit expenses.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'EMPLOYEE'
