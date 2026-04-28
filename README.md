# CropGuard Backend

REST API server for the CropGuard AI farmer mobile app.

## Setup

```bash
cd cropguard-backend
npm install
cp .env.example .env
# Edit .env and fill in your API keys
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `OPENWEATHERMAP_API_KEY` | OpenWeatherMap API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Liveness check |
| GET | /weather | Current weather |
| GET | /weather/forecast | 7-day forecast |
| GET | /risks | Risk levels |
| POST | /chat | AI chat proxy |
| GET | /alerts | List alerts |
| PATCH | /alerts/:id/acknowledge | Acknowledge alert |
| POST | /alerts/acknowledge-all | Acknowledge all |
| POST | /alerts/risk-check | Trigger risk check |
| GET | /soil | Soil nutrients |
| GET | /soil/health-score | Soil health score |
| GET | /soil/trend | 7-day trend |
| POST | /soil/test | Trigger soil test |
| GET | /soil/recommendations | AI recommendations |
| GET | /disease-zones | Outbreak zones |
| GET | /disease-zones/history | History events |
| GET | /disease-zones/prevention-tips | Prevention tips |
| GET | /profile | Farmer profile |
| PUT | /profile | Update profile |
| GET | /profile/stats | Farm stats |
| POST | /notifications/enable | Enable notifications |
| PUT | /notifications/preferences | Update preferences |
| GET | /notifications/preferences | Get preferences |
| GET | /activity | Today's activity feed |

## Running Tests

```bash
npm test
```
