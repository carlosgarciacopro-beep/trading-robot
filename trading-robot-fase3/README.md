# Trading Robot Fase 3

Esta versión hace:
- Análisis por ticker
- Scanner de varios activos
- Ranking del mejor setup
- Entradas CALL/PUT, stops, targets, RSI, EMAs, MACD, soporte/resistencia
- Alertas por WhatsApp opcionales con Twilio

## Uso fácil
1. Copia `.env.local.example` y renómbralo a `.env.local`.
2. Pega tus llaves:
   - ANTHROPIC_API_KEY
   - ALPHA_VANTAGE_API_KEY
3. Instala:
   npm install
4. Prende:
   npm run dev
5. Abre:
   http://localhost:3000

## Importante
Esto NO ejecuta operaciones ni reemplaza tu criterio. Es educativo y sirve como scanner/copiloto.
