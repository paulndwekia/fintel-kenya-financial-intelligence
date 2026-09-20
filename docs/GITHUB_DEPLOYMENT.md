# GitHub and Production Deployment

This directory is prepared as the canonical Git repository for FINTEL.

Recommended repository name:

`fintel-kenya-financial-intelligence`

After creating the empty GitHub repository, connect and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/fintel-kenya-financial-intelligence.git
git push -u origin main
```

Never commit `.env` or production credentials.

GitHub Actions runs dependency installation, typechecking, tests, and the production build on pushes and pull requests to `main`.

`render.yaml` and `Dockerfile` provide the existing container deployment configuration. Verify the production database, CORS origin, AI provider credentials, and CBK scheduler configuration before enabling public traffic.
