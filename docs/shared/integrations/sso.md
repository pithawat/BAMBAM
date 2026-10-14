# SSO — configuration and integration

<!-- ✏️ วางเนื้อหาไฟล์ markdown วิธี config SSO ที่คุณมีอยู่แล้วแทนที่ไฟล์นี้ทั้งไฟล์
     แนะนำให้มีหัวข้อด้านล่างนี้ครบ agent จะทำงานได้ไม่ต้องเดา -->

## Provider

(เช่น Azure AD / Keycloak / Google Workspace / ระบบ SSO ภายใน) · protocol: OIDC / SAML

## Values per environment

| Key | Env var | development | production |
|---|---|---|---|
| Issuer / tenant | `SSO_ISSUER` | | (secret from platform) |
| Client ID | `SSO_CLIENT_ID` | | |
| Client secret | `SSO_CLIENT_SECRET` | `.env` only | secret from platform |
| Redirect URI | `SSO_REDIRECT_URL` | http://localhost:8080/api/v1/auth/callback | |
| Scopes | | | |

## Flow

(sequence: user → FE → BE → SSO → callback → session cookie / token)

## Claims → app user

(claim ไหน map เป็น user id, email, ชื่อ, role/group)

## Must / must not

- (เช่น ห้ามเก็บ access token ใน localStorage, session timeout 8 ชั่วโมง, logout ต้องเรียก end-session ของ provider)

## How to test locally

(test account, mock IdP หรือวิธีข้าม SSO ใน dev ถ้ามี)
