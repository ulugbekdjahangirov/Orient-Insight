import { useState, useEffect, useCallback } from 'react';
import { pricesApi } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Custom hook for managing price configuration from database
 * Replaces localStorage with API calls
 */
export function usePriceConfig(tourType, category, paxTier, defaultValue = []) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load data from API
  const load = useCallback(async () => {
    if (!tourType || !category || !paxTier) return;

    setLoading(true);
    setError(null);

    try {
      const response = await pricesApi.get(tourType, category, paxTier);
      const items = response.data.items || [];
      setData(items.length > 0 ? items : defaultValue);
    } catch (err) {
      console.error('Error loading price config:', err);
      setError(err);
      // Use default value on error
      setData(defaultValue);
    } finally {
      setLoading(false);
    }
  }, [tourType, category, paxTier, JSON.stringify(defaultValue)]);

  // Save data to API
  const save = useCallback(async (itemsToSave = null) => {
    const items = itemsToSave !== null ? itemsToSave : data;

    try {
      await pricesApi.save(tourType, category, paxTier, items);
      toast.success('Сохранено');
      return true;
    } catch (err) {
      console.error('Error saving price config:', err);
      toast.error('Ошибка сохранения');
      return false;
    }
  }, [tourType, category, paxTier, data]);

  // Load on mount or when params change
  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    setData,
    loading,
    error,
    save,
    reload: load
  };
}

/**
 * Hook for loading all price configs for a tour type at once
 * Useful for bulk operations
 */
export function useAllPriceConfigs(tourType) {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!tourType) return;

    setLoading(true);
    setError(null);

    try {
      const response = await pricesApi.getAllForTourType(tourType);
      setConfigs(response.data);
    } catch (err) {
      console.error('Error loading all configs:', err);
      setError(err);
      setConfigs({});
    } finally {
      setLoading(false);
    }
  }, [tourType]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    configs,
    loading,
    error,
    reload: load
  };
}

export default usePriceConfig;
