# Sampark Backend

Persistent backend with MongoDB + optional AI and OTP integrations.

## Run

```bash
npm install
npm start
```

## Environment

Copy `.env.example` to `.env`.

- `PORT` default `5000`
- `CLIENT_ORIGIN` default `http://localhost:3000`
- `MONGODB_URI` default `mongodb://127.0.0.1:27017/sampark`
- `OPENAI_API_KEY` optional
- `OPENAI_MODEL` default `gpt-4o-mini`

### India SMS OTP (MSG91)

- `OTP_PROVIDER=msg91` to enable real SMS OTP
- `MSG91_AUTH_KEY=...`
- `MSG91_SENDER_ID=SMSIND` (use your approved sender ID)
- `MSG91_COUNTRY_CODE=91`
- `OTP_ENABLE_DEMO_FALLBACK=true|false`

If `OTP_ENABLE_DEMO_FALLBACK=true`, server will return `demoOtp` when SMS provider fails.
Set it to `false` for strict production behavior.

## Key API Endpoints

- `POST /api/auth/send-otp`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/listings`
- `GET /api/bootstrap`

## Notes

- Data persists in MongoDB.
- Seed data is inserted only when DB is empty.
