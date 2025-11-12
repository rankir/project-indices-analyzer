import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SetupPage.css'; // We'll add new styles here

const API_URL = "http://127.0.0.1:8000";
const CATEGORIES = [
  "Broad-based Indices", 
  "Sectoral Indices", 
  "Thematic Indices", 
  "Strategic Indices"
];

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
};

function SetupPage() {
  // --- Constituent Uploader State ---
  const [constFiles, setConstFiles] = useState([]); // <-- Changed to array
  const [constMessage, setConstMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  // --- 52WH Uploader State ---
  const [alertFile, setAlertFile] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');

  // --- Data State ---
  const [indices, setIndices] = useState([]);
  const [unmappedNames, setUnmappedNames] = useState([]);
  const [mapping, setMapping] = useState({});
  
  // --- Delete Modal State ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [indexToDelete, setIndexToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // --- Function to fetch indices ---
  const fetchIndices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/indices`);
      setIndices(response.data);
    } catch (error) {
      console.error("Error fetching indices:", error);
    }
  };

  // --- Load indices on page load ---
  useEffect(() => {
    fetchIndices();
  }, []);

  // --- 1. CONSTITUENT UPLOADER HANDLERS ---
  const onConstFileChange = (event) => {
    const files = Array.from(event.target.files); // Convert FileList to Array
    if (files.length > 0) {
      setConstFiles(files);
      setSelectedCategory('');
      setConstMessage('');
      setIsModalOpen(true); // Open the modal
    }
    // Clear the input value so selecting the same file again works
    event.target.value = null;
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setConstFiles([]); // <-- Clear array
    setConstMessage('');
  };

  const onConstFileUpload = async () => {
    if (constFiles.length === 0) return; // Should not happen
    if (!selectedCategory) {
      setConstMessage('Please select a category.');
      return;
    }

    const formData = new FormData();
    // Append each file with the *same key* "files"
    for (const file of constFiles) {
        formData.append("files", file, file.name);
    }
    formData.append("category", selectedCategory); // Add the category
    
    setConstMessage('Uploading...');
    
    try {
      const response = await axios.post(`${API_URL}/api/setup/upload-index`, formData);
      const data = response.data;
      // Use the new summary message from the backend
      setConstMessage(data.detail + (data.errors.length > 0 ? ` (${data.errors.length} errors)` : ''));
      fetchIndices(); // Refresh the index list
      handleModalClose(); // Close modal on success
      setTimeout(() => setConstMessage(''), 5000); // Clear message
    } catch (error) {
      console.error("Error uploading files:", error);
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        setConstMessage(errorDetail);
      } else if (errorDetail?.errors) {
          setConstMessage(`Upload failed: ${errorDetail.errors[0]}`);
      } else {
        setConstMessage('Error uploading files.');
      }
    }
  };

  // --- 2. 52WH ALERT UPLOADER HANDLERS (Unchanged) ---
  const onAlertFileChange = (event) => {
    setAlertFile(event.target.files[0]);
    setAlertMessage('');
  };
  const onAlertFileUpload = async () => {
    if (!alertFile) {
      setAlertMessage('Please select a file first.');
      return;
    }
    // ... (rest of function is unchanged)
    const formData = new FormData();
    formData.append("file", alertFile, alertFile.name);
    setAlertMessage('Processing alerts...');
    try {
      const response = await axios.post(`${API_URL}/api/setup/process-52wh-alerts`, formData);
      const data = response.data.data;
      setAlertMessage(`Success! ${data.updated_count} indices set to 52WH.`);
      if (data.unmapped_names.length > 0) {
        setUnmappedNames(data.unmapped_names);
        setAlertMessage(`Success, but ${data.unmapped_names.length} new names need mapping.`);
      }
      setAlertFile(null);
    } catch (error) {
      console.error("Error processing file:", error);
      setAlertMessage('Error processing file.');
    }
  };


  // --- 3. MAPPING HANDLERS (Unchanged) ---
  const handleMapChange = (tv_name, index_id) => {
    setMapping({ ...mapping, [tv_name]: index_id });
  };
  const onSaveMapping = async (tv_name) => {
    // ... (rest of function is unchanged) ...
    const index_id = mapping[tv_name];
    if (!index_id) {
      alert("Please select an index to map to.");
      return;
    }
    try {
      await axios.post(`${API_URL}/api/setup/save-mapping`, { tv_alert_name: tv_name, index_id: parseInt(index_id) });
      setUnmappedNames(unmappedNames.filter(name => name !== tv_name));
    } catch (error) {
      console.error("Error saving map:", error);
      alert("Error saving map. See console.");
    }
  };
  
  // --- 4. DELETE HANDLERS (Unchanged) ---
  const openDeleteModal = (index) => {
    setIndexToDelete(index);
    setDeleteError('');
    setDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
    setIndexToDelete(null);
    setDeleteModalOpen(false);
  };
  const handleDeleteIndex = async () => {
    // ... (rest of function is unchanged) ...
    if (!indexToDelete) return;
    try {
      await axios.delete(`${API_URL}/api/indices/${indexToDelete.id}`);
      fetchIndices();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting index:", error);
      setDeleteError('Failed to delete file. Please try again.');
    }
  };


  // --- RENDER ---
  return (
    <>
      {/* --- Category Modal --- */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <h4>Select Index Category</h4>
            
            {/* --- NEW: File List Display --- */}
            <div className="modal-file-list">
              <span>{constFiles.length} files selected:</span>
              <ul>
                {constFiles.map(file => (
                  <li key={file.name}>📄 {file.name}</li>
                ))}
              </ul>
            </div>
            
            <label htmlFor="category-select">Choose a category for these files *</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="" disabled>Select category...</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            {constMessage && <p className="modal-message">{constMessage}</p>}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleModalClose}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={onConstFileUpload}
                disabled={!selectedCategory || constMessage === 'Uploading...'}
              >
                {/* --- Dynamic Button Text --- */}
                {constMessage === 'Uploading...' ? 'Uploading...' : `Upload ${constFiles.length} Files`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Delete Modal (Unchanged) --- */}
      {deleteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content card">
             {/* ... (this modal JSX is unchanged) ... */}
            <h4 style={{ color: '#ef4444' }}>Delete File?</h4>
            <p>
              This will permanently remove <strong>{indexToDelete?.original_filename}</strong> and all its {indexToDelete?.record_count} associated records from the database. This action cannot be undone.
            </p>
            {deleteError && <p className="modal-message" style={{color: '#ef4444'}}>{deleteError}</p>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeDeleteModal}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteIndex}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Page Content --- */}
      <div className="page-content">
        <h2>Data Setup & Configuration</h2>
        <p>Upload and configure your market data sources</p>

        {/* --- Upload Section --- */}
        <div className="upload-container">
          {/* Box 1: Index Constituents */}
          <div className="card upload-box">
            <h3>Index Constituents</h3>
            <p>Upload .csv files (e.g., NIFTY_BANK.csv) with stock tickers.</p>
            <label htmlFor="constituent-upload" className="btn-primary">
              Choose Files...
            </label>
            <input 
              type="file" 
              accept=".csv" 
              id="constituent-upload"
              multiple // <-- ADD 'multiple' ATTRIBUTE
              onChange={onConstFileChange} 
              style={{ display: 'none' }} 
            />
            {constMessage && !isModalOpen && <p>{constMessage}</p>}
          </div>

          {/* Box 2: 52WH Alerts (Unchanged) */}
          <div className="card upload-box">
            <h3>52-Week High Alerts</h3>
            <p>Upload .csv from TradingView alerts. (e.g., NSE:NIFTYBANK)</p>
            <label htmlFor="alert-upload" className="btn-primary">
              Choose File...
            </label>
            <input 
              type="file" 
              accept=".csv" 
              id="alert-upload"
              onChange={onAlertFileChange} 
              style={{ display: 'none' }}
            />
            <button 
              onClick={onAlertFileUpload} 
              disabled={!alertFile}
              style={{ marginTop: '10px' }}
            >
              Upload Alerts
            </button>
            {alertMessage && <p>{alertMessage}</p>}
          </div>
        </div>

        {/* --- Mapping Section (Unchanged) --- */}
        {unmappedNames.length > 0 && (
          <div className="card">
            {/* ... (this section is unchanged) ... */}
             <h3>Map New TradingView Alerts</h3>
            <div className="mapping-list">
              {unmappedNames.map(name => (
                <div key={name} className="mapping-item">
                  <span className="tv-name">{name}</span>
                  <select 
                    value={mapping[name] || ''} 
                    onChange={(e) => handleMapChange(name, e.target.value)}
                  >
                    <option value="" disabled>Select index...</option>
                    {indices.map(index => (
                      <option key={index.id} value={index.id}>
                        {index.display_name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => onSaveMapping(name)}>Save</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Uploaded Indices List (Unchanged) --- */}
        <div className="card">
            {/* ... (this section is unchanged) ... */}
            <div className="uploaded-files-header">
                <h3>Uploaded Files ({indices.length})</h3>
            </div>
            <div className="file-list">
                {indices.length === 0 ? (
                <p>No files uploaded yet.</p>
                ) : (
                indices.map(index => (
                    <div key={index.id} className="file-list-item">
                    <div className="file-icon">
                        <span>📄</span> 
                    </div>
                    <div className="file-details">
                        <div className="file-name">
                        {index.original_filename}
                        <span className="category-pill">{index.category}</span>
                        </div>
                        <div className="file-meta">
                        <span>{index.file_size_kb?.toFixed(2)} KB</span>
                        <span>•</span>
                        <span>{index.record_count} records</span>
                        <span>•</span>
                        <span>Uploaded {formatDate(index.upload_date)}</span>
                        </div>
                    </div>
                    <div className="file-actions">
                        <button className="delete-btn" onClick={() => openDeleteModal(index)}>
                        🗑️
                        </button>
                    </div>
                    </div>
                ))
                )}
            </div>
        </div>
      </div>
    </>
  );
}

export default SetupPage;