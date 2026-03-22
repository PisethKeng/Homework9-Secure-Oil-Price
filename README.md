# express-middleware-assignment

This project is an Express.js server that secures an Energy API using middleware. It includes IP filtering, CORS restriction, rate limiting, JWT-based Bearer authentication for the API, and Basic Auth protection for the dashboard.

## Features

- IP Filtering: only allows requests from localhost
- CORS restriction to a local development origin
- Rate Limiting: 10 requests per 1 minute
- JWT Bearer Token protection for `/api/oil-prices`
- Basic Auth protection for `/dashboard`
- Logout route to clear the dashboard session

## Project Structure

- `app.js` – main server file
- `package.json` – project dependencies and scripts
- `README.md` – project instructions

## environment variables ( for testing)

BEARER_TOKEN=1234lasdmlqwmelmqwelmqw
BASIC_USER=admin
BASIC_PASS=123
JWT_SECRET=my_jwt_secret_key_2026
SESSION_SECRET=my_super_secret_key

NOTE: Additional variables are initialized in placeholders of the main code. 
