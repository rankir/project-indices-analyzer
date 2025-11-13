import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAlerts } from './AlertsContext';
import './AnalyzePage.css'; // We will overhaul this CSS next

const API_URL = "http://127.0.0.1:8000";
const CATEGORIES = ["Broader Indices", "Sectorial Indices", "Thematic Indices", "Strategic Indices"];

// --- Helper: Results Row Component ---
function AnalysisResultRow({ row, totalIndices }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const indicesToShow = row.indices.slice(0, 3);
  const moreCount = row.indices.length - 3;

  return (
    <>
      <div className="results-table-row" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="stock-info">
          <div className="stock-ticker">{row.stock}</div>
        </div>
        <div className="overlap-pill">
          {row.appears_in}/{totalIndices}
        </div>
        <div className="indices-pills">
          {indicesToShow.map(name => <span key={name}>{name}</span>)}
          {moreCount > 0 && <span className="more-pill">+{moreCount}</span>}
        </div>
        <button className={`expand-button ${isExpanded ? 'expanded' : ''}`}>▼</button>
      </div>
      {isExpanded && (
        <div className="row-expansion">
          <div className="row-expansion-title">Found in:</div>
          <div className="row-expansion-list">
            {row.indices.map(name => <span key={name} className="pill-small">{name}</span>)}
          </div>
        </div>
      )}
    </>
  );
}

