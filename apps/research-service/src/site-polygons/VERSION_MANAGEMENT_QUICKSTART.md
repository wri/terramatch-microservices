# Version Management API - Quick Start

## Overview

Manage polygon versions through RESTful endpoints. Both admins and project developers can view and activate versions.

---

## Endpoints

### 1. List All Versions

```http
GET /research/v3/sitePolygons/{uuid}/versions
```

**Returns**: All versions of a polygon (newest first)

**Example**:

```bash
curl -X GET \
  http://localhost:3000/research/v3/sitePolygons/abc-123/versions \
  -H "Authorization: Bearer <token>"
```

---

### 2. Activate a Version

```http
PATCH /research/v3/sitePolygons/{uuid}
```

**Body**:

```json
{
  "data": {
    "type": "sitePolygons",
    "id": "{uuid}",
    "attributes": {
      "isActive": true,
      "comment": "Optional comment"
    }
  }
}
```

**Example**:

```bash
curl -X PATCH \
  http://localhost:3000/research/v3/sitePolygons/version-2-uuid \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "sitePolygons",
      "id": "version-2-uuid",
      "attributes": {
        "isActive": true,
        "comment": "Reverting to previous version"
      }
    }
  }'
```

---

### 3. Delete All Versions

```http
DELETE /research/v3/sitePolygons/{uuid}
```

**Note**: Deletes ALL versions in the version group.

---

## Typical Workflow

1. **View versions**: `GET /:uuid/versions`
2. **Select version to activate**: Review list
3. **Activate version**: `PATCH /:uuid` with `isActive: true`
4. **Verify**: Check `GET /:uuid` shows activated version

---

## Authorization

- **List versions**: Read permission
- **Activate version**: Update permission (admins + project developers)
- **Delete versions**: Delete permission

---

## Key Features

✅ RESTful design (resource-oriented)  
✅ Transaction-safe activation  
✅ Automatic deactivation of other versions  
✅ Optional comment tracking  
✅ Full audit trail in `polygon_updates`  
✅ JSON:API compliant

---

## Notes

- Only `isActive: true` supported in PATCH
- Use DELETE to remove versions
- Comment is optional but recommended
- All changes tracked in audit table
