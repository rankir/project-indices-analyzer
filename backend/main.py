# Import the new middleware
from pydantic import BaseModel, Field
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
import datetime
from database import Index, create_tables, get_db
from services import process_index_csv, analyze_common_stocks

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
    files: List[UploadFile] = File(...), # <-- Change to List[UploadFile]
    category: str = Form(...)
):
    results = []
    errors = []
    
    for file in files:
        if not file.filename.endswith('.csv'):
            errors.append(f"{file.filename}: Invalid file type. Please upload a .csv")
            continue
        
        contents = await file.read()
        file_size_kb = len(contents) / 1024.0

        try:
            # Process each file individually
            result = process_index_csv(
                db=db, 
                file_name=file.filename, 
                file_contents=contents, 
                category=category,
                file_size_kb=round(file_size_kb, 2)
            )
            results.append({
                "filename": file.filename,
                "stocks_added": result["stocks_added"]
            })
        except Exception as e:
            # Collect errors instead of stopping
            errors.append(f"{file.filename}: Error processing file: {str(e)}")
    
    # Check if any files failed
    if not results and errors:
        raise HTTPException(status_code=500, detail={"errors": errors, "processed": []})
    
    # Return a summary of what happened
    return {
        "status": "success",
        "detail": f"Processed {len(results)} of {len(files)} files.",
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