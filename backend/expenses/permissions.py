from rest_framework.permissions import BasePermission


class CanCreateExpense(BasePermission):
    message = 'Only employees can submit expenses.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'EMPLOYEE'


class CanMakeExpenseDecision(BasePermission):
    message = 'Only managers or admins can decide expenses.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in {
            'MANAGER',
            'ADMIN',
        }


class IsEmployeeRole(BasePermission):
    message = 'Only employees can access this dashboard.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'EMPLOYEE'


class IsManagerOrAdminRole(BasePermission):
    message = 'Only managers or admins can access this dashboard.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in {
            'MANAGER',
            'ADMIN',
        }
