PER ATTIVARE .venv:
.venv\Scripts\Activate.ps1

Terminale 1 — Backend
python -m uvicorn backend.main:app --reload

Terminale 2 — Frontend
cd frontend
npm run dev

# Fantasy AI

Fantasy AI è un progetto web pensato per supportare gli utenti durante l'asta del Fantacalcio e, in futuro, durante tutta la stagione fantacalcistica.

L'obiettivo è realizzare un sistema basato su dati e valutazioni proprietarie, capace di:

- analizzare le statistiche dei giocatori;
- assegnare uno score da 0 a 100;
- stimare un prezzo d'asta consigliato;
- adattare le valutazioni alle regole della lega;
- aiutare l'utente nella composizione della rosa;
- suggerire in futuro la miglior formazione settimanale;
- integrare un assistente AI per spiegare le raccomandazioni.

> Il progetto è attualmente in fase di sviluppo e utilizza giocatori e statistiche sintetiche a scopo dimostrativo.

---

## Stato attuale del progetto

La prima pipeline completa è funzionante:

```text
players.csv
    ↓
Validazione del dataset
    ↓
Calcolo dello score proprietario
    ↓
Calcolo dei prezzi d'asta
    ↓
API FastAPI
    ↓
Frontend Next.js
```

Le funzionalità attualmente disponibili sono:

- caricamento e validazione del dataset;
- controllo delle colonne obbligatorie;
- verifica dei ruoli dei giocatori;
- calcolo dello score proprietario;
- classifica generale e classifica per ruolo;
- configurazione personalizzata della lega;
- calcolo del prezzo d'asta consigliato;
- API REST per consultare i giocatori;
- ricerca per nome o squadra;
- filtro per ruolo;
- interfaccia web con schede dei giocatori.

---

## Tecnologie utilizzate

### Backend

- Python
- Pandas
- FastAPI
- Uvicorn

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Dati

- CSV per il prototipo iniziale
- JSON per la configurazione della lega

In futuro i file CSV potranno essere sostituiti da un database PostgreSQL.

---

## Struttura del progetto

```text
fantasy-ai/
│
├── backend/
│   ├── __init__.py
│   ├── check_players.py
│   ├── check_league_config.py
│   ├── valuation.py
│   ├── pricing.py
│   ├── main.py
│   └── requirements.txt
│
├── config/
│   └── league_config.json
│
├── data/
│   ├── players.csv
│   ├── player_valuations.csv
│   └── player_prices.csv
│
├── frontend/
│   ├── app/ oppure src/app/
│   ├── public/
│   ├── .env.local
│   ├── package.json
│   └── ...
│
├── .venv/
│
└── README.md
```

---

## Dataset

Il file principale è:

```text
data/players.csv
```

Il dataset iniziale contiene giocatori sintetici e statistiche simulate.

Ogni giocatore dispone di informazioni come:

- identificativo;
- nome;
- squadra;
- ruolo;
- età;
- presenze;
- partite da titolare;
- minuti giocati;
- gol;
- assist;
- clean sheet;
- gol subiti;
- parate;
- ammonizioni;
- espulsioni;
- rigori segnati;
- media voto;
- fantamedia;
- rischio infortunio;
- probabilità di titolarità;
- potenziale di crescita;
- livello sui calci piazzati.

Il campo:

```text
data_source
```

è impostato su:

```text
synthetic_demo
```

per indicare che i dati non provengono da una fonte calcistica reale.

---

## Algoritmo di valutazione

Il file:

```text
backend/valuation.py
```

calcola uno score proprietario da 0 a 100.

Lo score combina cinque componenti:

| Componente | Peso |
|---|---:|
| Rendimento | 30% |
| Titolarità | 25% |
| Bonus | 20% |
| Affidabilità | 15% |
| Potenziale | 10% |

La formula generale è:

```text
Overall Score =
    Performance Score × 0.30
    + Starting Score × 0.25
    + Bonus Score × 0.20
    + Reliability Score × 0.15
    + Potential Score × 0.10
```

