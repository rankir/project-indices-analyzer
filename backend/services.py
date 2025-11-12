import io
import csv
import datetime
from sqlalchemy.orm import Session
from database import Index, Stock, IndexConstituent
from sqlalchemy.orm import joinedload
from collections import Counter

# This function will find a stock or create it if it doesn't exist
def get_or_create_stock(db: Session, ticker: str) -> Stock:
    stock = db.query(Stock).filter(Stock.ticker == ticker).first()
    if not stock:
        stock = Stock(ticker=ticker)
        db.add(stock)
        db.commit()
        db.refresh(stock)
    return stock

# This is the main logic for processing the uploaded file
def process_index_csv(db: Session, file_name: str, file_contents: bytes, category: str, file_size_kb: float):
    # 1. Get index name from filename
    index_name = file_name.upper().split('.')[0]
    
    # 2. Read CSV contents *once* to get tickers and count
    file_text = file_contents.decode('utf-8')
    csv_reader = csv.reader(io.StringIO(file_text))
    
    # Get all tickers, clean them up, and filter out empty rows
    tickers = [row[0].strip().upper() for row in csv_reader if row and row[0].strip()]
    stock_count = len(tickers) # This is our record count

    # 3. Find or create the Index
    index = db.query(Index).filter(Index.name == index_name).first()
    
    if not index:
        index = Index(
            name=index_name,
            display_name=index_name.replace("_", " "),
            category=category,
            original_filename=file_name,
            file_size_kb=file_size_kb,
            record_count=stock_count,
            upload_date=datetime.datetime.utcnow() # Set current time
        )
        db.add(index)
    else:
        # If index exists, update it with new info
        index.category = category
        index.original_filename = file_name
        index.file_size_kb = file_size_kb
        index.record_count = stock_count
        index.upload_date = datetime.datetime.utcnow()
    
    db.commit()
    db.refresh(index)
    
    # 4. Clear old constituents for this index
    db.query(IndexConstituent).filter(IndexConstituent.index_id == index.id).delete()
    db.commit()
    
    # 5. Populate new constituents from our tickers list
    for ticker in tickers:
        stock = get_or_create_stock(db, ticker)
        constituent = IndexConstituent(index_id=index.id, stock_id=stock.id)
        db.add(constituent)
    
    db.commit()
    
    return {"index_name": index.name, "stocks_added": stock_count}

def analyze_common_stocks(db: Session, index_ids: list[int]):
    # 1. Fetch data (unchanged)
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

    # 2. Process tickers (unchanged)
    all_tickers = []
    index_names = []
    ticker_to_indices_map = {}
    total_indices_selected = len(indices) # <-- Get total count

    for index in indices:
        index_names.append(index.display_name)
        for constituent in index.stocks:
            ticker = constituent.stock.ticker
            all_tickers.append(ticker)
            if ticker not in ticker_to_indices_map:
                ticker_to_indices_map[ticker] = []
            ticker_to_indices_map[ticker].append(index.display_name)

    # 3. Count frequency (unchanged)
    ticker_counts = Counter(all_tickers)

    # 4. Format the result (unchanged)
    commonality_list = []
    for ticker, count in ticker_counts.items():
        commonality_list.append({
            "stock": ticker,
            "appears_in": count,
            "indices": ticker_to_indices_map[ticker]
        })

    # 5. Sort (unchanged)
    sorted_list = sorted(commonality_list, key=lambda x: x['appears_in'], reverse=True)
    
    # 6. --- NEW: Calculate Summary Stats ---
    total_unique_stocks = len(sorted_list)
    
    if total_unique_stocks > 0:
        total_appearances = sum(item['appears_in'] for item in sorted_list)
        avg_overlap = total_appearances / total_unique_stocks
        
        # "High Overlap" = 70%+ of selected indices
        high_overlap_threshold = 0.7 * total_indices_selected
        high_overlap_stocks_count = len(
            [item for item in sorted_list if item['appears_in'] >= high_overlap_threshold]
        )
    else:
        avg_overlap = 0
        high_overlap_stocks_count = 0

    summary = {
        "total_unique_stocks": total_unique_stocks,
        "avg_overlap": round(avg_overlap, 1), # Round to 1 decimal
        "high_overlap_stocks": high_overlap_stocks_count
    }
    
    # 7. --- NEW: Return summary alongside other data ---
    return {
        "analysis_of": index_names,
        "commonality": sorted_list,
        "summary": summary  # <-- ADD THIS
    }