# Multi-Tenant Architecture & Subscription Tiers

## Overview

The African Family Tree application is built as a **multi-tenant SaaS platform** where each family registers independently and gets their own isolated family tree with subscription-based access tiers.

## Registration Flow

### Family-First Registration
1. **User visits registration page**
2. **Enters family information:**
   - Family Name (required, must be unique)
   - Clan Name (optional)
   - Village/Town Origin (optional)
3. **Creates admin account:**
   - Full Name
   - Email (unique)
   - Password
   - Phone (optional)
4. **System automatically:**
   - Creates user account
   - Creates family with **FREE tier** subscription
   - Sets user as family admin
   - Logs user in and redirects to family tree

### Key Points
- **Family name must be unique** across the platform
- **First family is created during registration** (not separately)
- **All families start with FREE tier** by default
- Users can create **additional families** later (each gets free tier)

## Subscription Tiers

### FREE Tier (Default)
- **Max Persons:** 50
- **Max Documents:** 100
- **Max Storage:** 500 MB
- **Max Members:** 10
- **Max Stories:** 50
- **Tree Views:** Vertical, Horizontal, Timeline (no Radial)
- **Features:**
  - Basic tree visualization
  - Document uploads
  - Oral history recording
  - Family collaboration
  - ❌ No export
  - ❌ No API access
  - ❌ No priority support

### PREMIUM Tier
- **Max Persons:** 500
- **Max Documents:** 1,000
- **Max Storage:** 10 GB
- **Max Members:** 50
- **Max Stories:** 500
- **Tree Views:** All views including Radial
- **Features:**
  - ✅ All free features
  - ✅ PDF export
  - ✅ API access
  - ✅ Priority support
  - ✅ Advanced visualizations

### ENTERPRISE Tier
- **Max Persons:** Unlimited
- **Max Documents:** Unlimited
- **Max Storage:** Unlimited
- **Max Members:** Unlimited
- **Max Stories:** Unlimited
- **Tree Views:** All views
- **Features:**
  - ✅ All premium features
  - ✅ Custom branding
  - ✅ Dedicated support
  - ✅ Custom integrations

## Tier Limit Enforcement

### Automatic Checks
The system automatically checks tier limits before:
- Creating a new person
- Uploading a document
- Inviting a family member
- Creating a story
- Uploading files (storage check)

### Error Responses
When a limit is reached, the API returns:
```json
{
  "error": "Tier limit reached for [resource]",
  "current": 50,
  "limit": 50,
  "tier": "free",
  "upgrade_required": true
}
```

### Usage Tracking
- Real-time usage calculation
- Displayed in Family Settings
- Updates automatically as resources are added/removed

## Database Schema

### Families Table
```sql
subscription_tier VARCHAR(50) DEFAULT 'free'
subscription_status VARCHAR(50) DEFAULT 'active'
subscription_start_date TIMESTAMP
subscription_end_date TIMESTAMP
max_persons INTEGER DEFAULT 50
max_documents INTEGER DEFAULT 100
max_storage_mb INTEGER DEFAULT 500
max_members INTEGER DEFAULT 10
```

### Subscription Status
- **active** - Normal operation
- **suspended** - Temporarily disabled
- **cancelled** - Subscription ended

## API Endpoints

### Registration
```
POST /api/auth/register
Body: {
  email, password, full_name, phone,
  family_name, clan_name, village_origin
}
```

### Get Family with Usage
```
GET /api/families/:familyId
Response includes:
- Family details
- Members list
- Usage statistics
- Tier limits
```

## Frontend Integration

### Registration Page
- Combined form for family + user account
- Family name validation
- Clear indication of free tier

### Family Settings
- Display current tier
- Show usage vs limits
- Upgrade prompts when limits reached

### Error Handling
- User-friendly error messages
- Upgrade suggestions when limits hit
- Usage warnings before limits

## Future Enhancements

### Planned Features
1. **Upgrade Flow**
   - Payment integration
   - Tier upgrade UI
   - Automatic limit increases

2. **Usage Alerts**
   - Email notifications at 80% usage
   - Dashboard warnings
   - Upgrade prompts

3. **Trial Periods**
   - Premium trial for new families
   - Time-limited access to premium features

4. **Billing Management**
   - Subscription management
   - Payment history
   - Invoice generation

## Configuration

Tier limits are configured in:
```
backend/src/config/tiers.js
```

To modify limits, update the `TIER_LIMITS` object.

## Security Considerations

1. **Family Isolation**
   - Each family's data is isolated
   - Access controlled by family membership
   - No cross-family data access

2. **Tier Enforcement**
   - Server-side validation (never trust client)
   - Middleware checks on all resource creation
   - Database constraints where possible

3. **Subscription Status**
   - Active status checked on every request
   - Suspended families cannot add resources
   - Grace period for expired subscriptions (future)

## Migration Notes

For existing installations:
1. Run database migrations to add subscription fields
2. Existing families will default to FREE tier
3. Limits will be applied based on current tier
4. No data loss during migration

