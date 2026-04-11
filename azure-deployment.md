# Azure Deployment Guide (Frontend + Express API + Mongo on Azure)

Walk-through for a first-time DevOps engineer to deploy the Event Management app with Azure CLI only. Covers React static frontend, Express backend, and MongoDB (Cosmos DB Mongo API).

## Prerequisites
- Installed locally: Node.js v18+, npm, git, zip, Azure CLI.
- Verify: `az version`, `node -v`, `npm -v`, `git status`.
- Sign in and pick the right subscription:
  ```bash
  az login
  az account set --subscription "<SUBSCRIPTION_NAME_OR_ID>"
  ```

## Repo sanity checks (run once)
- Backend must listen on `process.env.PORT` (change default 3000 to `process.env.PORT || 8080` if needed).
- Frontend must read API base URL from `REACT_APP_API_BASE_URL`.
- Smoke locally before deploying:
  ```bash
  cd event-management-backend && npm install && npm start   # or npm run dev
  cd ../event-management-frontend && npm install && npm start
  ```

## Naming variables (adjust LOCATION/region)
```bash
RG=event-rg
LOCATION=eastus
STORAGE=eventstatic$RANDOM
COSMOS=eventmongo$RANDOM
PLAN=event-plan
WEBAPP=event-api-$RANDOM
FRONT_ENV=https://$WEBAPP.azurewebsites.net
```

## 1) Resource Group
```bash
az group create -n $RG -l $LOCATION
```

## 2) Cosmos DB (Mongo API)
```bash
az cosmosdb create -n $COSMOS -g $RG --kind MongoDB --server-version 4.2
az cosmosdb mongodb database create -n eventsdb --account-name $COSMOS -g $RG
az cosmosdb mongodb collection create -n events --account-name $COSMOS -g $RG \
  --database-name eventsdb --throughput 400 --shard _id
MONGO_URI=$(az cosmosdb keys list -n $COSMOS -g $RG --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv)
```
- Keep `MONGO_URI` secret. Optional: create a dedicated DB user/password instead of the primary key.

## 3) App Service for Express API
```bash
az appservice plan create -n $PLAN -g $RG --sku B1 --is-linux
az webapp create -n $WEBAPP -g $RG --plan $PLAN --runtime "NODE|18-lts"
az webapp config appsettings set -n $WEBAPP -g $RG --settings \
  MONGO_URI="$MONGO_URI" NODE_ENV=production PORT=8080
az webapp log config -g $RG -n $WEBAPP --web-server-logging filesystem
```

## 4) Package & deploy backend
```bash
cd event-management-backend
npm install
npm test   # optional but recommended
zip -r ../backend.zip . -x "node_modules/*" ".git/*"
az webapp deployment source config-zip -g $RG -n $WEBAPP --src ../backend.zip
cd ..
```
- If deploy fails, tail logs: `az webapp log tail -g $RG -n $WEBAPP`.

## 5) Build & publish frontend (Static Website)
```bash
cd event-management-frontend
export REACT_APP_API_BASE_URL=$FRONT_ENV
npm install
npm run build
cd ..

az storage account create -n $STORAGE -g $RG -l $LOCATION --sku Standard_LRS --kind StorageV2 --https-only true
az storage blob service-properties update --account-name $STORAGE --static-website \
  --index-document index.html --error-document index.html
az storage blob upload-batch --account-name $STORAGE --auth-mode login \
  -s event-management-frontend/build -d '$web'
FRONT_URL=$(az storage account show -n $STORAGE -g $RG --query "primaryEndpoints.web" -o tsv)
echo "Frontend live at $FRONT_URL"
```

## 6) Wire CORS (frontend → backend)
```bash
az webapp cors add -g $RG -n $WEBAPP --allowed-origins $FRONT_URL
```
- If using cookies, also set `--allowed-credentials true` and configure same-site/secure flags in code.

## 7) Smoke tests
```bash
curl https://$WEBAPP.azurewebsites.net/health          # add a /health route if missing
curl -H "Origin: $FRONT_URL" https://$WEBAPP.azurewebsites.net/api/events
open $FRONT_URL                                       # UI should call the API successfully
```

## Optional enhancements
- Application Insights (logs/metrics):
  ```bash
  az monitor app-insights component create -g $RG -l $LOCATION -a event-insights
  KEY=$(az monitor app-insights component show -g $RG -a event-insights --query instrumentationKey -o tsv)
  az webapp config appsettings set -g $RG -n $WEBAPP --settings APPINSIGHTS_INSTRUMENTATIONKEY=$KEY
  ```
- Custom domain & HTTPS: `az webapp config hostname add …`; for static site, front with Azure CDN/Front Door.
- Autoscale (prod): `az monitor autoscale create …` targeting the App Service plan.
- CI/CD: GitHub Actions with `azure/login`, `azure/webapps-deploy` (backend), and `az storage blob upload-batch` (frontend). Store secrets (`AZURE_CREDENTIALS`, `MONGO_URI`) in repo secrets.

## Cleanup
```bash
az group delete -n $RG
```

## Common pitfalls
- Backend must bind to `process.env.PORT` (do not hardcode 3000).
- Rebuild frontend anytime `REACT_APP_API_BASE_URL` changes, then re-upload.
- Set CORS after you know the static site URL.
- Static site 403/404: confirm upload went to `$web` and static website is enabled.
- 500s on API: check `az webapp log tail`.
