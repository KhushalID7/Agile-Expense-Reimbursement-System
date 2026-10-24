from django.contrib import admin

from .models import AuditEvent, Expense, ExpenseCategory, ExpenseDecision


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('title', 'employee', 'category', 'amount', 'currency', 'status', 'expense_date')
    list_filter = ('status', 'currency', 'category')
    search_fields = ('title', 'description', 'employee__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(ExpenseDecision)
class ExpenseDecisionAdmin(admin.ModelAdmin):
    list_display = ('expense', 'manager', 'decision', 'decided_at')
    list_filter = ('decision', 'decided_at')
    search_fields = ('expense__title', 'manager__username', 'comment')
    readonly_fields = ('expense', 'manager', 'decision', 'comment', 'decided_at')


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ('action', 'actor', 'expense', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('action', 'actor__username', 'expense__title')
    readonly_fields = ('actor', 'expense', 'action', 'details', 'created_at')
