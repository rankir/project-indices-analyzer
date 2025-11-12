import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import SetupPage from './SetupPage';
import AnalyzePage from './AnalyzePage';
import './App.css'; // Keep the existing styles

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Navbar />
        {/* The 'App-header' will now be our main content area */}
        <div className="App-header">
          <Routes>
            {/* We'll make a Dashboard later, for now it's a placeholder */}
            <Route path="/" element={<h2>Dashboard Page (Coming Soon)</h2>} />
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