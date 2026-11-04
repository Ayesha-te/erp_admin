# BakeHub Control Room (platform admin panel)

Separate app for the platform owner. Creates bakeries (clients), their first admin user, suspends/activates bakeries, resets a bakery admin's password and lists a bakery's users. It never shows bakery business data.

    cp .env.example .env.local   # set VITE_API_BASE_URL to your backend /api URL
    npm install && npm run dev   # http://localhost:5174

Sign in with the platform account created by `python manage.py create_platform_admin` on the backend. Add this app's origin to the backend `CORS_ALLOWED_ORIGINS`.
