import io
import csv
import datetime
from sqlalchemy.orm import Session, joinedload
from database import Index, Stock, IndexConstituent, TradingViewMap
from collections import Counter
# ... (imports remain the same) ...

# ==========================================
# PHASE 1: MASTER CONFIGURATION (The Schema)
# ==========================================

def process_master_config_csv(db: Session, file_contents: bytes):
    """
    Reads the Master CSV and creates/updates the Index entries.
    Aggressively enforces the Master CSV as the Source of Truth.
    """
    # 1. Decode safely
    try:
        text = file_contents.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = file_contents.decode('latin-1')

    reader = csv.DictReader(io.StringIO(text))
    
    processed_count = 0
    
    for row in reader:
        # Clean inputs
        filename = row.get('Filename', '').strip()
        name = row.get('Name', '').strip().upper()
        
        if not filename and not name:
            continue 

        # --- Step 1: Identify the Target Index ---
        index = None
        
        # Try by Internal Name first (Most reliable for Master Config)
        if name:
            index = db.query(Index).filter(Index.name == name).first()
            
        # If not found by name, try by Filename
        if not index and filename:
            index = db.query(Index).filter(Index.expected_filename == filename).first()
            
        # Create new Index if absolutely nothing found
        if not index:
            final_name = name if name else filename.upper()
            # Safety check for duplicate name creation race condition
            if db.query(Index).filter(Index.name == final_name).first():
                continue 
            index = Index(name=final_name)
            db.add(index)
            # Flush to get an ID for this new index
            db.flush() 
        
        # --- Step 2: Update Metadata ---
        if row.get('DisplayName'):
            index.display_name = row.get('DisplayName')
        
        if row.get('Category'):
            index.category = row.get('Category')
            
        # Handle TV Ticker
        tv_ticker = row.get('TVTicker', '').strip()
        index.tv_ticker = tv_ticker if tv_ticker else None
        
        # --- Step 3: Handle Filename (The "Steal" Logic) ---
        new_filename = filename if filename else None
        
        if new_filename:
            # Check if ANY OTHER index currently holds this filename
            # We exclude the current 'index.id' from the check
            conflict_index = db.query(Index).filter(
                Index.expected_filename == new_filename,
                Index.id != index.id
            ).first()
            
            if conflict_index:
                # STEAL IT: Remove from the old owner
                print(f"⚠️ Conflict: Removing {new_filename} from {conflict_index.name}")
                conflict_index.expected_filename = None
                db.add(conflict_index) # Stage the update
        
        # Now safely assign it to the correct index
        index.expected_filename = new_filename
        
        # --- Step 4: Auto-create TradingView Mapping ---
        if index.tv_ticker:
            existing_map = db.query(TradingViewMap).filter(TradingViewMap.tv_alert_name == index.tv_ticker).first()
            if not existing_map:
                new_map = TradingViewMap(tv_alert_name=index.tv_ticker, index_id=index.id)
                db.add(new_map)
            else:
                existing_map.index_id = index.id

        processed_count += 1
    
    # Commit all changes in one transaction
    db.commit()
    return processed_count


# ==========================================
# PHASE 2: DATA FILLING (The Muscle)
# ==========================================

def get_or_create_stock(db: Session, ticker: str) -> Stock:
    """Helper to get a stock ID or create it if new."""
    stock = db.query(Stock).filter(Stock.ticker == ticker).first()
    if not stock:
        stock = Stock(ticker=ticker)
        db.add(stock)
        db.commit()
        db.refresh(stock)
    return stock

def process_index_csv(db: Session, file_name: str, file_contents: bytes, file_size_kb: float, index_id: int = None, category: str = None):
    """
    Processes the actual Index Constituent CSV.
    """
    
    # --- Step 1: Find the Target Index ---
    index = None
    
    # A. Explicit ID (Manual Link from UI)
    if index_id:
        index = db.query(Index).filter(Index.id == index_id).first()
    
    # B. Auto-Match via Master Configuration (Expected Filename)
    if not index:
        index = db.query(Index).filter(Index.expected_filename == file_name).first()
        
    # C. Legacy/Ad-hoc Match (Name derived from filename)
    index_name_from_file = file_name.upper().split('.')[0]
    if not index:
        index = db.query(Index).filter(Index.name == index_name_from_file).first()
        
    # D. Create New (If absolutely no match found)
    if not index:
        index = Index(
            name=index_name_from_file,
            display_name=index_name_from_file.replace("_", " "),
            category=category or "Uncategorized",
            expected_filename=file_name 
        )
        db.add(index)
    
    # --- Step 2: Update Index Metadata ---
    if category and (not index.category or index.category == "Uncategorized"):
        index.category = category 
        
    index.original_filename = file_name
    index.file_size_kb = file_size_kb
    index.upload_date = datetime.datetime.utcnow()
    
    db.commit()
    db.refresh(index)
    
    # --- Step 3: Populate Constituents ---
    
    # Decode
    try:
        file_text = file_contents.decode('utf-8')
    except UnicodeDecodeError:
        file_text = file_contents.decode('latin-1')

    csv_reader = csv.reader(io.StringIO(file_text))
    
    # Clear old constituents
    db.query(IndexConstituent).filter(IndexConstituent.index_id == index.id).delete()
    db.commit()
    
    stock_count = 0
    # Skip empty rows and extract tickers
    tickers = [row[0].strip().upper() for row in csv_reader if row and row[0].strip()]
    
    for ticker in tickers:
        stock = get_or_create_stock(db, ticker)
        constituent = IndexConstituent(index_id=index.id, stock_id=stock.id)
        db.add(constituent)
        stock_count += 1
    
    index.record_count = stock_count
    db.commit()
    
    return {"index_name": index.name, "stocks_added": stock_count}


