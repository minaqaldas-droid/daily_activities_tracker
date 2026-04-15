# Superadmin Feature Setup Guide

## Overview
The superadmin feature allows designated users to:
- Edit the webapp name/title
- Upload and manage a custom logo
- Customize the primary color scheme (coming soon)

## Database Setup

### 1. Run Migration SQL
Execute the updated `SUPABASE_SETUP.sql` file in your Supabase SQL editor:

```sql
-- The script adds:
-- - role column to users table (user OR superadmin)
-- - settings table for storing webapp configuration
```

### 2. Create Superadmin Account

After the migration, create a superadmin user manually in Supabase:

Via Supabase Dashboard SQL:
```sql
-- Method 1: Update existing user
UPDATE users SET role = 'superadmin' WHERE email = 'admin@example.com';

-- Method 2: Insert new superadmin
INSERT INTO users (email, name, password, role) 
VALUES ('admin@example.com', 'Admin User', 'your_password_here', 'superadmin');

-- Initialize settings table with defaults
INSERT INTO settings (webapp_name, logo_url, primary_color) 
VALUES ('Daily Activities Tracker', '', '#667eea')
ON CONFLICT DO NOTHING;
```

## Features

### 1. Superadmin Badge
- Logged-in superadmin users see a "🔐 SUPERADMIN" badge in the header

### 2. Admin Settings Button
- Superadmin users have an "🔧 Admin Settings" button in the header
- Opens a modal for editing webapp configuration

### 3. Editable Settings

#### Webapp Name
- Change the title displayed in the header
- Applied immediately to all users after refresh

#### Logo URL
- Enter a public image URL (PNG, JPG, SVG)
- Must start with `http://` or `https://`
- Live preview available before saving
- Logo appears in header (max 60x60px)

#### Primary Color (Future)
- Color picker and hex input
- Used for buttons, links, and UI elements
- Affects branding across the app

## API Functions Added

### Supabase Client Functions

```typescript
// Get current webapp settings
getSettings(): Promise<Settings>

// Update settings (superadmin only)  
updateSettings(settings: Partial<Settings>, userId: string): Promise<Settings>

// Get all superadmin users
getSuperadminUsers(): Promise<User[]>
```

### Types Added

```typescript
interface Settings {
  id?: string
  webapp_name: string
  logo_url: string
  primary_color?: string
  updated_at?: string
  updated_by?: string
}

// User interface updated with role
interface User {
  role?: 'user' | 'superadmin'
  // ... other properties
}
```

## Usage Examples

### For End Users
1. Regular users cannot access superadmin features
2. Settings changes by superadmin apply globally after refresh
3. Logo and name update automatically in the header

### For Superadmin Users

#### Changing Webapp Name:
1. Login as superadmin
2. Click "🔧 Admin Settings"
3. Enter new name in "Webapp Name" field
4. Click "Save Settings"

#### Adding a Logo:
1. Click "🔧 Admin Settings"
2. Enter image URL in "Logo URL" field
3. Wait for preview to load
4. Click "Save Settings"

Example logo URLs:
```
https://cdn.example.com/logo.png
https://images.example.com/my-logo-512x512.jpg
https://storage.example.com/branding/icon.svg
```

## Component Files

### New Components
- **`src/components/SuperAdminPanel.tsx`** - Superadmin modal modal with settings form

### Updated Components
- **`src/App.tsx`** - Integrated superadmin state and settings loading
- **`src/supabaseClient.ts`** - Added Settings type and admin functions
- **`src/index.css`** - Added styles for logo, admin panel, color picker

### Updated Database
- **`SUPABASE_SETUP.sql`** - Added role column and settings table

## Security Considerations

⚠️ **This setup uses simple authentication (email/password in localStorage)**

For production, consider:
1. Implement proper JWT token-based authentication
2. Add row-level security (RLS) policies
3. Hash passwords using bcrypt
4. Implement role-based access control (RBAC)
5. Add audit logging for settings changes
6. Validate image URLs before storing

## Troubleshooting

### Logo not showing?
- Ensure URL is publicly accessible
- Check CORS policies of the image host
- Use absolute URLs (not relative paths)
- Test URL directly in browser

### Settings not updating?
- Check browser console for errors
- Verify user has superadmin role in database
- Ensure settings table exists in Supabase
- Check database connection

### Color picker not working on mobile?
- Use hex input field instead
- Format: #RRGGBB (e.g., #667eea)

## Future Enhancements

- [ ] Dynamic color theming (apply primary color to UI)
- [ ] Multiple themes (light/dark)
- [ ] Role-based user management interface
- [ ] Settings history/audit log
- [ ] Logo upload (vs. URL only)
- [ ] Favicon customization
- [ ] Custom email templates
- [ ] White-label support

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify database migrations were applied
3. Ensure user has superadmin role
4. Check Supabase logs for SQL errors
