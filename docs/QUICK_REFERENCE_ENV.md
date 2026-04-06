# Environment Configuration Quick Reference

## 🚀 Quick Start Commands

### Development
```bash
# Recommended for local development
npm run dev:local

# Alternative (same effect)
npm run dev
```

### Production Build & Deploy
```bash
# Build for production
npm run build

# Start production server (used in deployment)
npm start
```

## 🌐 URLs and Ports

| Environment | Frontend URL | API Server | Port |
|------------|--------------|------------|------|
| Development | http://localhost:5173 | http://localhost:3001 | Frontend: 5173<br>API: 3001 |
| Production | https://stacktracker.io | Same origin | 8080 |

## ⚠️ Critical Rules

### ✅ DO:
- Always use `npm run dev:local` for development
- Access dev site via http://localhost:5173
- Test thoroughly before deploying
- Keep `server/index.ts` stable

### ❌ DON'T:
- Modify production scripts without testing
- Access dev API directly (port 3001)
- Change `server/startup.ts` unnecessarily
- Commit sensitive credentials

## 📁 Key Files Structure

```
├── package.json          # NPM scripts
├── vite.config.ts       # Frontend build & dev server
├── server/
│   ├── startup.ts       # Entry point (both envs)
│   ├── index.ts        # Main server logic
│   └── auth/
│       ├── setup.ts    # Production auth
│       └── setup-simple.ts # Dev auth
└── scripts/
    └── dev-local.sh    # Dev environment script
```

## 🔧 Environment Variables

### Development
```bash
NODE_ENV=development
PORT=3001
SESSION_SECRET=dev-secret-change-this
```

### Production
- Managed by AWS Secrets Manager
- Loaded at runtime
- Has fallback mechanisms

## 🏥 Health Checks

- **Endpoint**: `/health`
- **Expected**: `{ "status": "ok" }`
- **Used by**: AWS App Runner
- **Frequency**: Every 30 seconds

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Proxy error in dev | Use http://localhost:5173, not :3001 |
| Auth not working | Check NODE_ENV=development is set |
| Build fails | Check all dependencies installed |
| Deploy fails | Verify health check endpoint works |

## 📝 Remember

1. **Development !== Production**
   - Different auth systems
   - Different session handling
   - Different error reporting

2. **Entry Points**
   - Both use `startup.ts`
   - Which loads `index.ts`
   - Keep this chain intact

3. **Deployment Safety**
   - Test locally first
   - Check health endpoints
   - Monitor AWS logs

---
*For detailed information, see [ENVIRONMENT_CONFIGURATION.md](./ENVIRONMENT_CONFIGURATION.md)* 