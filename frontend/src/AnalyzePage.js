import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AnalyzePage.css';
import './AnalyzeResults.css'; // Keep this import

const API_URL = "http://127.0.0.1:8000";

// --- AnalysisResultRow Component (Unchanged) ---
// ... (The entire AnalysisResultRow helper component stays here, unchanged) ...
function AnalysisResultRow({ row, totalIndices }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const indicesToShow = row.indices.slice(0, 3);
  const moreCount = row.indices.length - 3;

  return (
    <>
      <div className="results-table-row">
        <div className="stock-info">
          <div className="stock-ticker">{row.stock}</div>
          <div className="stock-name">{row.stock} Ltd. (Placeholder)</div>
        </div>
        <div className="overlap-pill">
          {row.appears_in}/{totalIndices}
        </div>
        <div className="indices-pills">
          {indicesToShow.map(name => (
            <span key={name}>{name}</span>
          ))}
          {moreCount > 0 && <span>+{moreCount} more</span>}
        </div>
        <button 
          className={`expand-button ${isExpanded ? 'expanded' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          ▼
        </button>
      </div>
      
      {isExpanded && (
        <div className="row-expansion">
          <div className="row-expansion-title">
            Appears in all {row.appears_in} indices:
          </div>
          <div className="row-expansion-list">
            {row.indices.map(name => (
              <span key={name} className="pill">{name}</span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
// --- End of AnalysisResultRow Component ---


// --- Main AnalyzePage Component ---
function AnalyzePage() {
  const [indices, setIndices] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  // --- MODIFIED: Update default category to full name ---
  const [category, setCategory] = useState('Broad-based Indices'); 

  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all indices on component load (Unchanged)
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/indices`);
        setIndices(response.data);
      } catch (error) {
        console.error("Error fetching indices:", error);
      }
    };
    fetchIndices();
  }, []);

  // Handle checking/unchecking a box (Unchanged)
  const handleSelect = (index) => {
    setSelectedIndices((prevSelected) => {
      const isSelected = prevSelected.find(item => item.id === index.id);
      if (isSelected) {
        return prevSelected.filter(item => item.id !== index.id);
      } else {
        return [...prevSelected, index];
      }
    });
    setAnalysisResult(null); 
  };

  // Handle removing a single pill (Unchanged)
  const handleRemovePill = (indexToRemove) => {
    setSelectedIndices((prevSelected) => 
      prevSelected.filter(item => item.id !== indexToRemove.id)
    );
  };
  
  // Get currently visible indices (Unchanged)
  // This filter logic is correct, it was the 'category' state that was wrong.
  const visibleIndices = indices.filter(index => (index.category || 'N/A') === category);

  // Handle Select All for visible category (Unchanged)
  const handleSelectAllVisible = () => {
    const selectedSet = new Set(selectedIndices.map(i => i.id));
    const newSelections = [];
    
    for (const index of visibleIndices) {
      if (!selectedSet.has(index.id)) {
        newSelections.push(index);
      }
    }
    
    setSelectedIndices([...selectedIndices, ...newSelections]);
  };

  // Handle the "Analyze" button click (Unchanged)
  const handleAnalyze = async () => {
    // ... (This function is unchanged) ...
    setIsLoading(true);
    setAnalysisResult(null); 
    const index_ids = selectedIndices.map(index => index.id);
    try {
      const response = await axios.post(
        `${API_URL}/api/analysis/common-stocks`,
        { index_ids }
      );
      setAnalysisResult(response.data);
    } catch (error) {
      console.error("Error running analysis:", error);
    }
    setIsLoading(false);
  };
  
  // Filtered results based on search (Unchanged)
  const filteredCommonality = analysisResult
    ? analysisResult.commonality.filter(item =>
        item.stock.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];
  
  const totalIndicesSelected = analysisResult ? analysisResult.analysis_of.length : 0;

  // --- RENDER FUNCTION ---
  return (
    <div className="page-content">
      {/* --- Titles (Unchanged) --- */}
      {!analysisResult && (
        <>
          <h2>Index Selector</h2>
          <p>Select indices to analyze their performance and constituent stocks</p>
        </>
      )}
      {analysisResult && (
        <>
          <h2>Index Overlap Analysis</h2>
          <p>Analyzing constituent stocks across {selectedIndices.length} selected indices</p>
        </>
      )}
      
      {/* --- Selected Indices Tray (Unchanged) --- */}
      <div className="selected-tray card" style={{ background: '#23272f', border: '1px solid #444' }}>
        <div className="selected-tray-header">
          <strong>Selected Indices ({selectedIndices.length})</strong>
          <div>
            {!analysisResult && !isLoading &&
              <button onClick={handleSelectAllVisible} className="select-all-btn">
                Select All ({category})
              </button>
            }
            <button 
              onClick={() => { setSelectedIndices([]); setAnalysisResult(null); }} 
              className="clear-all-btn"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="selected-pills">
          {selectedIndices.length === 0 ? (
            <span style={{color: '#a0a0a0'}}>None</span>
          ) : (
            selectedIndices.map(index => (
              <span key={index.id} className="pill pill-removable">
                {index.display_name}
                <button 
                  className="pill-remove" 
                  onClick={() => handleRemovePill(index)}
                >
                  &times;
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Hide selectors if results are shown */}
      {!analysisResult && !isLoading && (
        <>
          {/* --- MODIFIED: Category Tabs --- */}
          <div className="category-tabs-container">
            <div className="category-tabs">
              {/* Use the full names here */}
              <button className={category === 'Broad-based Indices' ? 'active' : ''} onClick={() => setCategory('Broad-based Indices')}>Broad-based</button>
              <button className={category === 'Sectoral Indices' ? 'active' : ''} onClick={() => setCategory('Sectoral Indices')}>Sectoral</button>
              <button className={category === 'Thematic Indices' ? 'active' : ''} onClick={() => setCategory('Thematic Indices')}>Thematic</button>
              <button className={category === 'Strategic Indices' ? 'active' : ''} onClick={() => setCategory('Strategic Indices')}>Strategic</button>
            </div>
            <button onClick={handleSelectAllVisible} className="select-all-link">
              Select All
            </button>
          </div>


          {/* Index List */}
          <div className="index-selector-list">
            {/* This will now show items */}
            {visibleIndices.length === 0 ? (
              <p style={{marginTop: '20px', textAlign: 'center'}}>No indices found for this category.</p>
            ) : (
              visibleIndices.map(index => { 
                const isSelected = selectedIndices.find(item => item.id === index.id);
                return (
                  <div key={index.id} className="index-item card">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => handleSelect(index)}
                      id={`index-${index.id}`}
                    />
                    <label htmlFor={`index-${index.id}`} className="index-info">
                      <span className="index-name">
                        {index.display_name}
                        {index.is_at_52wh && <span className="pill-52wh">52W High</span>}
                      </span>
                      {/* We can hide this now since it's redundant with the tab */}
                      {/* <span className="index-category">{index.category || 'N/A'}</span> */}
                    </label>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Results Section (Unchanged) */}
      {isLoading && <div className="card"><h3>Analyzing...</h3></div>}
      {analysisResult && (
        <div className="results-container">
            {/* ... (Summary Cards, Toolbar, Table, Insights Box) ... */}
            {/* ... (This section is unchanged) ... */}
        </div>
      )}

      {/* Analyze Button Footer (Unchanged) */}
      {!analysisResult && (
        <div className="analyze-footer">
          <button 
            className="analyze-button" 
            disabled={selectedIndices.length === 0 || isLoading}
            onClick={handleAnalyze}
          >
            {isLoading ? 'Analyzing...' : `Analyze Selected Indices (${selectedIndices.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

export default AnalyzePage;