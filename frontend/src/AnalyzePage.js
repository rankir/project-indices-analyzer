import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AnalyzePage.css';
import './AnalyzeResults.css'; // Make sure this CSS file is imported

const API_URL = "http://127.0.0.1:8000";

// --- Helper Component for the expandable row ---
// This sub-component renders a single row in the results table
function AnalysisResultRow({ row, totalIndices }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Logic to show 3 pills, then a "+# more"
  const indicesToShow = row.indices.slice(0, 3);
  const moreCount = row.indices.length - 3;

  return (
    <>
      <div className="results-table-row">
        <div className="stock-info">
          <div className="stock-ticker">{row.stock}</div>
          {/* We add a placeholder name, but you could fetch this in the future */}
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
      
      {/* This is the content that shows when you expand the row */}
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
  
  // --- This is the fix for your category bug ---
  // Default to the full name, matching the database
  const [category, setCategory] = useState('Broad-based Indices'); 

  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all indices on component load
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/indices`);
        setIndices(response.data);
      } catch (error) {
        // This is the error you were seeing earlier!
        console.error("Error fetching indices:", error);
      }
    };
    fetchIndices();
  }, []); // The empty array [] means this runs only once on page load

  // Handle checking/unchecking a box
  const handleSelect = (index) => {
    setSelectedIndices((prevSelected) => {
      const isSelected = prevSelected.find(item => item.id === index.id);
      if (isSelected) {
        // If already selected, remove it
        return prevSelected.filter(item => item.id !== index.id);
      } else {
        // If not selected, add it
        return [...prevSelected, index];
      }
    });
    // Clear old results when selection changes
    setAnalysisResult(null); 
  };

  // Handle removing a single pill from the top tray
  const handleRemovePill = (indexToRemove) => {
    setSelectedIndices((prevSelected) => 
      prevSelected.filter(item => item.id !== indexToRemove.id)
    );
  };
  
  // Filter indices based on the active category tab
  const visibleIndices = indices.filter(index => (index.category || 'N/A') === category);

  // Handle "Select All" for the visible category
  const handleSelectAllVisible = () => {
    const selectedSet = new Set(selectedIndices.map(i => i.id));
    const newSelections = [];
    
    // Add any indices that aren't already selected
    for (const index of visibleIndices) {
      if (!selectedSet.has(index.id)) {
        newSelections.push(index);
      }
    }
    
    setSelectedIndices([...selectedIndices, ...newSelections]);
  };

  // Handle the "Analyze" button click
  const handleAnalyze = async () => {
    setIsLoading(true);
    setAnalysisResult(null); 
    const index_ids = selectedIndices.map(index => index.id);
    
    // --- THIS IS WHERE THE CONSOLE LOG IS ---
    console.log("Starting analysis for IDs:", index_ids);

    try {
      const response = await axios.post(
        `${API_URL}/api/analysis/common-stocks`,
        { index_ids }
      );
      // --- THIS IS THE DATA FROM YOUR API ---
      console.log("Data for render:", response.data);
      setAnalysisResult(response.data); // Store the results
    } catch (error) {
      console.error("Error running analysis:", error);
    }
    setIsLoading(false); // Hide loading spinner
  };
  
  // Filtered results based on search term
  const filteredCommonality = analysisResult
    ? analysisResult.commonality.filter(item =>
        item.stock.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];
  
  // Get total count for the table header
  const totalIndicesSelected = analysisResult ? analysisResult.analysis_of.length : 0;

  // --- RENDER FUNCTION ---
  return (
    <div className="page-content">
      
      {/* --- Titles --- */}
      {/* Show "Index Selector" title *before* analysis */}
      {!analysisResult && (
        <>
          <h2>Index Selector</h2>
          <p>Select indices to analyze their performance and constituent stocks</p>
        </>
      )}
      {/* Show "Analysis" title *after* analysis */}
      {analysisResult && (
        <>
          <h2>Index Overlap Analysis</h2>
          <p>Analyzing constituent stocks across {selectedIndices.length} selected indices</p>
        </>
      )}
      
      {/* --- Selected Indices Tray --- */}
      <div className="selected-tray card" style={{ background: '#23272f', border: '1px solid #444' }}>
        <div className="selected-tray-header">
          <strong>Selected Indices ({selectedIndices.length})</strong>
          <div>
            {/* Show "Select All" button only before analysis */}
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

      {/* --- This section HIDES when results are shown --- */}
      {!analysisResult && !isLoading && (
        <>
          {/* --- Category Tabs (using the full names) --- */}
          <div className="category-tabs-container">
            <div className="category-tabs">
              <button className={category === 'Broad-based Indices' ? 'active' : ''} onClick={() => setCategory('Broad-based Indices')}>Broad-based</button>
              <button className={category === 'Sectoral Indices' ? 'active' : ''} onClick={() => setCategory('Sectoral Indices')}>Sectoral</button>
              <button className={category === 'Thematic Indices' ? 'active' : ''} onClick={() => setCategory('Thematic Indices')}>Thematic</button>
              <button className={category === 'Strategic Indices' ? 'active' : ''} onClick={() => setCategory('Strategic Indices')}>Strategic</button>
            </div>
            <button onClick={handleSelectAllVisible} className="select-all-link">
              Select All
            </button>
          </div>

          {/* --- Index List --- */}
          <div className="index-selector-list">
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
                    </label>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* --- This is the LOADING state --- */}
      {isLoading && <div className="card"><h3>Analyzing...</h3></div>}

      {/* --- This section shows ONLY when results are ready --- */}
      {analysisResult && (
        <div className="results-container">
        
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-card-title">Total Unique Stocks</div>
              <div className="summary-card-value">{analysisResult.summary.total_unique_stocks}</div>
            </div>
            <div className="summary-card">
              <div className="summary-card-title">Avg. Overlap</div>
              <div className="summary-card-value">{analysisResult.summary.avg_overlap}</div>
              <div className="summary-card-footer">per stock</div>
            </div>
            <div className="summary-card">
              <div className="summary-card-title">High Overlap Stocks</div>
              <div className_ ="summary-card-value">{analysisResult.summary.high_overlap_stocks}</div>
              <div className="summary-card-footer">in 70%+ indices</div>
            </div>
          </div>
          
          {/* Toolbar */}
          <div className="results-toolbar">
            <div className="search-bar">
              <input 
                type="text" 
                placeholder="Search stocks by symbol or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="export-button">Export Results</button>
          </div>
          
          {/* Results Table */}
          <div className="results-table-container">
            <div className="results-table-header">
              <div>Stock</div>
              <div>Appears In</div>
              <div>Indices</div>
              <div></div> {/* Column for expand button */}
            </div>
            {filteredCommonality.map(row => (
              <AnalysisResultRow 
                key={row.stock} 
                row={row}
                totalIndices={totalIndicesSelected}
              />
            ))}
          </div>
          
          {/* Insights Box */}
          <div className="insights-box">
            <strong>Analysis Insights:</strong>
            <ul>
              <li>Stocks appearing in more indices may represent core holdings across different strategies.</li>
              <li>Click on any row to expand and see the complete list of indices containing that stock.</li>
              <li>Use the search bar to quickly find specific stocks by symbol or company name.</li>
            </ul>
          </div>
          
        </div>
      )}

      {/* --- This is the "Analyze" button footer --- */}
      {/* It hides when results are shown */}
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