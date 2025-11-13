import React, { createContext, useState, useContext } from 'react';

const AlertsContext = createContext();

export const AlertsProvider = ({ children }) => {
  const [alertData, setAlertData] = useState(null); // Holds { filename, records, summary }

  const setAlerts = (data) => {
    setAlertData(data);
  };

  const clearAlerts = () => {
    setAlertData(null);
  };

  // Helper to get list of IDs for specific flag
  const getAlertIndexIds = (type = 'ALL') => {
    if (!alertData) return [];
    
    return alertData.records
      .filter(r => {
        if (!r.mapped_index_id) return false;
        if (type === 'ALL') return true;
        if (type === 'HIGH') return r.flag_type === 'High';
        if (type === 'LOW') return r.flag_type === 'Low';
        return false;
      })
      .map(r => r.mapped_index_id);
  };

  return (
    <AlertsContext.Provider value={{ alertData, setAlerts, clearAlerts, getAlertIndexIds }}>
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => useContext(AlertsContext);