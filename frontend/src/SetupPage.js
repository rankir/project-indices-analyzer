import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // For navigation
import { useAlerts } from './AlertsContext'; // Import context
import './SetupPage.css';

const API_URL = "http://127.0.0.1:8000";
const CATEGORIES = ["Broad-based Indices", "Sectoral Indices", "Thematic Indices", "Strategic Indices"];
const formatDate = (d) => new Date(d).toLocaleDateString();

function SetupPage() {
  const navigate = useNavigate();
  const { alertData, setAlerts, clearAlerts } = useAlerts(); // Use Global State

  // Tabs State
  const [activeTab, setActiveTab] = useState('data_upload');

  // --- Existing State (Constituents) ---
  const [constFiles, setConstFiles] = useState([]);
  const [constMessage, setConstMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [indices, setIndices] = useState([]);
  
  // --- TV Alerts State ---
  const [tvFile, setTvFile] = useState(null);
  const [tvLoading, setTvLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  // --- Delete State ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [indexToDelete, setIndexToDelete] = useState(null);

  // --- Fetch Indices ---
  const fetchIndices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/indices`);
      setIndices(response.data);
    } catch (error) { console.error(error); }
  };
  useEffect(() => { fetchIndices(); }, []);


  // --- Handlers: Constituents (Existing) ---
  const onConstFileChange = (e) => {
    const files = Array.from(e.target.files);
    if(files.length){ setConstFiles(files); setIsModalOpen(true); }
    e.target.value = null;
  };
  const handleModalClose = () => { setIsModalOpen(false); setConstFiles([]); };
  const onConstFileUpload = async () => {
    const formData = new FormData();
    for (const file of constFiles) formData.append("files", file, file.name);
    formData.append("category", selectedCategory);
    setConstMessage('Uploading...');
    try {
      await axios.post(`${API_URL}/api/setup/upload-index`, formData);
      setConstMessage(`Success!`);
      fetchIndices();
      handleModalClose();
    } catch (error) { setConstMessage('Error uploading.'); }
  };

  // --- Handlers: TV Alerts (NEW) ---
  const onTvFileChange = (e) => setTvFile(e.target.files[0]);
  
  const onTvUpload = async () => {
    if(!tvFile) return;
    setTvLoading(true);
    const formData = new FormData();
    formData.append("file", tvFile);
    
    try {
      const res = await axios.post(`${API_URL}/api/setup/process-tradingview-alerts`, formData);
      setAlerts(res.data); // Save to Global Context
      setTvFile(null);
    } catch (error) {
      alert("Error processing alerts");
    }
    setTvLoading(false);
  };

  const handleAutoSelectNav = () => {
    navigate('/analyze');
  };

  // --- Delete Handlers (Existing) ---
  const handleDeleteIndex = async () => {
    if (!indexToDelete) return;
    await axios.delete(`${API_URL}/api/indices/${indexToDelete.id}`);
    fetchIndices();
    setDeleteModalOpen(false);
  };


  return (
    <div className="page-content">
      <h2>Data Setup & Configuration</h2>
      <p>Upload and configure your market data sources</p>

      {/* --- TABS --- */}
      <div className="setup-tabs">
        <button 
          className={activeTab === 'data_upload' ? 'active' : ''} 
          onClick={() => setActiveTab('data_upload')}
        >
          Data Upload
        </button>
        <button 
          className={activeTab === 'tv_alerts' ? 'active' : ''} 
          onClick={() => setActiveTab('tv_alerts')}
        >
          TradingView Alerts
        </button>
        <button disabled>Field Mapping</button>
        <button disabled>Settings</button>
      </div>

      {/* ================= TAB 1: DATA UPLOAD (Existing) ================= */}
      {activeTab === 'data_upload' && (
        <div className="tab-content">
           {/* ... Your existing upload boxes and list code goes here ... */}
           {/* Keeping it brief for the answer, paste your previous 'Data Upload' code block here */}
           <div className="card upload-box">
              <h3>Index Constituents</h3>
              <p>Upload .csv files (e.g., NIFTY_BANK.csv)</p>
              <label htmlFor="const-upload" className="btn-primary">Choose Files...</label>
              <input type="file" id="const-upload" multiple accept=".csv" onChange={onConstFileChange} style={{display:'none'}}/>
           </div>
           
           {/* Uploaded Files List */}
           <div className="card">
             <h3>Uploaded Files ({indices.length})</h3>
             <div className="file-list">
                {indices.map(idx => (
                    <div key={idx.id} className="file-list-item">
                        <div className="file-name">{idx.original_filename} <span className="category-pill">{idx.category}</span></div>
                        <button className="delete-btn" onClick={() => {setIndexToDelete(idx); setDeleteModalOpen(true)}}>🗑️</button>
                    </div>
                ))}
             </div>
           </div>
        </div>
      )}

      {/* ================= TAB 2: TRADINGVIEW ALERTS (NEW) ================= */}
      {activeTab === 'tv_alerts' && (
        <div className="tab-content">
          
          {/* 1. Info Box */}
          <div className="info-box">
            <h4>ⓘ TradingView Alerts Upload Guidelines</h4>
            <ul>
              <li>Upload CSV files exported from TradingView alerts</li>
              <li>Required columns: Alert ID, Ticker, Name, Description, Time</li>
              <li>System will auto-detect 52-Week High/Low from Description</li>
            </ul>
          </div>

          {/* 2. Uploader */}
          <div className="card dashed-uploader">
             <div className="upload-icon">📄</div>
             <h3>Upload TradingView Alerts</h3>
             <p>Upload one or multiple CSV files</p>
             <input type="file" accept=".csv" onChange={onTvFileChange} />
             <button className="btn-primary" onClick={onTvUpload} disabled={!tvFile || tvLoading}>
               {tvLoading ? "Processing..." : "Upload Alerts"}
             </button>
          </div>

          {/* 3. Dashboard (Only if data exists) */}
          {alertData && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                    <div className="label">Total Alerts</div>
                    <div className="value">{alertData.summary.total_alerts}</div>
                </div>
                <div className="stat-card">
                    <div className="label">52W Highs</div>
                    <div className="value green">{alertData.summary.highs}</div>
                </div>
                <div className="stat-card">
                    <div className="label">52W Lows</div>
                    <div className="value red">{alertData.summary.lows}</div>
                </div>
              </div>

              {/* Auto Mapped Indices */}
              <div className="card auto-map-card">
                <h4>Auto-Mapped Indices</h4>
                <div className="mapped-pills">
                    {/* Unique mapped indices */}
                    {[...new Set(alertData.records.filter(r=>r.mapped_index_name !== "Not mapped").map(r=>r.mapped_index_name))]
                     .map(name => <span key={name} className="pill purple">{name}</span>)
                    }
                </div>
                <p>These indices have been automatically detected from your alerts.</p>
                <button className="btn-full-width" onClick={handleAutoSelectNav}>
                    Auto-Select in Analyze Page
                </button>
              </div>

              {/* Details Table */}
              <div className="card">
                <div className="card-header-row">
                    <h3>Uploaded Alert File</h3>
                    <button className="btn-text" onClick={clearAlerts} style={{color:'red'}}>Clear All</button>
                </div>
                
                <div className="file-details-header">
                    <span>{alertData.filename}</span>
                    <div className="badges">
                        <span className="badge-black">~ {alertData.summary.highs} Highs</span>
                        <span className="badge-black">~ {alertData.summary.lows} Lows</span>
                    </div>
                    <button onClick={() => setShowDetails(!showDetails)}>
                        {showDetails ? "Hide Details" : "Show Details"}
                    </button>
                </div>

                {showDetails && (
                    <table className="alerts-table">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Flag Type</th>
                                <th>Mapped Index</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alertData.records.map((row, i) => (
                                <tr key={i}>
                                    <td>{row.ticker}</td>
                                    <td>
                                        <span className={`flag-badge ${row.flag_type.toLowerCase()}`}>
                                            {row.flag_type}
                                        </span>
                                    </td>
                                    <td className={row.mapped_index_id ? "mapped" : "unmapped"}>
                                        {row.mapped_index_name || "Not mapped"}
                                    </td>
                                    <td>{row.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Config (Existing) */}
      {isModalOpen && (
         <div className="modal-backdrop">
            <div className="modal-content card">
               <h4>Select Category</h4>
               <select onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option>Select...</option>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
               </select>
               <div className="modal-actions">
                 <button className="btn-secondary" onClick={handleModalClose}>Cancel</button>
                 <button className="btn-primary" onClick={onConstFileUpload}>Upload</button>
               </div>
            </div>
         </div>
      )}
      
      {/* Delete Modal (Existing) */}
      {deleteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <h4>Delete?</h4>
            <button className="btn-danger" onClick={handleDeleteIndex}>Confirm</button>
            <button className="btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default SetupPage;