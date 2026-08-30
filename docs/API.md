# EDEN API Documentation

## Base URL
```
https://eden.yourdomain.com/api
```

## Authentication

All API requests require a JWT token in the `Authorization` header:
```
Authorization: Bearer YOUR_TOKEN
```

### Register
Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": 1234567890
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login
Authenticate and get a JWT token.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": 1234567890
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get Current User
Get information about the authenticated user.

**Endpoint:** `GET /api/auth/me`

**Response:**
```json
{
  "user": {
    "sub": "user_123",
    "email": "user@example.com",
    "role": "user",
    "iat": 1234567890,
    "exp": 1234571490
  }
}
```

### Refresh Token
Refresh the authentication token.

**Endpoint:** `POST /api/auth/refresh`

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout
Invalidate the current token (client-side).

**Endpoint:** `POST /api/auth/logout`

**Response:**
```json
{
  "success": true
}
```

---

## Agents

### Get All Agents
Get all agents created by the authenticated user.

**Endpoint:** `GET /api/agents`

**Query Parameters:**
- None

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_123",
      "name": "My Agent",
      "description": "A sample agent",
      "nodes": { ... },
      "connections": [],
      "metadata": {
        "createdAt": 1234567890,
        "updatedAt": 1234567890,
        "version": "1.0.0",
        "author": "user_123",
        "tags": ["sample", "test"]
      }
    }
  ]
}
```

### Get Agent
Get a specific agent by ID.

**Endpoint:** `GET /api/agents/:id`

**Response:**
```json
{
  "agent": { ... }
}
```

### Create Agent
Create a new agent.

**Endpoint:** `POST /api/agents`

**Request Body:**
```json
{
  "name": "My New Agent",
  "description": "Description of the agent",
  "nodes": { ... },
  "connections": [],
  "tags": ["tag1", "tag2"]
}
```

**Response:**
```json
{
  "agent": { ... }
}
```

### Update Agent
Update an existing agent.

**Endpoint:** `PUT /api/agents/:id`

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "agent": { ... }
}
```

### Delete Agent
Delete an agent.

**Endpoint:** `DELETE /api/agents/:id`

**Response:**
```json
{
  "success": true
}
```

---

## Templates

### Get All Templates
Get all templates (public templates or user's templates).

**Endpoint:** `GET /api/templates`

**Query Parameters:**
- `category` (string): Filter by category
- `search` (string): Search templates
- `sort` (string): Sort by 'popular', 'recent', 'rating', or 'downloads'
- `isPublic` (boolean): Filter by public status

**Response:**
```json
{
  "templates": [
    {
      "id": "template_123",
      "name": "Sample Template",
      "description": "A sample template",
      "author": "John Doe",
      "authorId": "user_123",
      "nodes": { ... },
      "connections": [],
      "metadata": {
        "createdAt": 1234567890,
        "updatedAt": 1234567890,
        "version": "1.0.0",
        "tags": ["sample"],
        "category": "automation",
        "isPublic": true,
        "downloadCount": 100,
        "rating": 4.5,
        "likeCount": 50
      }
    }
  ]
}
```

### Get Template
Get a specific template by ID.

**Endpoint:** `GET /api/templates/:id`

**Response:**
```json
{
  "template": { ... }
}
```

### Create Template
Create a new template.

**Endpoint:** `POST /api/templates`

**Request Body:**
```json
{
  "name": "My Template",
  "description": "Description of the template",
  "nodes": { ... },
  "connections": [],
  "category": "automation",
  "tags": ["tag1", "tag2"],
  "isPublic": true
}
```

**Response:**
```json
{
  "template": { ... }
}
```

### Update Template
Update an existing template.

**Endpoint:** `PUT /api/templates/:id`

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "metadata": {
    "isPublic": true
  }
}
```

**Response:**
```json
{
  "template": { ... }
}
```

### Delete Template
Delete a template.

**Endpoint:** `DELETE /api/templates/:id`

**Response:**
```json
{
  "success": true
}
```

### Like Template
Like a template.

**Endpoint:** `POST /api/templates/:id/like`

**Response:**
```json
{
  "success": true,
  "template": { ... }
}
```

### Download Template
Increment download count for a template.

**Endpoint:** `POST /api/templates/:id/download`

**Response:**
```json
{
  "success": true,
  "template": { ... }
}
```

### Rate Template
Rate a template (1-5 stars).

**Endpoint:** `POST /api/templates/:id/rate`

**Request Body:**
```json
{
  "rating": 5
}
```

**Response:**
```json
{
  "success": true,
  "template": { ... }
}
```

---

## Webhooks

### Get All Webhooks
Get all webhooks for the authenticated user.

**Endpoint:** `GET /api/webhooks`

**Response:**
```json
{
  "webhooks": [
    {
      "id": "webhook_123",
      "name": "GitHub Webhook",
      "url": "https://github.com/webhook",
      "secret": "...",
      "events": ["push", "pull_request"],
      "authorId": "user_123",
      "active": true,
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ]
}
```

### Create Webhook
Create a new webhook.

**Endpoint:** `POST /api/webhooks`

**Request Body:**
```json
{
  "name": "GitHub Webhook",
  "url": "https://github.com/webhook",
  "secret": "my-secret-key",
  "events": ["push", "pull_request"]
}
```

**Response:**
```json
{
  "webhook": { ... }
}
```

### Delete Webhook
Delete a webhook.

**Endpoint:** `DELETE /api/webhooks/:id`

**Response:**
```json
{
  "success": true
}
```

### Trigger Webhook
Manually trigger a webhook.

**Endpoint:** `POST /api/webhooks/:id/trigger`

**Request Body:**
```json
{
  "event": "push",
  "payload": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "event": { ... }
}
```

### Incoming Webhook
Handle incoming webhooks from external services.

**Endpoint:** `POST /api/webhooks/incoming/:source`

**Headers:**
- `X-EDEN-Signature`: HMAC signature for verification

**Request Body:**
```json
{
  "event": "push",
  "data": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "event": { ... }
}
```

### Get Webhook Events
Get recent webhook events.

**Endpoint:** `GET /api/webhooks/events`

**Query Parameters:**
- `limit` (number): Maximum number of events to return (default: 50)

**Response:**
```json
{
  "events": [
    {
      "id": "event_123",
      "source": "github",
      "type": "push",
      "timestamp": 1234567890,
      "payload": { ... },
      "processed": true
    }
  ]
}
```

---

## System

### Get Health
Get server health status.

**Endpoint:** `GET /api/health` or `GET /api/system/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "1.0.0",
  "environment": "production",
  "uptime": 1234.56,
  "memory": { ... }
}
```

### Get Statistics
Get system statistics.

**Endpoint:** `GET /api/system/stats`

**Response:**
```json
{
  "stats": {
    "totalUsers": 100,
    "totalAgents": 500,
    "totalTemplates": 50,
    "totalWebhooks": 10,
    "totalWebhookEvents": 1000,
    "publicTemplates": 20
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

- 1000 requests per 15 minutes per IP
- API routes have additional rate limiting

---

## Categories

Available template categories:
- `all` - All categories
- `automation` - Automation workflows
- `data-processing` - Data processing pipelines
- `ai-assistants` - AI assistant agents
- `web-scraping` - Web scraping agents
- `chatbots` - Chatbot agents
- `analysis` - Data analysis agents
- `creative` - Creative agents
- `productivity` - Productivity tools
