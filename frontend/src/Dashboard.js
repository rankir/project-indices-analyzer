import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAlerts } from './AlertsContext';
import './Dashboard.css';

const API_URL = "http://127.0.0.1:8000";

function Dashboard() {
  const navigate = useNavigate();
  const { alertData } = useAlerts(); // Get global alert data
  const [indicesCount, setIndicesCount] = useState(0);

  // Fetch total indices count
  useEffect(() => {
    axios.get(`${API_URL}/api/indices`)
      .then(res => setIndicesCount(res.data.length))
      .catch(err => console.error(err));
  }, []);

  // Calculate percentages for the progress bar
  const totalAlerts = alertData ? alertData.summary.total_alerts : 0;
  const highs = alertData ? alertData.summary.highs : 0;
  const lows = alertData ? alertData.summary.lows : 0;
  
  const highPct = totalAlerts > 0 ? (highs / totalAlerts) * 100 : 0;
  const lowPct = totalAlerts > 0 ? (lows / totalAlerts) * 100 : 0;

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <header className="dashboard-header">
        <div>
          <h1>Market Dashboard</h1>
          <p className="subtitle">Overview of your tracked indices and market breadth</p>
        </div>
        <div className="date-badge">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="stats-grid">
        {/* Card 1: Total Indices */}
        <div className="stat-card">
          <div className="stat-icon blue">📊</div>
          <div className="stat-content">
            <div className="stat-label">Indices Tracked</div>
            <div className="stat-value">{indicesCount}</div>
          </div>
        </div>

        {/* Card 2: Alerts Today */}
        <div className="stat-card">
          <div className="stat-icon purple">⚡</div>
          <div className="stat-content">
            <div className="stat-label">Alerts Today</div>
            <div className="stat-value">{totalAlerts}</div>
          </div>
        </div>

        {/* Card 3: Market Mood (Highs - Lows) */}
        <div className="stat-card">
          <div className="stat-icon green">📈</div>
          <div className="stat-content">
            <div className="stat-label">Market Mood</div>
            <div className="stat-value">
              {highs > lows ? 'Bullish' : lows > highs ? 'Bearish' : 'Neutral'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dashboard-main">
        
        {/* Left Column: Market Breadth */}
        <div className="dashboard-section card">
          <h3>Market Breadth (52-Week High/Low)</h3>
          
          {alertData ? (
            <div className="breadth-visualizer">
              <div className="breadth-stats">
                <div className="breadth-stat green">
                  <span className="count">{highs}</span>
                  <span className="label">New Highs</span>
                </div>
                <div className="breadth-stat red">
                  <span className="count">{lows}</span>
                  <span className="label">New Lows</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="breadth-bar-container">
                <div className="breadth-bar green" style={{ width: `${highPct}%` }}></div>
                <div className="breadth-bar red" style={{ width: `${lowPct}%` }}></div>
              </div>
              
              <div className="action-buttons">
                <button className="btn-outline" onClick={() => navigate('/analyze')}>
                  View High Momentum Indices →
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>No TradingView alerts uploaded yet.</p>
              <button className="btn-primary" onClick={() => navigate('/setup')}>
                Upload Alerts
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Quick Links / Recent Activity */}
        <div className="dashboard-section card">
          <h3>Quick Actions</h3>
          <div className="quick-links">
            <button className="quick-link-item" onClick={() => navigate('/setup')}>
              <span className="icon">📂</span>
              <div className="text">
                <strong>Manage Data</strong>
                <span>Upload new constituents or alerts</span>
              </div>
              <span className="arrow">→</span>
            </button>

            <button className="quick-link-item" onClick={() => navigate('/analyze')}>
              <span className="icon">🔍</span>
              <div className="text">
                <strong>Deep Analysis</strong>
                <span>Analyze overlap and common stocks</span>
              </div>
              <span className="arrow">→</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;