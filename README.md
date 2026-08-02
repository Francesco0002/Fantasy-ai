# Fantasy AI

Fantasy AI è un'applicazione web per consultare e confrontare giocatori di
Fantacalcio, gestire un'asta completa e, nella prossima fase di sviluppo,
ricevere consigli sulla formazione durante la stagione.

Il progetto combina algoritmi deterministici, statistiche calcistiche e
configurazioni personalizzate della lega. L'intelligenza artificiale generativa
verrà usata per spiegare le raccomandazioni, non per sostituire i calcoli o
inventare dati mancanti.

Repository:
[github.com/Francesco0002/Fantasy-ai](https://github.com/Francesco0002/Fantasy-ai)

Applicazione:
[fantasy-ai-eight.vercel.app](https://fantasy-ai-eight.vercel.app)

## Stato del progetto

| Modulo | Stato |
|---|---|
| Consultazione e confronto giocatori | Completato |
| Registrazione e autenticazione | Completato |
| Persistenza PostgreSQL per utente | Completato |
| Modalità Asta | Completata e coperta da test |
| Modalità Stagione Classic | Prossima fase di sviluppo |
| Dati calcistici reali aggiornati | Integrazione da completare |
| Assistente AI esplicativo | Pianificato |

Il listone attualmente usato dall'interfaccia è ancora un dataset dimostrativo
di 84 giocatori sintetici. Prima dell'uso reale dovrà essere sostituito da dati
completi, aggiornati e utilizzabili secondo la licenza della fonte.

## Funzionalità disponibili

### Giocatori

- ricerca per nome o squadra;
- filtro per ruolo `P`, `D`, `C`, `A`;
- ordinamento predefinito per ruolo e punteggio Fantasy AI;
- ordinamento per score, prezzo, titolarità, rischio infortunio e nome;
- scheda di dettaglio;
- confronto tra due giocatori;
- classifica generale e classifica interna al ruolo;
- intervallo di prezzo consigliato e tetto massimo.

### Account

- registrazione e login;
- sessione tramite cookie HttpOnly;
- persistenza dell'accesso dopo il ricaricamento;
- isolamento delle aste per utente;
- logout.

### Modalità Asta

- creazione e gestione di più aste;
- configurazione di partecipanti, budget, rosa e regole della lega;
- bonus, malus, modificatori difesa e centrocampo;
- strategia automatica o distribuzione manuale del budget;
- modalità ruolo per ruolo o chiamata totalmente casuale;
- registrazione degli acquisti propri e degli avversari;
- rimozione degli acquisti;
- aggiornamento di crediti, slot, budget di reparto e offerta massima;
- prezzi contestuali adattati all'andamento dell'asta;
- valutazione dell'acquisto e alternative disponibili;
- rinomina, conclusione, consultazione in sola lettura e riapertura;
- eliminazione separata e protetta da conferma grafica;
- salvataggio persistente in PostgreSQL.

La segnalazione `Da evitare` resta visibile quando il prezzo è poco conveniente,
ma non richiede una seconda conferma. Restano invece vincolanti i controlli che
impediscono di superare il budget o di non conservare i crediti minimi necessari
per completare la rosa.

## Prossima fase: Modalità Stagione

La prima versione supporterà il Fantacalcio Classic. L'utente potrà configurare
la lega, importare la propria rosa da un'asta completata oppure inserirla
manualmente e richiedere la formazione per una giornata.

Il sistema dovrà:

- escludere squalificati e indisponibili certi;
- valutare infortunati e giocatori in dubbio;
- considerare probabilità di titolarità e di subentro;
- rispettare i moduli consentiti e le regole delle sostituzioni;
- valutare avversario e difficoltà della partita;
- proporre la formazione con il punteggio atteso migliore;
- ordinare la panchina;
- mostrare alternative e fattori di rischio;
- spiegare il motivo di ogni scelta e il livello di confidenza.

La rosa importata verrà copiata nella lega stagionale e potrà poi cambiare in
modo indipendente per scambi e mercato di riparazione.

## Architettura

```text
Browser
  ↓
Next.js su Vercel
  ↓ /api/backend/*
Proxy same-origin Next.js
  ↓
FastAPI su Render
  ↓
PostgreSQL
```

Il browser non chiama direttamente Render. Tutte le richieste frontend passano
dal proxy:

```text
frontend/app/api/backend/[...path]/route.ts
```

Il proxy inoltra percorso, query, intestazioni, corpo e cookie usando la
variabile server-only `BACKEND_API_URL`.

## Tecnologie

### Frontend

- Next.js 16 con App Router;
- React 19;
- TypeScript;
- Tailwind CSS;
- ESLint;
- Node Test Runner per i test strategici.

### Backend

- Python;
- FastAPI e Uvicorn;
- SQLAlchemy;
- Alembic;
- PostgreSQL con Psycopg 3;
- JWT e cookie HttpOnly;
- Argon2 per le password;
- Pandas e NumPy per la pipeline dati.

### Hosting

- frontend su Vercel;
- backend su Render;
- deploy automatico dopo il push su `main`.

## Struttura principale

```text
fantasy-ai/
├── alembic/
│   └── versions/              # Migrazioni del database
├── backend/
│   ├── main.py                # App FastAPI e API giocatori
│   ├── auth_routes.py         # Registrazione, login e sessione
│   ├── auction_routes.py      # API della Modalità Asta
│   ├── models.py              # Modelli SQLAlchemy
│   ├── schemas.py             # Schemi Pydantic
│   ├── valuation.py           # Score proprietario
│   ├── pricing.py             # Prezzi d'asta
│   ├── providers/             # Importazione e normalizzazione dati
│   └── tests/                 # Test backend
├── config/
│   └── league_config.json     # Configurazione base della lega
├── data/
│   ├── players.csv
│   ├── player_valuations.csv
│   └── player_prices.csv
├── frontend/
│   ├── app/                   # Route Next.js
│   ├── components/            # UI condivisa
│   ├── hooks/                 # Stato e chiamate applicative
│   ├── lib/                   # API, strategia e calcoli d'asta
│   ├── tests/                 # Test strategici frontend
│   └── types/                 # Tipi TypeScript
├── PROJECT_CONTEXT.md         # Stato tecnico dettagliato
└── README.md
```

Il frontend usa direttamente la cartella `app` e non contiene una cartella
`src`.

## Requisiti locali

- Python compatibile con le dipendenze di `backend/requirements.txt`;
- Node.js e npm;
- PostgreSQL locale oppure un database PostgreSQL raggiungibile;
- Git.

## Configurazione locale

### 1. Clonare il repository

```powershell
git clone https://github.com/Francesco0002/Fantasy-ai.git
cd Fantasy-ai
```

### 2. Preparare il backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirements.txt
```

Nella root del progetto creare `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
AUTH_JWT_SECRET=replace_with_a_secure_random_secret
AUTH_ACCESS_TOKEN_MINUTES=720
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=lax
```

Non committare `.env`, segreti JWT o credenziali del database.

Applicare le migrazioni:

```powershell
python -m alembic upgrade head
```

Avviare FastAPI dalla root:

```powershell
python -m uvicorn backend.main:app --reload
```

Backend e documentazione interattiva:

```text
http://localhost:8000
http://localhost:8000/docs
```

### 3. Preparare il frontend

```powershell
cd frontend
npm install
```

Creare `frontend/.env.local`:

```env
BACKEND_API_URL=http://localhost:8000
```

`BACKEND_API_URL` è una variabile server-only: non usare il prefisso
`NEXT_PUBLIC_`.

Avviare Next.js:

```powershell
npm run dev
```

Frontend locale:

```text
http://localhost:3000
```

Usare sempre `localhost` per entrambi i servizi, senza alternarlo con
`127.0.0.1`, per evitare problemi con i cookie.

## Preparazione dei dati dimostrativi

Dalla root del progetto:

```powershell
python .\backend\check_players.py
python .\backend\check_league_config.py
python .\backend\valuation.py
python .\backend\pricing.py
```

La pipeline produce:

```text
data/players.csv
  ↓ validazione
data/player_valuations.csv
  ↓ calcolo prezzi
data/player_prices.csv
```

Lo score proprietario è calcolato separatamente per ruolo e combina rendimento,
titolarità, bonus, affidabilità e potenziale. Il motore prezzi usa score, budget,
numero di partecipanti, slot, distribuzione per reparto e copertura del listone.

## API principali

### Servizio e giocatori

```http
GET /health
GET /health/database
GET /players
GET /players/{player_id}
```

`GET /players` supporta `role`, `search` e `limit`.

### Autenticazione

```http
POST /auth/register
POST /auth/login
GET  /auth/me
POST /auth/logout
```

### Aste

```http
GET    /auction-sessions
POST   /auction-sessions
GET    /auction-sessions/{session_id}
PATCH  /auction-sessions/{session_id}
DELETE /auction-sessions/{session_id}

GET    /auction-sessions/{session_id}/contextual-prices
POST   /auction-sessions/{session_id}/purchases
DELETE /auction-sessions/{session_id}/purchases/{player_id}
```

Le API d'asta sono protette e ogni query è filtrata anche per l'identificativo
dell'utente autenticato.

## Test e controlli

Test backend, dalla root:

```powershell
python -m unittest discover -s backend/tests -v
```

Test strategici frontend:

```powershell
cd frontend
npm run test:auction
```

Lint e build di produzione:

```powershell
npm run lint
npm run build
```

La suite attuale comprende:

- 4 test backend per aggiornamento, rinomina e stato delle aste;
- 9 test frontend per budget, modificatori, redistribuzione, modalità d'asta,
  valutazione del prezzo e crediti minimi.

`frontend/next-env.d.ts` è generato da Next.js e non deve essere incluso nei
commit se la build lo modifica localmente.

## Deploy

### Render

Build command:

```text
pip install -r backend/requirements.txt && python -m alembic upgrade head
```

Start command:

```text
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

Variabili principali:

```env
DATABASE_URL=...
AUTH_JWT_SECRET=...
AUTH_ACCESS_TOKEN_MINUTES=720
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
```

### Vercel

Variabile per Production e Preview:

```env
BACKEND_API_URL=https://fantasy-ai-api.onrender.com
```

Dopo ogni push attendere che Render sia `Live` e Vercel sia `Ready`, quindi
verificare login, persistenza, creazione e ripresa dell'asta, acquisti,
conclusione, riapertura, rinomina ed eliminazione.

## Roadmap

### Fase 1 — Fondamenta e Modalità Asta

- [x] dataset e validazione iniziali;
- [x] score proprietario e prezzi d'asta;
- [x] API giocatori, dettaglio e confronto;
- [x] autenticazione e PostgreSQL;
- [x] configurazione completa della lega;
- [x] più aste indipendenti per utente;
- [x] acquisti propri e degli avversari;
- [x] budget dinamico, consigli e alternative;
- [x] conclusione, sola lettura, riapertura e rinomina;
- [x] test automatici della strategia e delle API di aggiornamento.

### Fase 2 — Modalità Stagione Classic

- [ ] modelli database e migrazioni per lega e rosa;
- [ ] creazione e configurazione della lega stagionale;
- [ ] importazione rosa da un'asta completata;
- [ ] inserimento e modifica manuale della rosa;
- [ ] schema normalizzato dei dati della giornata;
- [ ] gestione di indisponibili, squalificati, infortunati e dubbi;
- [ ] ottimizzatore deterministico dei moduli e dei titolari;
- [ ] panchina ordinata e alternative;
- [ ] motivazioni, rischi e confidenza;
- [ ] test e verifica in produzione.

Le prime entità previste sono:

```text
SeasonLeague
SeasonRosterPlayer
SeasonLineup
SeasonLineupPlayer
```

### Fase 3 — Dati reali

- [ ] fonti con licenza compatibile;
- [ ] anagrafica e identificativi normalizzati;
- [ ] statistiche storiche complete;
- [ ] calendario e difficoltà delle partite;
- [ ] aggiornamento di infortuni e squalifiche;
- [ ] stima proprietaria di titolarità e subentro;
- [ ] tracciamento di fonte, timestamp e qualità del dato.

### Fase 4 — AI e funzionalità avanzate

- [ ] spiegazioni in linguaggio naturale;
- [ ] assistente conversazionale;
- [ ] riepilogo settimanale della rosa;
- [ ] analisi di scambi e mercato di riparazione;
- [ ] supporto Mantra dopo la stabilizzazione della modalità Classic.

## Principi del progetto

- le decisioni numeriche devono essere riproducibili e testabili;
- l'AI spiega i risultati, ma non sostituisce il motore di calcolo;
- i dati mancanti devono essere dichiarati, non inventati;
- ogni dato futuro deve conservare fonte e data di aggiornamento;
- i payload dei provider devono essere convertiti in uno schema interno comune;
- le informazioni e le aste di utenti diversi devono restare isolate;
- segreti e credenziali non devono mai essere salvati nel repository.

Per lo stato tecnico dettagliato e le regole da seguire nelle prossime sessioni
di sviluppo, consultare [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).
