# Student Code IDE – Frontend

React + Vite + TypeScript. Monaco editor + streaming chat. Static build for S3 + CloudFront.

```bash
npm install
cp .env.example .env.local   # VITE_MOCK=true works with no AWS
npm run dev
npm run build                # -> dist/  (upload to S3)
```

With `VITE_MOCK=true` (or no `VITE_WS_URL`) a fake login and simulated streaming are used.
For real AWS set `VITE_MOCK=false` and fill in the Cognito/WebSocket vars.

## Backend contract

**Auth** – Cognito User Pool, USER_SRP auth via `amazon-cognito-identity-js`. The app client must have **no secret**.
The UI reads `custom:dailyUsage` from the **ID token** (added by the Pre-Token Generation trigger; make sure it is
added to the ID token claims) to show the usage bar and block sending at `VITE_DAILY_LIMIT`.

**Connect** – `wss://<api>/<stage>?token=<Cognito ID token>`. Browsers can't set WebSocket headers, so the
`$connect` Lambda Authorizer must read `event.queryStringParameters.token` (identity source `route.request.querystring.token`).
Return 429 / deny when `custom:dailyUsage >= 50`. The client reconnects with exponential backoff, fetching a fresh token each time.

**Client → server** (route selection expression `$request.body.action`, route key `sendMessage`):

```json
{ "action": "sendMessage", "sessionId": "uuid", "prompt": "...", "code": "...", "language": "python" }
```

**Server → client** (via `postToConnection`, one JSON frame per message):

```json
{ "type": "chunk", "text": "partial text" }
{ "type": "done", "dailyUsage": 4 }
{ "type": "error", "code": 429, "message": "..." }
```

Send `done` after the last Bedrock chunk (`dailyUsage` optional, updates the counter). Send `error` on failure;
`code: 429` locks the input.

## Deploy

Upload `dist/` to the S3 bucket behind CloudFront. Add the CloudFront domain to the Cognito app client's allowed origins if you later add hosted UI.
