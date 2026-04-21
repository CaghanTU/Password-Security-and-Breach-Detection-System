# Password Security System

A comprehensive and secure password management, analysis, and monitoring system. In addition to storing passwords safely, this project provides advanced security capabilities such as strong password generation, breach checks, security scoring, and audit logging.

## Features

- **Password Management**: Securely store and manage passwords using cryptographic protection (create, view, update, delete).
- **Password Security Scoring**: An advanced scoring mechanism that evaluates password strength.
- **Breach Checking**: Check whether your passwords appear in known data breaches.
- **Two-Factor Authentication (2FA)**: An extra security layer for user accounts.
- **Password Generator**: Create strong, random passwords based on configurable security rules such as length, symbols, and digits.
- **Audit Logs**: Detailed, traceable logging for user and system activity.
- **Import/Export**: Securely back up password data or migrate it from other platforms.

## Tech Stack

**Backend:**
- Python & [FastAPI](https://fastapi.tiangolo.com/) for high-performance API development
- Security: Pydantic for validation/schemas, cryptography and hashing for end-to-end protection
- Modular architecture (routers, services, models, schemas)

**Frontend:**
- [React.js](https://react.dev/) + [Vite](https://vitejs.dev/) for a fast modern web UI
- Component-based structure (Dashboard, Passwords, Audit, Breach, Score tabs)
- State management with Context API (`AuthContext`)

## Project Structure

```text
password_security_system/
├── backend/
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py & database.py # Configuration and database setup
│   ├── models/                 # Database models and Pydantic schemas
│   ├── routers/                # API endpoints (auth, passwords, breach, score, etc.)
│   └── services/               # Business logic (crypto, audit, breach, generator, etc.)
│
├── frontend/
│   ├── index.html & vite.config.js       # Vite and entry setup
│   ├── package.json & eslint.config.js   # Dependencies and lint rules
│   └── src/
│       ├── components/         # UI components (tabs, modals, etc.)
│       ├── context/            # React Context (AuthContext)
│       ├── pages/              # Pages (Login, Dashboard)
│       └── services/           # API services for backend communication (api.js)
```

## Risk Score Methodology (V2)

The system calculates the risk score using normalized ratios instead of a fixed penalty sum. This enables a fairer comparison between users with small and large vaults.

### Formula

1. **Weighted risk** is calculated:

```text
base_risk =
	0.30 * weak_ratio
	+ 0.10 * medium_ratio
	+ 0.20 * reused_ratio
	+ 0.25 * breach_any_ratio
	+ 0.10 * stale_ratio
	+ 0.05 * not_rotated_ratio
```

2. **Base score** is produced:

```text
base_score = round(100 * (1 - base_risk))
```

3. **Positive security bonuses** are added:

```text
bonus = round(8 * totp_ratio) + round(5 * unique_ratio)
score = clamp(base_score + bonus, 0, 100)
```

### Quick Explanation

- `weak_ratio`: Ratio of weak passwords
- `medium_ratio`: Ratio of medium-strength passwords
- `reused_ratio`: Ratio of reused passwords
- `breach_any_ratio`: Ratio of records affected by password or email breaches
- `stale_ratio`: Ratio of passwords older than 90 days
- `not_rotated_ratio`: Ratio of passwords not updated after a breach
- `totp_ratio`: Ratio of records with TOTP enabled (bonus)
- `unique_ratio`: Ratio of unique passwords (bonus)

### Stabilization (Score History)

Score history is stored for the trend chart. If the same score keeps being calculated, history writes are throttled with a minimum interval to avoid unnecessary growth.

## External API Dependency Note

The project uses Have I Been Pwned (HIBP) only for breach enrichment.

- Core capabilities (vault, encryption, local risk scoring, TOTP, audit, import/export) **continue working without any external API**.
- If HIBP is unavailable, the core system still works; only breach verification coverage is reduced.

This architecture makes the project an independently functioning security system rather than a demo tied to a single external API call.

## Setup and Run

### Start the Backend

From the project root (or the backend directory), run the following steps:

```bash
cd password_security_system

# Create a Python virtual environment
python3 -m venv .venv

# Activate the virtual environment (macOS / Linux)
source .venv/bin/activate
# For Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server with uvicorn
uvicorn backend.main:app --reload
```
The API server runs by default at `http://localhost:8000`, and the interactive documentation is available at `http://localhost:8000/docs`.

### Start the Frontend

In a separate terminal tab/window, run:

```bash
cd password_security_system/frontend

# Install Node packages
npm install

# Start the development server
npm run dev
```
The application UI will be available at `http://localhost:5173`.
