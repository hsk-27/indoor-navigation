import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ApiService } from '../services/ApiService';
import { useLocalization } from '../context/LocalizationContext';
import { API_BASE_URL } from '../config';

interface SearchResultDTO {
  nodeId: number;
  name: string;
  departmentName?: string;
}

interface NodeDetails {
  nodeId: number;
  name: string;
  departmentName?: string;
  floorName: string;
  distanceToNearestStairsOrLift: number | null;
}

export default function DirectorySearch() {
  const navigate = useNavigate();
  const { activeGraph } = useLocalization();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<NodeDetails | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Floor mapping
  const [floors, setFloors] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/localization/buildings`, { cache: 'no-store' })
      .then(res => res.json())
      .then(async (buildings) => {
        if (!Array.isArray(buildings)) return;
        
        const floorPromises = buildings.map((b: any) => 
          fetch(`${API_BASE_URL}/api/v1/localization/buildings/${b.id}/floors`, { cache: 'no-store' })
            .then(res => res.ok ? res.json() : [])
            .catch(() => [])
        );
        
        const floorsArrays = await Promise.all(floorPromises);
        const allFloors = floorsArrays.flat().filter(f => f && f.id);
        
        const floorMap: Record<number, string> = {};
        allFloors.forEach((floor: any) => {
          floorMap[floor.id] = floor.name;
        });
        setFloors(floorMap);
      })
      .catch(err => console.error('Error fetching floors:', err));
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    if (query.trim().length < 2) {
      setResults([]);
      setError('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await ApiService.searchDestinations(query);
        const mappedData = data.map((node: any) => ({
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
  }, [query]);

  const computeDistanceToNearestTransition = (startNodeId: number): number | null => {
      if (!activeGraph) return null;

      const { nodes, edges } = activeGraph;
      
      const transitionNodeIds = new Set(
          nodes.filter(n => n.type === 'STAIRCASE' || n.type === 'LIFT').map(n => n.id)
      );

      if (transitionNodeIds.has(startNodeId)) return 0;

      // Dijkstra
      const distances: Record<number, number> = {};
      const unvisited = new Set<number>();
      
      nodes.forEach(n => {
          distances[n.id] = Infinity;
          unvisited.add(n.id);
      });
      distances[startNodeId] = 0;

      // Build adjacency list
      const adj: Record<number, { to: number, dist: number }[]> = {};
      nodes.forEach(n => adj[n.id] = []);
      
      edges.forEach(e => {
          if (!e.isEnabled && e.isEnabled !== undefined) return;
          if (adj[e.sourceId]) adj[e.sourceId].push({ to: e.destinationId, dist: e.distance });
          if (e.direction !== 'FORWARD' && adj[e.destinationId]) {
              adj[e.destinationId].push({ to: e.sourceId, dist: e.distance });
          }
      });

      let current: number | null = startNodeId;

      while (current !== null) {
          if (transitionNodeIds.has(current)) {
              return distances[current];
          }

          unvisited.delete(current);

          for (const neighbor of adj[current] || []) {
              if (unvisited.has(neighbor.to)) {
                  const alt = distances[current] + neighbor.dist;
                  if (alt < distances[neighbor.to]) {
                      distances[neighbor.to] = alt;
                  }
              }
          }

          let minNode: number | null = null;
          let minDist = Infinity;
          for (const u of unvisited) {
              if (distances[u] < minDist) {
                  minDist = distances[u];
                  minNode = u;
              }
          }
          current = minNode;
          
          if (minDist === Infinity) break;
      }

      return null;
  };

  const handleSelectNode = (result: SearchResultDTO) => {
      const graphNode = activeGraph?.nodes.find(n => n.id === result.nodeId);
      
      let dist = computeDistanceToNearestTransition(result.nodeId);
      
      setSelectedNodeDetails({
          nodeId: result.nodeId,
          name: result.name,
          departmentName: result.departmentName,
          floorName: graphNode ? (floors[graphNode.floorId] || `Floor ${graphNode.floorId}`) : 'Unknown Floor',
          distanceToNearestStairsOrLift: dist
      });
      setQuery('');
      setResults([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => navigate('/')}
                    className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Search Directory</h1>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 mb-8">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedNodeDetails(null);
                        }}
                        placeholder="Search for labs, classrooms, offices..." 
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-[1.5rem] pl-12 p-4 text-gray-800 focus:outline-none focus:border-blue-500 transition-colors text-lg"
                        autoFocus
                    />
                </div>

                {isLoading && (
                    <div className="mt-6 text-center text-gray-500 font-medium">Searching...</div>
                )}
                
                {error && !isLoading && query && (
                    <div className="mt-6 text-center text-red-500 font-medium">{error}</div>
                )}

                {!isLoading && results.length > 0 && (
                    <ul className="mt-6 space-y-3">
                        <AnimatePresence>
                            {results.map((result) => (
                                <motion.li 
                                    key={result.nodeId}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => handleSelectNode(result)}
                                    className="bg-white border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50 p-4 rounded-2xl cursor-pointer transition-all flex justify-between items-center group"
                                >
                                    <div>
                                        <span className="block font-bold text-gray-800 text-lg group-hover:text-blue-900 transition-colors">{result.name}</span>
                                        {result.departmentName && (
                                            <span className="block text-sm text-gray-500 mt-1">Dept: {result.departmentName}</span>
                                        )}
                                    </div>
                                    <span className="text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                        View Details &rarr;
                                    </span>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </div>

            <AnimatePresence>
                {selectedNodeDetails && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-white p-8 rounded-[2rem] shadow-sm border border-blue-100 overflow-hidden relative"
                    >
                        <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedNodeDetails.name}</h2>
                        {selectedNodeDetails.departmentName && (
                            <p className="text-gray-500 font-medium mb-6">{selectedNodeDetails.departmentName}</p>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-blue-50 rounded-xl p-4">
                                <span className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Located On</span>
                                <span className="block text-lg font-bold text-blue-900">{selectedNodeDetails.floorName}</span>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4">
                                <span className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Nearest Stairs/Lift</span>
                                <span className="block text-lg font-bold text-blue-900">
                                    {selectedNodeDetails.distanceToNearestStairsOrLift !== null 
                                        ? `${Math.round(selectedNodeDetails.distanceToNearestStairsOrLift)} meters` 
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-6 text-center">
                            <h3 className="font-bold text-gray-800 mb-2">Want to travel here?</h3>
                            <p className="text-sm text-gray-500 mb-6">Enter your starting location and we'll guide you step-by-step.</p>
                            
                            <button 
                                onClick={() => navigate(`/destinations?presetEndNodeId=${selectedNodeDetails.nodeId}&presetEndNodeName=${encodeURIComponent(selectedNodeDetails.name)}`)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                            >
                                Enter Starting Location
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </motion.div>
    </div>
  );
}
