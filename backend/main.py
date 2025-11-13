# Import the new middleware
import csv
import io
from pydantic import BaseModel, Field
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_
import datetime
from database import create_tables, get_db, TradingViewMap, Index, Stock, IndexConstituent
from services import (
    process_index_csv, 
    analyze_common_stocks, 
    process_master_config_csv
)


# --- App Initialization ---
app = FastAPI()

# --- Add CORS Middleware ---
# This is the new section
origins = [
    "http://localhost:3000",  # Allow your React app
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc)
    allow_headers=["*"],  # Allow all headers
)

# --- Pydantic Schema ---
# This defines the "shape" of the data we will send to the frontend.
# It's a "schema" that validates the data.
class IndexSchema(BaseModel):
    id: int
    name: str
    display_name: str
    category: Optional[str] = None
    is_at_52wh: bool
    
    # --- NEW FIELDS TO RETURN ---
    original_filename: Optional[str]
    upload_date: datetime.datetime
    file_size_kb: Optional[float]
    record_count: int

    class Config:
        orm_mode = True

class AnalysisRequest(BaseModel):
    # We expect a list of integers, and it must have at least 1
    index_ids: List[int] = Field(..., min_items=1)

class StockCommonalitySchema(BaseModel):
    stock: str
    appears_in: int
    indices: List[str]

class AnalysisSummarySchema(BaseModel):
    total_unique_stocks: int
    avg_overlap: float
    high_overlap_stocks: int

# --- MODIFIED: AnalysisResultSchema ---
class AnalysisResultSchema(BaseModel):
    analysis_of: List[str]
    commonality: List[StockCommonalitySchema]
    summary: AnalysisSummarySchema # <-- ADD THIS

    # --- New Schema for Alert Data ---
class AlertRecord(BaseModel):
    ticker: str
    flag_type: str # "High", "Low", "Unknown"
    mapped_index_id: Optional[int]
    mapped_index_name: Optional[str]
    date: str

class AlertResponse(BaseModel):
    filename: str
    records: List[AlertRecord]
    summary: dict

# --- Event Handler ---
@app.on_event("startup")
def on_startup():
    create_tables()

# ... (The rest of your file stays exactly the same) ...

# --- API Endpoints ---
@app.get("/")
def read_root():
    return {"Hello": "Backend"}

@app.get("/api/test")
def test_api():
    return {"message": "The API is working!"}

@app.get("/api/indices", response_model=List[IndexSchema])
def get_all_indices(db: Session = Depends(get_db)):
    # Order by most recently uploaded first
    indices = db.query(Index).order_by(Index.upload_date.desc()).all() 
    return indices

@app.post("/api/setup/upload-index")
async def upload_index_file(
    db: Session = Depends(get_db), 
    files: List[UploadFile] = File(...),
    index_id: Optional[int] = Form(None) # <-- Key Change: Added index_id, Removed category
):
    results = []
    errors = []
    
    for file in files:
        contents = await file.read()
        file_size_kb = len(contents) / 1024.0
        
        # Logic: 
        # 1. If index_id is provided (Manual Link), force update that index.
        # 2. If no index_id, try to find index by 'expected_filename' (Auto Match).
        
        target_index = None
        
        if index_id:
            target_index = db.query(Index).filter(Index.id == index_id).first()
        else:
            # Auto-match attempt using Master Config
            target_index = db.query(Index).filter(Index.expected_filename == file.filename).first()
            
        if not target_index:
             # If we can't match it, we fail. The UI will see this error and ask user to map it.
             errors.append(f"{file.filename}: Unknown file. Please link to an Index.")
             continue

        try:
            # Use the existing category from the database target_index
            result = process_index_csv(
                db=db, 
                file_name=file.filename, 
                file_contents=contents, 
                category=target_index.category, # <-- Use DB category, not Form category
                file_size_kb=round(file_size_kb, 2),
                index_id=target_index.id # Pass the ID explicitly
            )
            results.append({"filename": file.filename, "stocks_added": result["stocks_added"]})
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    # If EVERYTHING failed, raise an error so frontend knows something is wrong
    if not results and errors:
        # Return 200 with errors so frontend can parse the "Unknown file" message
        # We don't use 500 because "Unknown file" is a handled logic flow
        return {
            "status": "partial_error",
            "detail": "Some files could not be processed.",
            "processed": [],
            "errors": errors
        }
    
    return {
        "status": "success", 
        "detail": f"Processed {len(results)} files.", 
        "processed": results, 
        "errors": errors
    }

@app.post("/api/analysis/common-stocks", response_model=AnalysisResultSchema)
def run_common_stock_analysis(
    request_data: AnalysisRequest, 
    db: Session = Depends(get_db)
):
    try:
        result = analyze_common_stocks(db, request_data.index_ids)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/api/indices/{index_id}")
def delete_index(index_id: int, db: Session = Depends(get_db)):
    index = db.query(Index).filter(Index.id == index_id).first()
    if not index:
        raise HTTPException(status_code=404, detail="Index not found")
    
    # Because of `cascade="all, delete-orphan"` in our model,
    # deleting the index will automatically delete its constituents.
    db.delete(index)
    db.commit()
    
    return {"status": "success", "detail": "Index and constituents deleted"}


