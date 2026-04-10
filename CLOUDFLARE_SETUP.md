# Cloudflare Pages Deployment Guide

This project is now configured for deployment on Cloudflare Pages instead of Netlify.

## Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (free tier available)
- GitHub repository connected to Cloudflare

## Setup Steps

### 1. Install Wrangler CLI (Optional - for local testing)

```bash
npm install -g @cloudflare/wrangler
```

### 2. Configure wrangler.toml

Update the `wrangler.toml` file with your Cloudflare details:
- `account_id`: Your Cloudflare Account ID (found in Workers & Pages dashboard)
- `zone_id`: Your domain zone ID (if using custom domain)
- Update `route` with your domain

### 3. Deploy to Cloudflare Pages

#### Option A: GitHub Integration (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **Pages**
3. Click **Create application** > **Connect to Git**
4. Select your GitHub repository
5. Configure build settings:
   - **Framework preset**: `Vite` (or None)
   - **Production branch**: `main` (or your main branch)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. **IMPORTANT - Deploy settings**:
   - Leave **Deploy command** EMPTY (don't set any custom deploy command)
7. Add Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
8. Click **Save and Deploy**

#### Option B: Using Wrangler Pages CLI

```bash
# Build locally
npm run build

# Login to Cloudflare (first time only)
npx wrangler login

# Deploy to Pages
npx wrangler pages deploy dist
```

## Configuration Files

### wrangler.toml
Main configuration file for Cloudflare Pages. Update with your account details.

### _redirects
Handles SPA routing - all requests are redirected to index.html for React Router to handle.

## Environment Variables

Set these in the Cloudflare Pages dashboard (Settings > Environment Variables):
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Deployment Status

Once deployed, your site will be available at:
- `https://[project-name].pages.dev` (default)
- `https://your-custom-domain.com` (if configured)

## Features

- ✅ Automatic deployments on GitHub push
- ✅ Preview deployments for pull requests
- ✅ Edge runtime performance
- ✅ Global CDN distribution
- ✅ Zero cold starts

## Troubleshooting

### Build failures
- Verify `npm run build` works locally
- Check environment variables are set correctly
- Review build logs in Cloudflare dashboard

### 404 errors on page refresh
- The `_redirects` file ensures SPA routing works
- Make sure `dist` directory is the build output

### Database connection issues
- Verify Supabase credentials in environment variables
- Check Supabase project settings and network permissions

## Further Help

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Vite Documentation](https://vitejs.dev/)
- [Supabase Documentation](https://supabase.com/docs)