// --- MAIN COMPONENT ---
function AnalyzePage() {
  const { alertData } = useAlerts();
  
  // Data State
  const [indices, setIndices] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // UI State
  const [stockSearch, setStockSearch] = useState('');
  const [stockSearchResults, setStockSearchResults] = useState([]); // Indices containing searched stock
  const [resultsSearch, setResultsSearch] = useState(''); // Filtering the results table
  const [expandedCategories, setExpandedCategories] = useState(CATEGORIES); // All open by default

  // 1. Fetch Indices
  useEffect(() => {
    axios.get(`${API_URL}/api/indices`).then(res => setIndices(res.data));
  }, []);

  // 2. Handle Stock Search (Find Index by Stock)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (stockSearch.length > 1) {
        try {
          const res = await axios.get(`${API_URL}/api/search/stock-indices?q=${stockSearch}`);
          setStockSearchResults(res.data.map(i => i.id));
        } catch (e) { console.error(e); }
      } else {
        setStockSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [stockSearch]);

  // 3. Selection Logic
  const toggleIndex = (index) => {
    setSelectedIndices(prev => {
      const exists = prev.find(i => i.id === index.id);
      if (exists) return prev.filter(i => i.id !== index.id);
      return [...prev, index];
    });
  };

  const toggleCategory = (cat) => {
    const categoryIndices = indices.filter(i => (i.category || 'Uncategorized') === cat);
    const allSelected = categoryIndices.every(i => selectedIndices.find(s => s.id === i.id));
    
    if (allSelected) {
      // Deselect all in category
      setSelectedIndices(prev => prev.filter(s => s.category !== cat));
    } else {
      // Select all in category (merge unique)
      const newSelection = [...selectedIndices];
      categoryIndices.forEach(i => {
        if (!newSelection.find(s => s.id === i.id)) newSelection.push(i);
      });
      setSelectedIndices(newSelection);
    }
  };

  const toggleAccordion = (cat) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // 4. Analysis Logic (Auto-run when selection changes, with debounce)
  useEffect(() => {
    if (selectedIndices.length === 0) {
      setAnalysisResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const ids = selectedIndices.map(i => i.id);
        const res = await axios.post(`${API_URL}/api/analysis/common-stocks`, { index_ids: ids });
        setAnalysisResult(res.data);
      } catch (e) { console.error(e); }
      setIsLoading(false);
    }, 800); // 800ms debounce to prevent spamming API while selecting
    return () => clearTimeout(timer);
  }, [selectedIndices]);


  // 5. Helpers
  const getCategoryCount = (cat) => selectedIndices.filter(i => i.category === cat).length;
  
  const filteredCommonality = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.commonality.filter(item => 
      item.stock.toLowerCase().includes(resultsSearch.toLowerCase())
    );
  }, [analysisResult, resultsSearch]);


  return (
    <div className="analyze-layout">
      
      {/* === LEFT SIDEBAR: CONFIGURATION === */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h3>Index Configuration</h3>
          <button className="btn-text" onClick={() => setSelectedIndices([])}>Reset All</button>
        </div>

        {/* Stock Finder Input */}
        <div className="stock-finder">
          <label>Find indices containing stock:</label>
          <input 
            type="text" 
            placeholder="e.g. RELIANCE..." 
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />
          {stockSearch && <small>{stockSearchResults.length} indices found</small>}
        </div>

        {/* Categories Accordion */}
        <div className="categories-list">
          {CATEGORIES.map(cat => {
            const catIndices = indices.filter(i => (i.category || 'Uncategorized') === cat);
            const isOpen = expandedCategories.includes(cat);

            // Always render the accordion header so categories are visible even when empty
            return (
              <div key={cat} className={`category-accordion ${isOpen ? 'open' : ''} ${catIndices.length === 0 ? 'empty' : ''}`}>
                <div className="accordion-header" onClick={() => toggleAccordion(cat)}>
                  <span>{cat}</span>
                  <span className="arrow">{isOpen ? '▼' : '▶'}</span>
                </div>

                {isOpen && (
                  <div className="accordion-content">
                    <div className="accordion-actions">
                        <button onClick={() => toggleCategory(cat)} disabled={catIndices.length === 0}>
                          {catIndices.length === 0 ? 'No indices' : 'Select/Deselect All'}
                        </button>
                        <span>{getCategoryCount(cat)} selected</span>
                    </div>

                    {catIndices.length === 0 ? (
                      <div className="category-empty">No indices uploaded for this category.</div>
                    ) : (
                      catIndices.map(idx => {
                        const isSelected = !!selectedIndices.find(s => s.id === idx.id);
                        // Highlight if it matches Stock Search OR Alert
                        const isMatch = stockSearchResults.includes(idx.id);
                        const isAlert = alertData?.records.some(r => r.mapped_index_id === idx.id);

                        return (
                          <div 
                            key={idx.id} 
                            className={`sidebar-item ${isSelected ? 'selected' : ''} ${isMatch ? 'highlight-match' : ''}`}
                            onClick={() => toggleIndex(idx)}
                          >
                            <div className="checkbox">{isSelected && '✓'}</div>
                            <div className="item-name">
                              {idx.display_name}
                              {isAlert && <span className="dot-alert" title="From Alerts">•</span>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>


      {/* === RIGHT MAIN: ANALYSIS DASHBOARD === */}
      <main className="analysis-main">
        
        {/* Top Panel: Selected Indices Summary */}
        <div className="selected-panel-dark">
            <div className="panel-header">
                <h2>Selected Indices ({selectedIndices.length})</h2>
                <span className="sub-text">Real-time overlap analysis</span>
            </div>
            <div className="selected-tags-container">
                {selectedIndices.length === 0 ? (
                    <p className="empty-text">Select indices from the sidebar to begin analysis.</p>
                ) : (
                    selectedIndices.map(idx => (
                        <span key={idx.id} className="selected-tag">
                            {idx.display_name}
                            <button onClick={(e) => {e.stopPropagation(); toggleIndex(idx);}}>×</button>
                        </span>
                    ))
                )}
            </div>
        </div>

        {/* Stats & Results */}
        {analysisResult ? (
            <div className="analysis-content">
                {/* Stats Cards */}
                <div className="stats-row">
                    <div className="stat-box">
                        <label>Total Stocks</label>
                        <div className="val">{analysisResult.summary.total_unique_stocks}</div>
                    </div>
                    <div className="stat-box">
                        <label>Avg. Overlap</label>
                        <div className="val">{analysisResult.summary.avg_overlap}</div>
                        <small>indices per stock</small>
                    </div>
                    <div className="stat-box highlight">
                        <label>High Overlap</label>
                        <div className="val">{analysisResult.summary.high_overlap_stocks}</div>
                        <small>stocks in &gt;70% indices</small>
                    </div>
                </div>

                {/* Results Toolbar */}
                <div className="results-header">
                    <h3>Common Stocks Analysis</h3>
                    <input 
                        type="text" 
                        placeholder="Filter results..." 
                        value={resultsSearch}
                        onChange={(e) => setResultsSearch(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="table-wrapper">
                    <div className="table-head">
                        <div>Stock Ticker</div>
                        <div>Overlap Count</div>
                        <div>Indices</div>
                        <div></div>
                    </div>
                    <div className="table-body">
                        {filteredCommonality.map(row => (
                            <AnalysisResultRow 
                                key={row.stock} 
                                row={row} 
                                totalIndices={selectedIndices.length} 
                            />
                        ))}
                        {filteredCommonality.length === 0 && <div className="no-results">No stocks found matching filter.</div>}
                    </div>
                </div>
            </div>
        ) : (
            <div className="placeholder-state">
                {isLoading ? <div className="loader">Analyzing data...</div> : "Add indices to see overlap analysis"}
            </div>
        )}
      </main>
    </div>
  );
}

export default AnalyzePage;