# ==========================================
# ANALYSIS LOGIC (Unchanged)
# ==========================================

def analyze_common_stocks(db: Session, index_ids: list[int]):
    # 1. Fetch data
    indices = db.query(Index).options(
        joinedload(Index.stocks).joinedload(IndexConstituent.stock)
    ).filter(Index.id.in_(index_ids)).all()

    if not indices:
        return {
            "analysis_of": [], 
            "commonality": [], 
            "summary": {
                "total_unique_stocks": 0,
                "avg_overlap": 0,
                "high_overlap_stocks": 0
            }
        }

    # 2. Process tickers
    all_tickers = []
    index_names = []
    ticker_to_indices_map = {}
    total_indices_selected = len(indices)

    for index in indices:
        index_names.append(index.display_name)
        for constituent in index.stocks:
            ticker = constituent.stock.ticker
            all_tickers.append(ticker)
            if ticker not in ticker_to_indices_map:
                ticker_to_indices_map[ticker] = []
            ticker_to_indices_map[ticker].append(index.display_name)

    # 3. Count frequency
    ticker_counts = Counter(all_tickers)

    # 4. Format the result
    commonality_list = []
    for ticker, count in ticker_counts.items():
        commonality_list.append({
            "stock": ticker,
            "appears_in": count,
            "indices": ticker_to_indices_map[ticker]
        })

    # 5. Sort
    sorted_list = sorted(commonality_list, key=lambda x: x['appears_in'], reverse=True)
    
    # 6. Calculate Summary Stats
    total_unique_stocks = len(sorted_list)
    
    if total_unique_stocks > 0:
        total_appearances = sum(item['appears_in'] for item in sorted_list)
        avg_overlap = total_appearances / total_unique_stocks
        
        high_overlap_threshold = 0.7 * total_indices_selected
        high_overlap_stocks_count = len(
            [item for item in sorted_list if item['appears_in'] >= high_overlap_threshold]
        )
    else:
        avg_overlap = 0
        high_overlap_stocks_count = 0

    summary = {
        "total_unique_stocks": total_unique_stocks,
        "avg_overlap": round(avg_overlap, 1),
        "high_overlap_stocks": high_overlap_stocks_count
    }
    
    return {
        "analysis_of": index_names,
        "commonality": sorted_list,
        "summary": summary
    }

# ==========================================
# ALERT PROCESSING LOGIC (Existing)
# ==========================================
def parse_tradingview_csv(content: bytes, db: Session):
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = content.decode('latin-1')
        
    reader = csv.DictReader(io.StringIO(text))
    
    records = []
    highs = 0
    lows = 0
    
    for row in reader:
        ticker = row.get('Ticker') or row.get('Symbol')
        description = row.get('Description', '').lower()
        time_str = row.get('Time', '')
        
        if not ticker: continue
        
        flag = "Unknown"
        if "high" in description:
            flag = "High"
            highs += 1
        elif "low" in description:
            flag = "Low"
            lows += 1
            
        mapped_id = None
        mapped_name = "Not mapped"
        
        # Check Mapping
        tv_map = db.query(TradingViewMap).filter(TradingViewMap.tv_alert_name == ticker).first()
        if tv_map:
            mapped_id = tv_map.index_id
            index = db.query(Index).filter(Index.id == mapped_id).first()
            if index:
                mapped_name = index.display_name
        else:
            # Fallback
            base_ticker = ticker.split(',')[0]
            clean_ticker = base_ticker.split(':')[-1]
            index = db.query(Index).filter(Index.name == clean_ticker).first()
            if index:
                mapped_id = index.id
                mapped_name = index.display_name

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