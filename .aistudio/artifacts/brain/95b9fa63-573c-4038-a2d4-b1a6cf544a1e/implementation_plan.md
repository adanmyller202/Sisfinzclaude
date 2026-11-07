# Implementation Plan: Professional OTP Password Recovery System

## 1. Overview
Replace the existing Firebase email-link password recovery with a secure, server-side generated 6-digit OTP code sent via email, integrated entirely within SisFinz.

## 2. Backend Architecture (`server.ts`)
We will add three new endpoints to the existing Node.js/Express backend:
- `POST /api/request-otp`:
    - Generates a 6-digit code.
    - Stores the code in a `password_resets` Firestore collection (email, code, expiresAt).
    - Triggers email sending.
    - Enforces rate-limiting (e.g., max 3 requests per 15 minutes, 60s between resends).
- `POST /api/verify-otp`:
    - Validates the provided code against the entry in Firestore.
    - If valid, returns a temporary session token or allows password reset.
- `POST /api/reset-password-with-otp`:
    - Accepts the new password and the validated token/code.
    - Calls Firebase Admin SDK `updateUser` to update the password.

## 3. Email Integration Strategy
To send professional emails without exposing secrets on the frontend:
- **Proposal**: Use `nodemailer` in `server.ts` to connect to an SMTP provider (e.g., Gmail, SendGrid, Mailtrap).
- **Configuration**: The user will need to provide SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) in the environment variables.

## 4. Frontend Implementation
- **New Component**: `src/components/auth/RecoveryModal.tsx`
    - Step 1: Input for email.
    - Step 2: 6-digit OTP input + "Resend" button (60s countdown).
    - Step 3: New password input + confirmation.
- **Context Update**: `AuthContext.tsx` will expose `requestOTP`, `verifyOTP`, and `resetPasswordWithOTP` methods.

## 5. Security & Constraints
- OTPs are generated, stored, and validated on the backend.
- Firestore security rules will be updated to restrict access to `password_resets`.
- No frontend exposure of API keys.
- I18n will be applied to the email body and UI components.
