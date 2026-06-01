# SecureVoice

A secure, real-time voice communication application built with a React frontend and Node.js backend.

## Stack

| Layer    | Tech                                          |
|----------|-----------------------------------------------|
| Frontend | React 19, TypeScript, Vite, Zustand, React Query |
| Backend  | Node.js, Express 5, TypeScript, Socket.IO     |
| Database | MySQL                                         |
| Auth     | JWT, bcryptjs                                 |

## Project Structure

```
secureVoice/
├── securevoice-api/   # Express + Socket.IO backend (port 3000)
└── securevoice-web/   # React + Vite frontend (port 5173)
```

## Getting Started

### Prerequisites
- Node.js 18+
- Yarn
- MySQL

### Install dependencies

```bash
# From the root
yarn install

# Install sub-project dependencies
yarn --cwd securevoice-api install
yarn --cwd securevoice-web install
```

### Environment variables

Create a `.env` file in `securevoice-api/`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=securevoice
JWT_SECRET=your_jwt_secret
```

### Run in development

```bash
# Run both API and web concurrently from root
yarn dev
```

Or run individually:

```bash
# API only
yarn --cwd securevoice-api dev

# Web only
yarn --cwd securevoice-web dev
```

### Build for production

```bash
yarn --cwd securevoice-api build
yarn --cwd securevoice-web build
```

## API

| Method | Endpoint  | Description     |
|--------|-----------|-----------------|
| GET    | /health   | Health check    |
