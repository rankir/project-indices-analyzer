import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css'; // We will create this file for styling

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <NavLink to="/" className="nav-logo">IA</NavLink>
        <span className="nav-title">Indices Analyzer</span>
      </div>
      <div className="navbar-center">
        <NavLink to="/" className="nav-item">Dashboard</NavLink>
        <NavLink to="/analyze" className="nav-item">Analyze</NavLink>
        <NavLink to="/setup" className="nav-item">Setup</NavLink>
        <NavLink to="/watchlist" className="nav-item">Watchlist</NavLink>
      </div>
      <div className="navbar-right">
        <span>Today, {new Date().toDateString()}</span>
      </div>
    </nav>
  );
}

export default Navbar;