import { useState, useEffect, useCallback } from 'react';
import { getRegions, getRegionShelters } from '../api/regions.js';
import { getRegionScore } from '../api/scores.js';
import { usePolling } from './usePolling.js';

export function useRegions() {
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [score, setScore] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial load of regions list
  useEffect(() => {
    let isMounted = true;
    async function loadRegions() {
      try {
        setLoading(true);
        setError(null);
        const data = await getRegions();
        if (isMounted) {
          setRegions(data);
          if (data && data.length > 0) {
            setSelectedRegionId(data[0]._id);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load regions');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadRegions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch score and shelters when selected region changes
  const fetchRegionDetails = useCallback(async (regionId, quiet = false) => {
    if (!regionId) return;
    try {
      if (!quiet) setLoading(true);
      else setIsRefreshing(true);

      setError(null);

      const [scoreData, sheltersData] = await Promise.all([
        getRegionScore(regionId).catch(() => null),
        getRegionShelters(regionId).catch(() => [])
      ]);

      setScore(scoreData);
      setShelters(sheltersData || []);
    } catch (err) {
      setError(err.message || 'Failed to load region data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Sync selectedRegion object when selectedRegionId or regions change
  useEffect(() => {
    if (!selectedRegionId) return;
    const found = regions.find((r) => r._id === selectedRegionId);
    setSelectedRegion(found || null);
    fetchRegionDetails(selectedRegionId, false);
  }, [selectedRegionId, regions, fetchRegionDetails]);

  // Poll score every 60 seconds
  const refreshScore = useCallback(() => {
    if (selectedRegionId) {
      fetchRegionDetails(selectedRegionId, true);
    }
  }, [selectedRegionId, fetchRegionDetails]);

  usePolling(refreshScore, 60000, !!selectedRegionId);

  return {
    regions,
    selectedRegionId,
    setSelectedRegionId,
    selectedRegion,
    score,
    shelters,
    loading,
    error,
    isRefreshing,
    refreshScore
  };
}
