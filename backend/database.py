import os
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, DateTime, Float
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from sqlalchemy.engine.url import URL
import datetime # <-- ADD THIS IMPORT

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
    name = Column(String, unique=True, index=True)  # e.g., "NIFTY_BANK"
    display_name = Column(String, default="Unnamed Index")
    category = Column(String, nullable=True)
    is_at_52wh = Column(Boolean, default=False)
    
    # --- NEW FIELDS ---
    original_filename = Column(String, nullable=True)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    file_size_kb = Column(Float, nullable=True)
    record_count = Column(Integer, default=0)
    # --- END NEW FIELDS ---
    
    # This creates the 'reverse' relationship
    # --- ADD cascade="all, delete-orphan" ---
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
    
    # This creates the 'forward' relationship
    index = relationship("Index", back_populates="stocks")
    stock = relationship("Stock", back_populates="indices")

# We'll skip the TradingViewMap for now to keep it simple

# --- Function to Create Tables ---
def create_tables():
    Base.metadata.create_all(bind=engine)