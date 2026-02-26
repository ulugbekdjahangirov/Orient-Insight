import { createContext, useContext, useState } from 'react';

const YearContext = createContext(null);

const BASE_YEAR = new Date().getFullYear();
export const AVAILABLE_YEARS = [BASE_YEAR - 1, BASE_YEAR, BASE_YEAR + 1]; // kept for compatibility

export function YearProvider({ children }) {
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem('selectedYear');
    const parsed = saved ? parseInt(saved, 10) : null;
    return parsed && parsed >= 2020 && parsed <= 2099 ? parsed : BASE_YEAR;
  });

  const changeYear = (year) => {
    setSelectedYear(year);
    localStorage.setItem('selectedYear', String(year));
  };

  return (
    <YearContext.Provider value={{ selectedYear, changeYear }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useYear must be used within YearProvider');
  return ctx;
}
