# Authentication System Setup Guide

This guide explains how to set up and use the authentication system for the Testprepkart Admin Dashboard.

## Overview

The authentication system includes:
- Secure login with email domain validation (@testprepkart.com only)
- Password encryption with bcrypt
- IP-based rate limiting (5 attempts per 15 minutes)
- Account lockout after 5 failed attempts (1 hour lock)
- Google reCAPTCHA v2 integration
- User management interface
- Session-based authentication

## Environment Variables

Add these to your `.env` file:

```bash
# Required for authentication
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key

# Initial admin setup
ADMIN_EMAIL=admin@testprepkart.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Administrator

# Optional: Force update existing admin password
# FORCE_UPDATE_ADMIN=1
```

## Google reCAPTCHA Setup

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/create)
2. Select **reCAPTCHA v2** and **"I'm not a robot" Checkbox**
3. Add your domain (e.g., localhost:3000 for development, yourdomain.com for production)
4. Copy the **Site Key** and **Secret Key** to your environment variables

## Database Setup

The system uses MongoDB. Ensure you have the User collection created automatically when you first run the application.

## Initial Admin Setup

1. Set the admin environment variables in your `.env` file
2. Run the seed script to create the initial admin user:

```bash
npm run seed-admin
```

This will create an admin user with the credentials you specified in the environment variables.

## User Management

### Creating Users

1. Navigate to **Admin Settings → User Accounts** in the dashboard
2. Click **Create User**
3. Fill in:
   - **Name**: User's full name
   - **Email**: Must end with @testprepkart.com
   - **Password**: Minimum 6 characters
   - **Role**: Admin or User
4. Click **Create**

### Managing Users

- **View**: All users are listed in the User Accounts section
- **Edit**: Click the Edit button to modify user details, role, or status
- **Delete**: Click Delete to remove a user (cannot delete your own account)
- **Status**: Active/Inactive toggle controls login access
- **Role**: Admin users can manage other users; regular users have limited access

## Security Features

### Email Domain Validation
- Only `@testprepkart.com` email addresses are allowed
- Validation happens on both frontend and backend

### Rate Limiting
- IP-based rate limiting: 5 login attempts per 15 minutes
- Account lockout: 5 failed attempts lock account for 1 hour
- Automatic unlock after lockout period expires

### Password Security
- Passwords are hashed using bcrypt with salt rounds = 12
- Passwords are never stored in plain text
- Minimum password length: 6 characters

### Session Management
- HTTP-only cookies for session tokens
- 24-hour session expiration
- Automatic logout on session expiry

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout  
- `GET /api/auth/me` - Get current user info

### User Management (Admin only)
- `GET /api/settings/users` - List all users
- `POST /api/settings/users` - Create new user
- `GET /api/settings/users/[id]` - Get specific user
- `PUT /api/settings/users/[id]` - Update user
- `DELETE /api/settings/users/[id]` - Delete user

## Login Flow

1. User enters email and password at `/login`
2. Frontend validates email domain (@testprepkart.com)
3. reCAPTCHA verification
4. API validates credentials
5. Rate limiting check
6. Account lockout check
7. Password verification
8. Session cookie set on success
9. Redirect to dashboard

## Middleware Protection

All routes except `/login` and `/api/auth/*` are protected by middleware:
- Validates session token
- Redirects unauthenticated users to login
- Clears invalid tokens

## Troubleshooting

### Common Issues

**"Only testprepkart.com email addresses are allowed"**
- Ensure email ends with @testprepkart.com
- Check environment variables for domain validation

**"Too many login attempts"**
- Wait 15 minutes for rate limit to reset
- Check for automated login attempts

**"Account is locked"**
- Wait 1 hour for automatic unlock
- Admin can manually unlock via user management

**reCAPTCHA verification failed**
- Check reCAPTCHA keys in environment variables
- Ensure domain is whitelisted in reCAPTCHA console
- Verify internet connectivity for reCAPTCHA API

### Reset Admin Password

If you lose admin access:

1. Set `FORCE_UPDATE_ADMIN=1` in `.env`
2. Update `ADMIN_PASSWORD` to new password
3. Run `npm run seed-admin`
4. Remove `FORCE_UPDATE_ADMIN` from `.env`

## Production Deployment

1. Set production reCAPTCHA keys
2. Use HTTPS for secure cookies
3. Update allowed domains in reCAPTCHA console
4. Set strong admin password
5. Regularly review user accounts
6. Monitor failed login attempts

## Security Best Practices

- Use strong, unique passwords for admin accounts
- Regularly rotate admin passwords
- Monitor user account activity
- Remove inactive user accounts
- Keep reCAPTCHA keys secure
- Use environment variables for all secrets
- Enable HTTPS in production
- Regular security audits
