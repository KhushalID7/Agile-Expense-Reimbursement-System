from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase


class AuthenticationAPITests(APITestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.password = 'strong-test-password'
        self.user = self.user_model(
            username='employee',
            email='employee@example.com',
            role='EMPLOYEE',
        )
        self.user.set_password(self.password)
        self.user.save()
        self.login_url = reverse('auth-login')
        self.logout_url = reverse('auth-logout')
        self.csrf_url = reverse('auth-csrf')
        self.me_url = reverse('auth-me')

    def csrf_token(self):
        response = self.client.get(self.csrf_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['csrfToken']

    def csrf_headers(self):
        token = self.csrf_token()
        return {'HTTP_X_CSRFTOKEN': token}

    def test_csrf_endpoint_returns_token_and_cookie(self):
        response = self.client.get(self.csrf_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['csrfToken'])
        self.assertIn('csrftoken', response.cookies)

    def test_successful_login_returns_safe_user_data(self):
        response = self.client.post(
            self.login_url,
            {'username': self.user.username, 'password': self.password},
            format='json',
            **self.csrf_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.user.id)
        self.assertEqual(response.data['username'], self.user.username)
        self.assertEqual(response.data['email'], self.user.email)
        self.assertEqual(response.data['role'], 'EMPLOYEE')
        self.assertNotIn('password', response.data)
        self.assertNotIn('sessionid', response.data)
        self.assertEqual(
            self.client.get(self.me_url).status_code,
            status.HTTP_200_OK,
        )

    def test_invalid_credentials_return_generic_error(self):
        response = self.client.post(
            self.login_url,
            {'username': 'does-not-exist', 'password': 'wrong-password'},
            format='json',
            **self.csrf_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Invalid username or password.')

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save(update_fields=('is_active',))
        response = self.client.post(
            self.login_url,
            {'username': self.user.username, 'password': self.password},
            format='json',
            **self.csrf_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Invalid username or password.')

    def test_current_user_requires_authentication(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_existing_expense_api_remains_protected(self):
        response = self.client.get(reverse('expense-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_current_user_does_not_expose_secrets(self):
        self.client.force_login(self.user)
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {'id', 'username', 'email', 'role', 'is_active'},
        )
        self.assertNotIn('password', response.data)

    def test_login_requires_csrf_token(self):
        csrf_client = APIClient(enforce_csrf_checks=True)
        response = csrf_client.post(
            self.login_url,
            {'username': self.user.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_logout_requires_csrf_and_invalidates_session(self):
        self.client.force_login(self.user)
        csrf_client = APIClient(enforce_csrf_checks=True)
        csrf_client.cookies = self.client.cookies
        csrf_client.get(self.csrf_url)

        missing_csrf_response = csrf_client.post(self.logout_url, {}, format='json')
        self.assertEqual(
            missing_csrf_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        token = csrf_client.cookies['csrftoken'].value
        logout_response = csrf_client.post(
            self.logout_url,
            {},
            format='json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            csrf_client.get(self.me_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )
