import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ApiService } from '../services/ApiService';
import { useLocalization } from '../context/LocalizationContext';
import { API_BASE_URL } from '../config';

interface SearchResultDTO {
  nodeId: number;
  name: string;
  departmentName?: string;
}

function DestinationSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeGraph } = useLocalization();

  const presetEndNodeId = searchParams.get('presetEndNodeId');
  const presetEndNodeName = searchParams.get('presetEndNodeName');

  // Building State
  const presetBuildingId = searchParams.get('presetBuildingId');
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | ''>(
    presetBuildingId ? parseInt(presetBuildingId, 10) : ''
  ); 

  // Floor State
  const presetFloorId = searchParams.get('presetFloorId');
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<number | ''>(
    presetFloorId ? parseInt(presetFloorId, 10) : ''
  );

  // Start Node State
  const [startNodeId, setStartNodeId] = useState<number | ''>('');

  // End Node State
  const [endQuery, setEndQuery] = useState(presetEndNodeName || '');
  const [endNode, setEndNode] = useState<SearchResultDTO | null>(
      presetEndNodeId ? { nodeId: parseInt(presetEndNodeId), name: presetEndNodeName || '' } : null
  );
  const [results, setResults] = useState<SearchResultDTO[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeField, setActiveField] = useState<'end' | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch buildings
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/localization/buildings`, { cache: 'no-store' })
      .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
      })
      .then(async data => {
          if (Array.isArray(data)) {
              setBuildings(data);

              // 1. If presetBuildingId is valid, select it.
              let defaultBuilding = data.find(b => b.id === selectedBuildingId)?.id;
              
              // 2. If no valid presetBuildingId, try to deduce it from activeGraph
              if (!defaultBuilding && data.length > 0) {
                  const graphFloorId = activeGraph?.nodes?.[0]?.floorId;
                  if (graphFloorId) {
                      // Fetch all floors for all buildings to find the one that owns graphFloorId
                      for (const b of data) {
                          try {
                              const fres = await fetch(`${API_BASE_URL}/api/v1/localization/buildings/${b.id}/floors`);
                              if (fres.ok) {
                                  const fdata = await fres.json();
                                  if (fdata.find((f: any) => f.id === graphFloorId)) {
                                      defaultBuilding = b.id;
                                      break;
                                  }
                              }
                          } catch (e) {}
                      }
                  }
              }

              // 3. Fallback to the first building if still unresolved
              if (!defaultBuilding && data.length > 0) {
                  defaultBuilding = data[0].id;
              }

              if (defaultBuilding) {
                  setSelectedBuildingId(defaultBuilding);
              }
          }
      })
      .catch(err => console.error("Error fetching buildings:", err));
  }, []);

  // Fetch floors when building changes
  useEffect(() => {
    if (!selectedBuildingId) return;

    fetch(`${API_BASE_URL}/api/v1/localization/buildings/${selectedBuildingId}/floors`, { cache: 'no-store' })
      .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
      })
        .then(data => {
            if (Array.isArray(data)) {
                setFloors(data);
                
                // If current selectedFloorId is invalid for this building
                if (!data.find(f => f.id === selectedFloorId) && data.length > 0) {
                    // Try to pick the floor matching the activeGraph if possible
                    const graphFloorIds = new Set(activeGraph?.nodes?.map(n => n.floorId) || []);
                    const bestFloor = data.find(f => graphFloorIds.has(f.id));
                    
                    setSelectedFloorId(bestFloor ? bestFloor.id : data[0].id);
                    setStartNodeId(''); // reset start node
                } else if (data.length === 0) {
                    setSelectedFloorId('');
                    setStartNodeId('');
                }
            }
        })
      .catch(err => console.error("Error fetching floors:", err));
  }, [selectedBuildingId]);

  // End Node Search Logic
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    if (endQuery.trim().length < 2 || activeField !== 'end') {
      setResults([]);
      setError('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await ApiService.searchDestinations(endQuery);
        const mappedData = data.map(node => ({
            nodeId: node.id,
            name: node.name,
            departmentName: node.departmentName
        }));
        setResults(mappedData);
        setError(mappedData.length === 0 ? 'No destinations found.' : '');
      } catch (err) {
        console.error(err);
        setError('An error occurred while searching.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    
    return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [endQuery, activeField]);

  const selectEndNode = (result: SearchResultDTO) => {
      setEndNode(result);
      setEndQuery(result.name);
      setActiveField(null);
  };

  const startNavigation = () => {
      if (startNodeId !== '' && endNode) {
          navigate(`/map?currentLocationId=${startNodeId}&destinationId=${endNode.nodeId}&startFloorId=${selectedFloorId}`);
      }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto mt-24 bg-white p-8 rounded-2xl shadow-sm border border-gray-200"
    >
      <h2 className="text-xl font-bold text-gray-800 mb-6">Plan Your Route</h2>
      
      <div className="flex flex-col gap-5 mb-6">
          <div className="relative">
              <label className="block text-sm font-bold text-gray-600 mb-2">Building</label>
              <select 
                value={selectedBuildingId}
                onChange={(e) => {
                    setSelectedBuildingId(parseInt(e.target.value));
                }}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-4 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner text-lg appearance-none cursor-pointer"
              >
                {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
          </div>

          <div className="relative">
              <label className="block text-sm font-bold text-gray-600 mb-2">Starting Floor</label>
              <select 
                value={selectedFloorId}
                onChange={(e) => {
                    setSelectedFloorId(parseInt(e.target.value));
                    setStartNodeId(''); // reset start node when floor changes
                }}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-4 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner text-lg appearance-none cursor-pointer"
              >
                {floors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
          </div>

          <div className="relative">
              <label className="block text-sm font-bold text-gray-600 mb-2">Starting Location (Room Name on Blue Nameplate)</label>
              <select 
                value={startNodeId}
                onChange={(e) => setStartNodeId(parseInt(e.target.value))}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-4 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner text-lg appearance-none cursor-pointer"
              >
                <option value="" disabled>Select your current location...</option>
                {activeGraph?.nodes
                  .filter(n => n.floorId === selectedFloorId && n.isSearchable !== false && !['CORRIDOR', 'CORRIDOR_BEND', 'CORRIDOR_INTERSECTION'].includes(n.type))
                  .map(node => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
          </div>

          <div className="relative">
              <label className="block text-sm font-bold text-gray-600 mb-2">Ending Location</label>
              <input 
                type="text" 
                value={endQuery}
                onChange={(e) => {
                    setEndQuery(e.target.value);
                    setEndNode(null);
                    setActiveField('end');
                }}
                onFocus={() => setActiveField('end')}
                placeholder="Where do you want to go?" 
                className={`w-full bg-gray-50 border border-gray-300 rounded-lg p-4 text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner text-lg cursor-text ${activeField === 'end' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}
              />
          </div>
      </div>

      <AnimatePresence mode="wait">
        {error && !isLoading && (
            <motion.div 
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-100 border border-gray-300 text-gray-700 p-4 rounded-lg mb-6 overflow-hidden"
            >
            {error}
            </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6">
        {activeField === 'end' && results.length > 0 && (
            <>
                <h3 className="text-base font-bold text-gray-700 mb-4 border-b border-gray-200 pb-2">Search Results</h3>
                <ul className="space-y-3">
                    <AnimatePresence>
                        {results.map((result, index) => (
                            <motion.li 
                                key={result.nodeId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05, duration: 0.2 }}
                                onClick={() => selectEndNode(result)}
                                className="bg-gray-50 hover:bg-gray-100 p-4 rounded-xl cursor-pointer border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all flex justify-between items-center group"
                            >
                                <div>
                                    <span className="block font-bold text-gray-800 text-lg group-hover:text-black transition-colors">{result.name}</span>
                                    {result.departmentName && (
                                        <span className="block text-sm text-gray-500 mt-1">Dept: {result.departmentName}</span>
                                    )}
                                </div>
                                <motion.div 
                                    whileHover={{ x: 5 }}
                                    className="text-blue-500 font-bold text-xl transition-colors"
                                >
                                    Select
                                </motion.div>
                            </motion.li>
                        ))}
                    </AnimatePresence>
                </ul>
            </>
        )}
      </div>

      <button
          disabled={startNodeId === '' || !endNode}
          onClick={startNavigation}
          className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all ${
              startNodeId !== '' && endNode ? 'bg-blue-600 hover:bg-blue-700 active:scale-95' : 'bg-gray-300 cursor-not-allowed'
          }`}
      >
          Start Navigation
      </button>

    </motion.div>
  );
}

export default DestinationSelect;
