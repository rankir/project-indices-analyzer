import os
import datetime
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, DateTime, Float
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from sqlalchemy.engine.url import URL

# --- Database Configuration ---
# We'll use a simple SQLite file
DATABASE_URL = "sqlite:///./app_data.db"
# This is the 'engine' that connects SQLAlchemy to the database file
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# --- Session Setup ---
# A 'Session' is how you talk to the database (add data, query data, etc.)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Base Model Class ---
# This is the base class all our database tables will inherit from
Base = declarative_base()

# --- Helper Function to Get a DB Session ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Database Models (Our Tables) ---

class Index(Base):
    __tablename__ = "indices"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # --- The Master Configuration Columns ---
    # This is the "Internal ID" or unique name (e.g. NIFTY_BANK)
    name = Column(String, unique=True, index=True) 
    
    # 1. Category (e.g., "Sectoral Indices")
    category = Column(String, nullable=True)
    
    # 2. Display Name (e.g., "Nifty Financial Services")
    display_name = Column(String, default="Unnamed Index")
    
    # 3. TVTicker (e.g., "NSE_DLY:NIFTY_FINSEREXBNK")
    # This is what we look for in the TradingView Alert CSV
    tv_ticker = Column(String, nullable=True)
    
    # 4. FileName (e.g., "ind_niftyfinancialservicesexbank_list.csv")
    # This is the KEY field used for auto-matching uploads in Data Filling phase
    expected_filename = Column(String, unique=True, nullable=True)
    
    # Signal Flag
    is_at_52wh = Column(Boolean, default=False)
    
    # Metadata about the actual upload
    original_filename = Column(String, nullable=True) # What file was actually uploaded
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    file_size_kb = Column(Float, nullable=True)
    record_count = Column(Integer, default=0)
    
    # Relationships
    # This links the Index to the "Constituents Table" (Stocks)
    # cascade="all, delete-orphan" ensures if we delete an Index, its links are gone too
    stocks = relationship("IndexConstituent", back_populates="index", cascade="all, delete-orphan")


class Stock(Base):
    __tablename__ = "stocks"
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True) # e.g., "HDFCBANK"
    
    # A stock can be in many indices
    indices = relationship("IndexConstituent", back_populates="stock")


class IndexConstituent(Base):
    __tablename__ = "index_constituents"
    index_id = Column(Integer, ForeignKey("indices.id"), primary_key=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), primary_key=True)
    
    # Relationships
    index = relationship("Index", back_populates="stocks")
    stock = relationship("Stock", back_populates="indices")


class TradingViewMap(Base):
    __tablename__ = "tv_map"
    # The name from the TradingView alert CSV, e.g., "NSE:NIFTYBANK"
    tv_alert_name = Column(String, primary_key=True, index=True)
    # The ID of the index in our 'indices' table
    index_id = Column(Integer, ForeignKey("indices.id"))

    # Relationship to easily look up the index
    index = relationship("Index")


# --- Function to Create Tables ---
def create_tables():
    Base.metadata.create_all(bind=engine)