# --- Helper to parse TradingView CSV ---
def parse_tradingview_csv(content: bytes, db: Session):
    text = content.decode('utf-8-sig') # Use 'utf-8-sig' to handle potential BOM
    reader = csv.DictReader(io.StringIO(text))
    
    records = []
    highs = 0
    lows = 0
    
    for row in reader:
        # TradingView CSVs usually have 'Ticker', 'Description', 'Time'
        ticker = row.get('Ticker') or row.get('Symbol')
        description = row.get('Description', '').lower()
        time_str = row.get('Time', '')
        
        if not ticker: continue
        
        # 1. Determine Flag Type
        flag = "Unknown"
        if "New 52-Week High!" in description:
            flag = "High"
            highs += 1
        elif "New 52-Week Low!" in description:
            flag = "Low"
            lows += 1
            
        # 2. Map to Index
        mapped_id = None
        mapped_name = "Not mapped"
        
        # First check the Mapping table (Exact match)
        tv_map = db.query(TradingViewMap).filter(TradingViewMap.tv_alert_name == ticker).first()
        if tv_map:
            mapped_id = tv_map.index_id
            index = db.query(Index).filter(Index.id == mapped_id).first()
            if index:
                mapped_name = index.display_name
        else:
            # Fallback: Clean the ticker and try exact match on Index Name
            # Logic: "TVC:US10Y, 1D" -> "TVC:US10Y" -> "US10Y"
            base_ticker = ticker.split(',')[0] # Remove timeframe like ", 1D"
            clean_ticker = base_ticker.split(':')[-1] # Remove prefix like "TVC:"
            
            index = db.query(Index).filter(Index.name == clean_ticker).first()
            if index:
                mapped_id = index.id
                mapped_name = index.display_name

        # 3. Format Date (Simple ISO format)
        try:
            date_display = time_str.split('T')[0] if 'T' in time_str else time_str
        except:
            date_display = "Invalid Date"

        records.append({
            "ticker": ticker,
            "flag_type": flag,
            "mapped_index_id": mapped_id,
            "mapped_index_name": mapped_name,
            "date": date_display
        })

    return {
        "records": records,
        "summary": {
            "total_alerts": len(records),
            "highs": highs,
            "lows": lows
        }
    }

# --- NEW API ENDPOINT ---
@app.post("/api/setup/process-tradingview-alerts", response_model=AlertResponse)
async def process_tv_alerts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    try:
        result = parse_tradingview_csv(contents, db)
        return {
            "filename": file.filename,
            "records": result['records'],
            "summary": result['summary']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

    # --- NEW ENDPOINT: Master Config Upload ---
@app.post("/api/setup/master-config")
async def upload_master_config(
    db: Session = Depends(get_db),
    file: UploadFile = File(...)
):
    contents = await file.read()
    try:
        count = process_master_config_csv(db, contents)
        return {"status": "success", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- MODIFIED ENDPOINT: Constituent Upload ---
# Now accepts an optional 'index_id' to force mapping
@app.post("/api/setup/upload-index")
async def upload_index_file(
    db: Session = Depends(get_db), 
    files: List[UploadFile] = File(...),
    index_id: Optional[int] = Form(None) # <-- CHANGED: Receives ID, not Category
):
    results = []
    errors = []
    
    for file in files:
        contents = await file.read()
        file_size_kb = len(contents) / 1024.0
        
        # Logic: 
        # 1. If index_id is provided, force update that index.
        # 2. If no index_id, try to find index by 'expected_filename'.
        
        target_index = None
        
        if index_id:
            target_index = db.query(Index).filter(Index.id == index_id).first()
        else:
            # Auto-match attempt
            target_index = db.query(Index).filter(Index.expected_filename == file.filename).first()
            
        if not target_index:
             # If we can't match it, we fail. The UI must ask the user to map it.
             errors.append(f"{file.filename}: Unknown file. Please link to an Index.")
             continue

        try:
            # We use the existing process logic, but pass the known Category from the DB
            result = process_index_csv(
                db=db, 
                file_name=file.filename, # Update filename
                file_contents=contents, 
                category=target_index.category, # Use existing category
                file_size_kb=round(file_size_kb, 2)
            )
            # Ensure the name/ID matches what we found
            # (process_index_csv might create new if names mismatch, so we should ideally refactor it,
            # but for now, let's assume filenames align or we force it in next step)
            
            results.append({"filename": file.filename, "stocks_added": result["stocks_added"]})
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    return {
        "status": "success", 
        "detail": f"Processed {len(results)} files.", 
        "processed": results, 
        "errors": errors
    }

# --- NEW: Stock Search Endpoint ---
@app.get("/api/search/stock-indices")
def search_stock_in_indices(q: str, db: Session = Depends(get_db)):
    """
    Finds which indices contain a specific stock ticker.
    """
    if not q:
        return []
    
    search_term = q.upper().strip()
    
    # Find stocks matching the query
    stocks = db.query(Stock).filter(Stock.ticker.contains(search_term)).all()
    stock_ids = [s.id for s in stocks]
    
    if not stock_ids:
        return []

    # Find indices containing these stocks
    # We join IndexConstituent -> Index to get index details
    results = db.query(Index).join(IndexConstituent).filter(
        IndexConstituent.stock_id.in_(stock_ids)
    ).distinct().all()
    
    return results