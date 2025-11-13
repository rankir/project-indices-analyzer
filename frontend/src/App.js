import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import SetupPage from './SetupPage';
import AnalyzePage from './AnalyzePage';
import Dashboard from './Dashboard'; // <-- IMPORT DASHBOARD
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Navbar />
        <div className="App-header">
          <Routes>
            {/* --- CHANGE THIS LINE --- */}
            <Route path="/" element={<Dashboard />} /> 
            
            <Route path="/analyze" element={<AnalyzePage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/watchlist" element={<h2>Watchlist Page (Coming Soon)</h2>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;