Le statistiche vengono normalizzate separatamente per ruolo, evitando di confrontare direttamente portieri, difensori, centrocampisti e attaccanti.

L'esecuzione genera:

```text
data/player_valuations.csv
```

---

## Algoritmo dei prezzi d'asta

Il file:

```text
backend/pricing.py
```

trasforma lo score proprietario in crediti d'asta.

Il calcolo considera:

- score del giocatore;
- ruolo;
- budget iniziale;
- numero di partecipanti;
- numero di giocatori da acquistare per ruolo;
- distribuzione del budget tra i reparti;
- disponibilità dei giocatori nel listone;
- limite massimo di spesa per ruolo.

Per ogni giocatore vengono calcolati:

- `base_price`: valore iniziale non arrotondato;
- `recommended_min`: prezzo considerato conveniente;
- `recommended_price`: prezzo centrale consigliato;
- `recommended_max`: limite superiore ragionevole;
- `absolute_max`: prezzo oltre il quale fermarsi;
- `market_coverage`: completezza del listone;
- `price_rank`: posizione del giocatore nel proprio ruolo.

L'esecuzione genera:

```text
data/player_prices.csv
```

---

## Configurazione della lega

La configurazione è contenuta in:

```text
config/league_config.json
```

Esempio:

```json
{
  "league_name": "Lega di prova",
  "participants": 8,
  "budget_per_team": 500,
  "minimum_bid": 1,
  "mode": "classic",

  "roster_slots": {
    "P": 3,
    "D": 8,
    "C": 8,
    "A": 6
  },

  "budget_distribution": {
    "P": 0.08,
    "D": 0.16,
    "C": 0.26,
    "A": 0.50
  },

  "role_price_caps": {
    "P": 0.08,
    "D": 0.12,
    "C": 0.20,
    "A": 0.35
  },

  "score_exponent": 3.0,

  "price_range": {
    "minimum_multiplier": 0.90,
    "maximum_multiplier": 1.10,
    "absolute_max_multiplier": 1.20
  }
}
```

Il file viene validato da:

```text
backend/check_league_config.py
```

---

## Installazione del backend

### 1. Creare l'ambiente virtuale

Dalla cartella principale del progetto:

```powershell
python -m venv .venv
```

### 2. Attivare l'ambiente virtuale

Su Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Installare le dipendenze

```powershell
python -m pip install -r .\backend\requirements.txt
```

---

## Preparazione dei dati

Prima di avviare il backend è possibile rigenerare valutazioni e prezzi.

### Controllare il dataset

```powershell
python .\backend\check_players.py
```

### Controllare la configurazione della lega

```powershell
python .\backend\check_league_config.py
```

### Calcolare le valutazioni

```powershell
python .\backend\valuation.py
```

### Calcolare i prezzi

```powershell
python .\backend\pricing.py
```

---

## Avvio del backend

Dalla cartella principale:

```powershell
python -m uvicorn backend.main:app --reload
```

Il backend sarà disponibile su:

```text
http://127.0.0.1:8000
```

La documentazione interattiva delle API sarà disponibile su:

```text
http://127.0.0.1:8000/docs
```

---

## Endpoint disponibili

### Stato dell'applicazione

```http
GET /
```

### Controllo del servizio

```http
GET /health
```

### Elenco dei giocatori

```http
GET /players
```

Parametri disponibili:

| Parametro | Descrizione |
|---|---|
| `role` | Filtra per P, D, C oppure A |
| `search` | Cerca per nome o squadra |
| `limit` | Limita il numero di risultati |

Esempi:

```text
http://127.0.0.1:8000/players?role=A
```

```text
http://127.0.0.1:8000/players?search=Colombo
```

```text
http://127.0.0.1:8000/players?role=C&limit=5
```

### Dettaglio di un giocatore

```http
GET /players/{player_id}
```

Esempio:

```text
http://127.0.0.1:8000/players/1
```

---

## Installazione del frontend

Entrare nella cartella:

```powershell
cd .\frontend
```

Installare le dipendenze:

```powershell
npm install
```

Il file:

```text
frontend/.env.local
```

