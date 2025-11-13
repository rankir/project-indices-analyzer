import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from './AlertsContext';
import './SetupPage.css';

const API_URL = "http://127.0.0.1:8000";
const CATEGORIES = ["Broader Indices", "Sectorial Indices", "Thematic Indices", "Strategic Indices"];

function SetupPage() {
  const navigate = useNavigate();
  const { alertData, setAlerts, clearAlerts } = useAlerts();
  
  // --- Tabs State ---
  // Default to Master Config as it's the first logical step
  const [activeTab, setActiveTab] = useState('master_config'); 

  // --- Common Data State ---
  const [indices, setIndices] = useState([]);
  
  // --- State: Master Config ---
  const [masterFile, setMasterFile] = useState(null);
  
  // --- State: Data Filling (Constituents) ---
  const [constMessage, setConstMessage] = useState('');
  
  // --- State: Manual Mapping Modal ---
  // Used when a constituent file doesn't match the Master Config
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [fileToMap, setFileToMap] = useState(null); 
  const [selectedIndexId, setSelectedIndexId] = useState(''); 

  // --- State: TV Alerts ---
  const [tvFile, setTvFile] = useState(null);
  const [tvLoading, setTvLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  // --- State: Delete ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [indexToDelete, setIndexToDelete] = useState(null);

  // ============================================================
  // 1. DATA FETCHING
  // ============================================================
  const fetchIndices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/indices`);
      setIndices(response.data);
    } catch (error) { console.error(error); }
  };
  useEffect(() => { fetchIndices(); }, []);


  // ============================================================
  // 2. MASTER CONFIG HANDLERS
  // ============================================================
  const onMasterUpload = async () => {
    if(!masterFile) return;
    const formData = new FormData();
    formData.append("file", masterFile);
    
    try {
      const res = await axios.post(`${API_URL}/api/setup/master-config`, formData);
      alert(`Success! Updated ${res.data.count} indices from Master.`);
      fetchIndices();
      setMasterFile(null);
    } catch (e) { 
      alert("Error uploading master config"); 
    }
  };


  // ============================================================
  // 3. DATA FILLING (CONSTITUENT) HANDLERS
  // ============================================================
  
  // Triggered when user selects files
  const onConstFileChange = (e) => {
    const files = Array.from(e.target.files);
    if(files.length) {
      handleConstituentUploadFlow(files); // Start the upload flow
    }
    e.target.value = null;
  };

  // Core Upload Logic
  // If indexIdOverride is provided, we are fixing a specific file map
  const handleConstituentUploadFlow = async (files, indexIdOverride = null) => {
    const formData = new FormData();
    
    if (indexIdOverride && fileToMap) {
      // CASE A: Manual Mapping Fix
      formData.append("files", fileToMap, fileToMap.name);
      formData.append("index_id", indexIdOverride); // Send the ID user chose
    } else {
      // CASE B: Bulk Auto-Match
      for (const file of files) formData.append("files", file, file.name);
    }

    setConstMessage('Uploading...');
    
    try {
      const response = await axios.post(`${API_URL}/api/setup/upload-index`, formData);
      const data = response.data;
      
      // CHECK FOR ERRORS
      // The backend returns errors list. We check if any say "Unknown file"
      const unknownError = data.errors.find(e => e.includes("Unknown file"));
      
      if (unknownError) {
        // Parse the filename from the error string "Filename.csv: Unknown file..."
        const badFileName = unknownError.split(':')[0];
        const badFile = files.find(f => f.name === badFileName);
        
        if (badFile) {
          setFileToMap(badFile);
          setIsMappingModalOpen(true); // Open the mapping modal
          setConstMessage(`Could not auto-match ${badFileName}. Please link it.`);
          return; // Stop here, let user fix it
        }
      }

      setConstMessage(data.detail);
      fetchIndices();
      
      // Reset Mapping State
      setIsMappingModalOpen(false);
      setFileToMap(null);
      setSelectedIndexId('');
      
    } catch (error) {
      setConstMessage('Error uploading files.');
    }
  };

  // Called from the Mapping Modal
  const onManualLinkUpload = () => {
     if (!selectedIndexId) return;
     handleConstituentUploadFlow([fileToMap], selectedIndexId);
  };


  // ============================================================
  // 4. TRADINGVIEW ALERTS HANDLERS (Existing)
  // ============================================================
  const onTvFileChange = (e) => setTvFile(e.target.files[0]);
  
  const onTvUpload = async () => {
    if(!tvFile) return;
    setTvLoading(true);
    const formData = new FormData();
    formData.append("file", tvFile);
    try {
      const res = await axios.post(`${API_URL}/api/setup/process-tradingview-alerts`, formData);
      setAlerts(res.data); 
      setTvFile(null);
    } catch (error) { alert("Error processing alerts"); }
    setTvLoading(false);
  };

  const handleAutoSelectNav = () => navigate('/analyze');


  // ============================================================
  // 5. DELETE HANDLERS (Existing)
  // ============================================================
  const handleDeleteIndex = async () => {
    if (!indexToDelete) return;
    await axios.delete(`${API_URL}/api/indices/${indexToDelete.id}`);
    fetchIndices();
    setDeleteModalOpen(false);
  };


  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="page-content">
      <h2>Data Setup & Configuration</h2>

      {/* --- TABS --- */}
      <div className="setup-tabs">
        <button 
          className={activeTab === 'master_config' ? 'active' : ''} 
          onClick={() => setActiveTab('master_config')}
        >
          Master Config
        </button>
        <button 
          className={activeTab === 'data_upload' ? 'active' : ''} 
          onClick={() => setActiveTab('data_upload')}
        >
          Data Filling
        </button>
        <button 
          className={activeTab === 'tv_alerts' ? 'active' : ''} 
          onClick={() => setActiveTab('tv_alerts')}
        >
          TradingView Alerts
        </button>
      </div>

      {/* ================= TAB 1: MASTER CONFIG ================= */}
      {activeTab === 'master_config' && (
        <div className="tab-content">
          <div className="info-box">
            <h4>👑 Phase 1: Master Configuration</h4>
            <p>Upload the "Rosetta Stone" CSV to define your Index Skeleton.</p>
            <p>Required Columns: <code>Name, DisplayName, Category, TVTicker, Filename</code></p>
          </div>
          
          <div className="card dashed-uploader">
             <h3>Upload Master CSV</h3>
             <input type="file" accept=".csv" onChange={(e) => setMasterFile(e.target.files[0])} />
             <button className="btn-primary" onClick={onMasterUpload} disabled={!masterFile}>
               Update Master Schema
             </button>
          </div>

          {/* Master Skeleton View */}
          <div className="card">
            <h3>Defined Indices (Skeleton)</h3>
            <table className="alerts-table"> {/* Reusing table style */}
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Category</th>
                  <th>TV Ticker</th>
                  <th>Expected File</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {indices.map(idx => (
                  <tr key={idx.id}>
                    <td>{idx.display_name}</td>
                    <td><span className="category-pill">{idx.category}</span></td>
                    <td>{idx.tv_ticker || '-'}</td>
                    <td>{idx.expected_filename || '-'}</td>
                    <td>
                      {idx.record_count > 0 
                        ? <span className="pill-52wh" style={{background:'#10b981'}}>Active ({idx.record_count})</span> 
                        : <span className="pill-52wh" style={{background:'#ccc', color: '#666'}}>Empty</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: DATA FILLING ================= */}
      {activeTab === 'data_upload' && (
        <div className="tab-content">
           <div className="info-box">
            <h4>💪 Phase 2: Data Filling</h4>
            <p>Upload Constituent CSVs. We will auto-match them to the Master Skeleton based on filename.</p>
          </div>

           {/* Upload Box */}
           <div className="card upload-box">
              <h3>Upload Constituent Files</h3>
              <p>Select one or multiple .csv files</p>
              <label htmlFor="const-upload" className="btn-primary">Choose Files...</label>
              <input type="file" id="const-upload" multiple accept=".csv" onChange={onConstFileChange} style={{display:'none'}}/>
              {constMessage && <p style={{marginTop:15, fontWeight:'bold'}}>{constMessage}</p>}
           </div>
           
           {/* Uploaded Files List */}
           <div className="card">
             <h3>Uploaded Files ({indices.filter(i=>i.record_count > 0).length})</h3>
             <div className="file-list">
                {indices.filter(i=>i.record_count > 0).map(idx => (
                    <div key={idx.id} className="file-list-item">
                        <div className="file-name">
                          {idx.original_filename} 
                          <span className="category-pill">{idx.category}</span>
                        </div>
                        <div style={{display:'flex', gap:10, alignItems:'center'}}>
                           <span style={{fontSize:12, color:'#888'}}>{idx.record_count} records</span>
                           <button className="delete-btn" onClick={() => {setIndexToDelete(idx); setDeleteModalOpen(true)}}>🗑️</button>
                        </div>
                    </div>
                ))}
             </div>
           </div>
        </div>
      )}

      {/* ================= TAB 3: TRADINGVIEW ALERTS ================= */}
      {activeTab === 'tv_alerts' && (
        <div className="tab-content">
          <div className="info-box">
            <h4>ⓘ TradingView Alerts Upload Guidelines</h4>
            <ul>
              <li>Upload CSV files exported from TradingView alerts</li>
              <li>System will auto-detect 52-Week High/Low from Description</li>
            </ul>
          </div>

          <div className="card dashed-uploader">
             <div className="upload-icon">📄</div>
             <h3>Upload TradingView Alerts</h3>
             <input type="file" accept=".csv" onChange={onTvFileChange} />
             <button className="btn-primary" onClick={onTvUpload} disabled={!tvFile || tvLoading}>
               {tvLoading ? "Processing..." : "Upload Alerts"}
             </button>
          </div>

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

              <div className="card auto-map-card">
                <h4>Auto-Mapped Indices</h4>
                <div className="mapped-pills">
                    {[...new Set(alertData.records.filter(r=>r.mapped_index_name !== "Not mapped").map(r=>r.mapped_index_name))]
                     .map(name => <span key={name} className="pill purple">{name}</span>)
                    }
                </div>
                <button className="btn-full-width" onClick={handleAutoSelectNav}>
                    Auto-Select in Analyze Page
                </button>
              </div>

              <div className="card">
                <div className="card-header-row">
                    <h3>Uploaded Alert File</h3>
                    <button className="btn-text" onClick={clearAlerts} style={{color:'red'}}>Clear All</button>
                </div>
                <div className="file-details-header">
                    <span>{alertData.filename}</span>
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
                                    <td><span className={`flag-badge ${row.flag_type.toLowerCase()}`}>{row.flag_type}</span></td>
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

      {/* ================= MODALS ================= */}
      
      {/* Manual Mapping Modal (NEW) */}
      {isMappingModalOpen && (
         <div className="modal-backdrop">
            <div className="modal-content card">
               <h4 style={{color:'#f59e0b'}}>⚠️ Unknown File Detected</h4>
               <p>We don't recognize the file <strong>{fileToMap?.name}</strong>.</p>
               <p style={{fontSize:14, color:'#666'}}>Please link it to one of your Master Indices:</p>
               
               <select 
                 value={selectedIndexId} 
                 onChange={(e) => setSelectedIndexId(e.target.value)}
                 style={{width:'100%', padding:8, marginTop:10, marginBottom:20}}
               >
                  <option value="">Select Index...</option>
                  {indices.map(idx => (
                     <option key={idx.id} value={idx.id}>{idx.display_name}</option>
                  ))}
               </select>
               
               <div className="modal-actions">
                 <button className="btn-secondary" onClick={() => {setIsMappingModalOpen(false); setFileToMap(null);}}>Cancel</button>
                 <button className="btn-primary" onClick={onManualLinkUpload} disabled={!selectedIndexId}>Link & Upload</button>
               </div>
            </div>
         </div>
      )}
      
      {/* Delete Modal (Existing) */}
      {deleteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <h4>Delete?</h4>
            <p>This will clear the data for <strong>{indexToDelete?.display_name}</strong>.</p>
            <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
                <button className="btn-danger" onClick={handleDeleteIndex}>Confirm</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SetupPage;