from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_active', 'manager')
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    fieldsets = UserAdmin.fieldsets + (
        ('Organization', {'fields': ('role', 'manager')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Organization', {'fields': ('role', 'manager')}),
    )