deve contenere:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## Avvio del frontend

Dentro la cartella `frontend`:

```powershell
npm run dev
```

Il sito sarà disponibile su:

```text
http://localhost:3000
```

Durante lo sviluppo devono essere attivi contemporaneamente due terminali.

### Terminale backend

```powershell
python -m uvicorn backend.main:app --reload
```

### Terminale frontend

```powershell
cd .\frontend
npm run dev
```

---

## Interfaccia attuale

La prima pagina del sito permette di:

- visualizzare i giocatori;
- cercare per nome;
- cercare per squadra;
- filtrare per ruolo;
- consultare lo score proprietario;
- vedere il ranking del giocatore;
- consultare prezzo conveniente, consigliato e massimo;
- visualizzare probabilità di titolarità;
- visualizzare rischio infortunio.

---

## Limitazioni attuali

La versione corrente presenta alcune limitazioni:

- i dati sono sintetici;
- il listone contiene solamente 84 giocatori;
- non sono ancora presenti dati aggiornati automaticamente;
- i coefficienti dell'algoritmo sono sperimentali;
- il sistema supporta soltanto il Fantacalcio Classic;
- non è ancora possibile registrare gli acquisti;
- non è ancora presente un database;
- non è ancora integrata un'intelligenza artificiale generativa;
- non è ancora disponibile la gestione settimanale della formazione.

---

## Roadmap

### Fase 1 — Motore d'asta

- [x] Dataset iniziale
- [x] Validazione dei dati
- [x] Score proprietario
- [x] Configurazione della lega
- [x] Prezzi d'asta
- [x] API FastAPI
- [x] Prima interfaccia Next.js
- [ ] Dettaglio completo del giocatore
- [ ] Registrazione degli acquisti
- [ ] Gestione del budget residuo
- [ ] Gestione delle rose degli avversari
- [ ] Aggiornamento dinamico dei prezzi
- [ ] Suggerimento delle alternative disponibili

### Fase 2 — Dati reali

- [ ] Individuazione di fonti con licenza compatibile
- [ ] Importazione delle rose reali
- [ ] Importazione delle statistiche storiche
- [ ] Gestione degli identificativi dei giocatori
- [ ] Aggiornamento di infortuni e squalifiche
- [ ] Stima proprietaria della titolarità

### Fase 3 — Gestione della stagione

- [ ] Creazione delle leghe
- [ ] Salvataggio delle rose
- [ ] Configurazione dei moduli
- [ ] Formazione consigliata
- [ ] Ordinamento della panchina
- [ ] Gestione degli indisponibili
- [ ] Ottimizzazione della formazione

### Fase 4 — Intelligenza artificiale

- [ ] Assistente conversazionale
- [ ] Confronto tra giocatori
- [ ] Spiegazione delle valutazioni
- [ ] Strategia personalizzata per l'asta
- [ ] Motivazione delle scelte di formazione
- [ ] Riepilogo settimanale della rosa

---

## Utilizzo dei dati

I dati presenti nella versione iniziale sono stati generati artificialmente e vengono utilizzati esclusivamente per sviluppare e testare il sistema.

Il progetto non utilizza scraping di siti fantacalcistici e non ripubblica dati proprietari di terze parti.

Prima di integrare dati calcistici reali sarà necessario verificare:

- licenza della fonte;
- possibilità di memorizzazione;
- possibilità di visualizzazione pubblica;
- possibilità di utilizzo commerciale;
- possibilità di creare valutazioni derivate;
- possibilità di utilizzare i dati come input per sistemi AI.

---

## Obiettivo finale

L'obiettivo finale è costruire un assistente fantacalcistico completo che supporti l'utente:

1. prima dell'asta;
2. durante l'asta;
3. nella gestione della rosa;
4. nella scelta della formazione;
5. nell'analisi degli scambi;
6. durante l'intera stagione.

Le decisioni numeriche saranno prodotte da algoritmi deterministici e modelli statistici, mentre l'intelligenza artificiale verrà utilizzata per spiegare i risultati e interagire con l'utente in linguaggio naturale.