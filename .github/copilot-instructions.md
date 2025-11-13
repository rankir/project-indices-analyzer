# Copilot Instructions for Project Indices Analyzer

## Project Overview
A full-stack application for analyzing financial market indices (NIFTY indices) and discovering common stocks across multiple indices. The system ingests CSV index constituent files, processes TradingView alerts, and provides cross-index analysis.

## Architecture

### Backend (FastAPI + SQLAlchemy)
- **Location**: `backend/`
- **Entry point**: `main.py` - FastAPI app with CORS enabled for localhost:3000
- **Database**: SQLite (`app_data.db`) using SQLAlchemy ORM
- **Port**: 8000 (uvicorn server)

#### Core Models (`database.py`)
- `Index`: Market indices (NIFTY_BANK, NIFTY_FIN, etc.) with metadata (upload_date, record_count, file_size_kb)
- `Stock`: Individual ticker symbols (HDFCBANK, INFY, etc.)
- `IndexConstituent`: Junction table linking stocks to indices (many-to-many)
- `TradingViewMap`: Maps TradingView alert names to indices for alert routing

#### Business Logic (`services.py`)
- `process_index_csv()`: Parses CSV files, creates/updates Index records, populates constituents
  - Reads CSV with single-column format (ticker per row)
  - Updates existing indices or creates new ones
  - Cascading deletes constituents when re-uploading
- `analyze_common_stocks()`: Cross-index analysis
  - Returns stocks sorted by appearance frequency
  - Calculates summary stats: total_unique_stocks, avg_overlap, high_overlap_stocks (70%+ threshold)

#### API Endpoints (`main.py`)
- `GET /api/indices` - List all indices (ordered by most recent upload)
- `POST /api/setup/upload-index` - Multi-file CSV upload with category
- `POST /api/analysis/common-stocks` - Analyze commonality across selected indices
- `DELETE /api/indices/{index_id}` - Delete index and its constituents
- `POST /api/setup/process-tradingview-alerts` - Parse TradingView alert CSV

**Response Schemas** defined as Pydantic models in main.py:
- `IndexSchema`: Returns index metadata including upload_date, file_size_kb, record_count
- `AnalysisResultSchema`: analysis_of (index names), commonality (stock list), summary stats
- `AlertResponse`: filename, records (with ticker/flag_type/mapped_index), summary (total/highs/lows)

### Frontend (React 19)
- **Location**: `frontend/src/`
- **Framework**: Create React App with React Router v7
- **Port**: 3000
- **API Client**: axios pointing to `http://127.0.0.1:8000`

#### Key Components
- `App.js`: Route definitions (/, /setup, /analyze, /watchlist)
- `SetupPage.js`: Two tabs - "Data Upload" (CSV constituents) and "TV Alerts" (TradingView file)
- `AnalyzePage.js`: Index selection and cross-index analysis with expandable results
- `AlertsContext.js`: Global state management for TradingView alerts
- `Navbar.js`: Navigation between pages

#### Data Flow
1. **Setup Flow**: User uploads CSV files → `SetupPage` → POST `/api/setup/upload-index` → stores in database
2. **Analysis Flow**: User selects indices → `AnalyzePage` → POST `/api/analysis/common-stocks` → displays commonality results
3. **Alerts Flow**: User uploads TradingView CSV → POST `/api/setup/process-tradingview-alerts` → AlertsContext stores data globally

## Key Patterns & Conventions

### CSV Processing
- **Input format**: Single column of ticker symbols (no headers assumed in index constituents files)
- **Naming convention**: Index name derived from filename (NIFTY_BANK.csv → "NIFTY_BANK")
- **Handling**: Tickers stripped, uppercased; empty rows filtered out
- **TradingView format**: Uses `DictReader` with columns like 'Ticker', 'Description', 'Time'

### Database Patterns
- **Upsert logic**: `process_index_csv()` finds existing Index by name, updates if exists, creates if new
- **Cascading deletes**: Index deletion cascades to IndexConstituent via `cascade="all, delete-orphan"`
- **Session management**: `get_db()` yields SessionLocal, auto-closes in finally block
- **Lazy commits**: Multiple db.add() followed by single db.commit() for efficiency

### API Response Pattern
All endpoints return structured JSON with explicit error handling:
```python
# Success with metadata
{"status": "success", "detail": "...", "processed": [...], "errors": [...]}

# Errors raise HTTPException with appropriate status codes (404, 500, etc)
raise HTTPException(status_code=500, detail=str(e))
```

### Frontend State Management
- React Context (`AlertsContext`) for global TradingView alert data
- Component-level state (useState) for UI state (loading, modal open, selected items)
- Direct axios calls in components (no central API service layer)

## Development Workflows

### Running the Application
```powershell
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm start
```

### Database
- Auto-created on first run via `create_tables()` called in startup event
- SQLite file: `backend/app_data.db`
- Schema: See database.py models for table structure

### Testing Data
- Sample CSV files in `data/` directory: NIFTY_BANK.csv, NIFTY_FIN.csv, etc.
- Format: Single column of tickers (one per row)

## Common Development Tasks

### Adding a New API Endpoint
1. Add Pydantic schema to `main.py` (if needed)
2. Define function in `services.py` (if complex logic)
3. Create route in `main.py` with `@app.get/post/delete` decorator
4. Add frontend call in React component via `axios.post(${API_URL}/api/..., data)`

### Modifying Index Storage
- Update `Index` model in `database.py`
- Update `IndexSchema` response model in `main.py`
- Update `process_index_csv()` to populate new fields
- Frontend automatically receives new fields in API responses

### TradingView Alert Mapping
- `TradingViewMap` table maps TradingView alert names to `Index.id`
- Fallback parsing: extracts ticker from "PREFIX:TICKER, TIMEFRAME" format
- Alert flag types: "High" (52-week high), "Low" (52-week low), "Unknown"

## Integration Points & Dependencies

### External Services
- None currently; fully self-contained with SQLite

### Python Dependencies (backend)
- fastapi: Web framework
- sqlalchemy: ORM
- pydantic: Data validation
- python-multipart: Form data handling (required for file uploads)

### JavaScript Dependencies (frontend)
- react, react-dom: UI framework
- react-router-dom: Routing
- axios: HTTP client
- react-scripts: Build tooling (CRA)

## Critical Design Decisions

1. **SQLite over PostgreSQL**: Simplicity for development; suitable for single-server deployment
2. **Junction table for many-to-many**: IndexConstituent allows stocks to appear in multiple indices
3. **CSV over database seeds**: Allows non-technical users to upload new indices dynamically
4. **Global context for alerts**: TradingView data accessible across components without prop drilling
5. **CORS whitelisting**: Only localhost:3000 allowed; change `origins` list for production
