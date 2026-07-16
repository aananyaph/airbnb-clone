# Deployment

This app is an Express/MongoDB app. Deploy it as a web service, not as a static site.

## Required Environment Variables

- `NODE_ENV=production`
- `ATLASDB_URL`
- `SECRET`
- `CLOUD_NAME`
- `CLOUD_API_KEY`
- `CLOUD_API_SECRET`

Use `.env.example` as the local reference. Do not commit a real `.env` file.

## Render

1. Push this project folder to GitHub.
2. In Render, create a new Web Service from that repo.
3. Use:
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`
4. Add the required environment variables above.

This repo also includes `render.yaml`, so Render can create the service from the Blueprint flow.

## Railway

1. Create a new Railway project from the GitHub repo or run the Railway CLI from this folder.
2. Set the required environment variables above.
3. Railway should detect Node automatically. If it asks for commands, use:
   - Build Command: `npm ci`
   - Start Command: `npm start`

## MongoDB Atlas

In MongoDB Atlas, add the deployment platform's outbound IPs to Network Access, or allow access from anywhere for a class/demo deployment. Make sure the database user in `ATLASDB_URL` has read/write access.