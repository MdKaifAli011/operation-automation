# Lead Import API Documentation

This API allows external applications to import lead data into the operation-automation CRM system.

## Endpoint

**POST** `/api/leads/import`

## Authentication

The API supports two authentication methods:

### 1. Session-based Authentication (Internal Use)
- Requires a valid `auth-token` cookie from a logged-in session
- Same authentication used for the main dashboard

### 2. API Key Authentication (External Apps)
- Set `LEAD_IMPORT_API_KEY` in your `.env` file
- Send the key in the `x-api-key` header
- Recommended for external applications

**Example header:**
```
x-api-key: your-secure-api-key-here
```

## Request Body

### Required Fields
- `studentName` (string) - Student's full name

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `parentName` | string | "" | Parent's name |
| `phone` | string | "" | Phone number |
| `email` | string | "" | Student email |
| `parentEmail` | string | "" | Parent email |
| `grade` | string | "12th" | Student grade |
| `targetExams` | array | [] | Array of exam names (e.g., ["NEET", "JEE"]) |
| `country` | string | "India" | Country |
| `dataType` | string | "Organic" | Lead source type |
| `sheetTab` | string | "ongoing" | Lead sheet tab (today, ongoing, followup, not_interested, converted) |
| `rowTone` | string | "new" | Lead tone (interested, not_interested, followup_later, new, called_no_response) |
| `followUpDate` | string | null | Follow-up date (YYYY-MM-DD format) |
| `date` | string | today | Lead creation date (YYYY-MM-DD format) |
| `workspaceNotes` | string | "" | Team notes |
| `activityLog` | array | [] | Activity log entries |
| `callHistory` | array | [] | Call history entries |
| `notInterestedRemark` | string | null | Remark when marked not interested (max 2000 chars) |
| `pipelineSteps` | number | 0 | Pipeline step (0-4) |
| `pipelineMeta` | object | {} | Pipeline metadata (see below) |

### Pipeline Meta Structure

The `pipelineMeta` object contains the following optional sections:

#### Demo Block
```json
{
  "demo": {
    "rows": [
      {
        "examValue": "NEET",
        "subject": "Physics",
        "teacher": "John Smith",
        "studentTimeZone": "Asia/Kolkata",
        "status": "Scheduled",
        "isoDate": "2024-12-31T10:00:00.000Z",
        "timeHmIST": "10:00",
        "inviteSent": false,
        "meetRowId": "",
        "meetLinkUrl": ""
      }
    ],
    "lastInviteSharedAt": null,
    "lastInviteSummary": ""
  }
}
```

#### Brochure Block
```json
{
  "brochure": {
    "notes": "",
    "fileName": null,
    "storedFileUrl": null,
    "documentUrl": "",
    "generated": false,
    "sentWhatsApp": false,
    "sentEmail": false
  }
}
```

#### Fees Block
```json
{
  "fees": {
    "scholarshipPct": 0,
    "installmentEnabled": false,
    "installmentCount": 2,
    "currency": "INR",
    "baseTotal": 0,
    "finalFee": 0,
    "targetExamValue": "",
    "courseDuration": "",
    "customCourseName": "",
    "feeSentWhatsApp": false,
    "feeSentEmail": false,
    "enrollmentSent": false
  }
}
```

#### Schedule Block
```json
{
  "schedule": {
    "view": "table",
    "scheduleSentWhatsApp": false,
    "scheduleSentEmail": false,
    "classes": [],
    "weekLabel": "",
    "templateId": null,
    "programmeOverview": {},
    "weeklySessionStructure": [],
    "milestones": [],
    "guidelines": {}
  }
}
```

#### Student Report Block
```json
{
  "studentReport": {
    "pdfUrl": null,
    "fileName": null,
    "generatedAt": null,
    "source": "teacher_feedback",
    "additionalNotes": "",
    "recommendations": "",
    "sendConfirmedAt": null
  }
}
```

#### Documents Block
```json
{
  "documents": {
    "items": [
      {
        "key": "report",
        "title": "Student Report",
        "countLabel": "",
        "status": "",
        "sentAt": null,
        "isCustom": false,
        "documentUrl": null,
        "storedFileUrl": null,
        "fileName": null
      }
    ]
  }
}
```

## Response

### Success (201 Created)
```json
{
  "success": true,
  "lead": {
    "id": "lead_id_here",
    "studentName": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "sheetTab": "ongoing",
    "rowTone": "new",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error (400 Bad Request)
```json
{
  "error": "studentName is required"
}
```

### Error (401 Unauthorized)
```json
{
  "error": "Unauthorized. Provide valid auth-token cookie or x-api-key header."
}
```

### Error (500 Internal Server Error)
```json
{
  "error": "Internal server error"
}
```

## Example Requests

### cURL (API Key)
```bash
curl -X POST "http://your-domain.com/api/leads/import" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secure-api-key" \
  -d '{
    "studentName": "John Doe",
    "parentName": "Jane Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "parentEmail": "parent@example.com",
    "grade": "12th",
    "targetExams": ["NEET", "JEE"],
    "country": "India",
    "dataType": "Organic",
    "sheetTab": "ongoing",
    "rowTone": "new",
    "followUpDate": "2024-12-31",
    "workspaceNotes": "Imported from external CRM",
    "activityLog": [
      {
        "at": "2024-01-01T10:00:00.000Z",
        "kind": "import",
        "message": "Lead imported from external application"
      }
    ],
    "pipelineMeta": {
      "demo": { "rows": [] },
      "brochure": {},
      "fees": {},
      "schedule": {}
    }
  }'
```

### JavaScript (Fetch)
```javascript
const response = await fetch('http://your-domain.com/api/leads/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-secure-api-key'
  },
  body: JSON.stringify({
    studentName: 'John Doe',
    phone: '+919876543210',
    email: 'john@example.com',
    grade: '12th',
    targetExams: ['NEET'],
    sheetTab: 'ongoing',
    rowTone: 'new'
  })
});

const data = await response.json();
console.log(data);
```

### Python (Requests)
```python
import requests

url = "http://your-domain.com/api/leads/import"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "your-secure-api-key"
}

data = {
    "studentName": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "grade": "12th",
    "targetExams": ["NEET"],
    "sheetTab": "ongoing",
    "rowTone": "new"
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

## Setup Instructions

### 1. Set API Key (Optional)
Add to your `.env` file:
```env
LEAD_IMPORT_API_KEY=your-secure-random-key-min-32-chars
```

### 2. Test the Endpoint
```bash
# Get schema
curl "http://your-domain.com/api/leads/import"

# Test import
curl -X POST "http://your-domain.com/api/leads/import" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secure-api-key" \
  -d '{"studentName": "Test Lead"}'
```

### 3. Integrate with Your Application
Use the example code above to integrate the API into your external application.

## Notes

- The API automatically merges `pipelineMeta` data using the `mergePipelineMeta` function
- All dates should be in ISO 8601 format or YYYY-MM-DD for date fields
- Phone numbers should include country code (e.g., +91 for India)
- Email validation is not enforced on import, but the dashboard only allows @testprepkart.com for internal users
- The API creates a new lead entry in the `leads` collection in MongoDB
- Activity log entries are automatically added to track the import

## Security Best Practices

1. Use a strong, random API key (32+ characters)
2. Never commit the API key to version control
3. Use HTTPS in production
4. Rotate API keys periodically
5. Monitor API usage and implement rate limiting if needed
6. Validate all input data on your end before sending to the API
