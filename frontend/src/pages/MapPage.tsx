import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocalization } from '../context/LocalizationContext';
import { useRouteContext, RouteResponse } from '../context/RouteContext';
import { NavigationPositionResolver } from '../localization/NavigationPositionResolver';
import { ApiService } from '../services/ApiService';
import { useImageBlobUrl } from '../hooks/useImageBlobUrl';
import { MultiFloorNavigationManager, FloorSegment, MultiFloorNavigationStatus } from '../localization/navigation/MultiFloorNavigationManager';
import { VoiceGuidanceService } from '../localization/navigation/VoiceGuidanceService';
import { TurnManeuver } from '../localization/navigation/NavigationContext';
import { NavigationCameraController } from '../localization/navigation/NavigationCameraController';
import { NavigationPathSplitter } from '../localization/navigation/NavigationPathSplitter';
import { API_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { GraphEdgeData } from '../localization/types/GraphTypes';

const getRouteEdgeIds = (pathNodes: { id: number }[] | undefined, edges: GraphEdgeData[] | undefined): number[] => {
  if (!pathNodes || pathNodes.length < 2 || !edges) return [];
  const edgeIds: number[] = [];
  for (let i = 0; i < pathNodes.length - 1; i++) {
    const u = pathNodes[i].id;
    const v = pathNodes[i + 1].id;
    const edge = edges.find(
      e => (e.sourceId === u && e.destinationId === v) || (e.sourceId === v && e.destinationId === u)
    );
    if (edge) {
      edgeIds.push(edge.id);
    }
  }
  return edgeIds;
};

function MapPage() {
  const [searchParams] = useSearchParams();
  const destinationId = searchParams.get('destinationId');
  const currentLocationParam = searchParams.get('currentLocationId');
  const navigate = useNavigate();

  // Panel UX State
  const [isRouteGuideOpen, setIsRouteGuideOpen] = useState(window.innerWidth > 768);
  const [isLocationPanelOpen, setIsLocationPanelOpen] = useState(window.innerWidth > 768);
  const [isFloorSelectorOpen, setIsFloorSelectorOpen] = useState(false);

  const { state: locState, activeGraph, engine } = useLocalization();
  const { routeResult: route, setRouteResult: setRoute, activeFloor: currentFloorId, setActiveFloor: setCurrentFloorId } = useRouteContext();

  // --- PERFORMANCE MEMOIZATION ---
  const activeGraphNodesMap = useMemo(() => {
    if (!activeGraph?.nodes) return new Map<number, any>();
    return new Map(activeGraph.nodes.map(n => [n.id, n]));
  }, [activeGraph?.nodes]);

  const visibleNodes = useMemo(() => {
    if (!activeGraph?.nodes) return [];
    return activeGraph.nodes.filter(n => 
      n.floorId === currentFloorId && 
      n.isSearchable !== false && 
      n.type !== 'CORRIDOR_BEND'
    );
  }, [activeGraph?.nodes, currentFloorId]);
  // -------------------------------

  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  
  // Multi-floor navigation state
  const [navStatus, setNavStatus] = useState<MultiFloorNavigationStatus>('IDLE');
  const [currentSegment, setCurrentSegment] = useState<FloorSegment | null>(null);
  const [allSegments, setAllSegments] = useState<FloorSegment[]>([]);
  const [recalculating, setRecalculating] = useState(false);
  const [rerouteMessage, setRerouteMessage] = useState('');
  
  // Access Profile Setting
  const [accessProfile, setAccessProfile] = useState<string>('AUTHORIZED_LIFT_USER');
  const [availableRoutes, setAvailableRoutes] = useState<{ studentRoute: RouteResponse, staffRoute: RouteResponse } | null>(null);
  const [selectedRouteType, setSelectedRouteType] = useState<'STUDENT' | 'AUTHORIZED_LIFT_USER' | null>(null);
  const [showLowConfidenceFloorDialog, setShowLowConfidenceFloorDialog] = useState(false);
  const [manualRecoveryFloor, setManualRecoveryFloor] = useState<number>(1);
  const [currentManeuver, setCurrentManeuver] = useState<TurnManeuver | null>(null);
  const [upcomingManeuvers, setUpcomingManeuvers] = useState<TurnManeuver[]>([]);
  const [remainingDistance, setRemainingDistance] = useState<number>(0);
  const lastTransitionTimeRef = useRef<number>(0);
  
  // Voice guidance state
  const voiceService = VoiceGuidanceService.getInstance();
  const [isVoiceMuted, setIsVoiceMuted] = useState(voiceService.isMuted());

  useEffect(() => {
    return voiceService.onMuteChange(muted => setIsVoiceMuted(muted));
  }, [voiceService]);

  const navManagerRef = useRef<MultiFloorNavigationManager | null>(null);
  if (!navManagerRef.current) {
    navManagerRef.current = new MultiFloorNavigationManager({}, (status, seg) => {
      setNavStatus(status);
      setCurrentSegment(seg);
    });
  }

  useEffect(() => {
    const unsub = navManagerRef.current!.getNavigationContext().subscribe(snap => {
      setCurrentManeuver(snap.currentManeuver);
      setUpcomingManeuvers(snap.upcomingManeuvers || []);
      setRemainingDistance(snap.remainingGraphDistance || 0);
    });
    return () => unsub();
  }, []);

  const currentFloorUrl = floors.find(fl => fl.id === currentFloorId)?.svgMapUrl;
  const encodedFloorUrl = currentFloorUrl ? encodeURI(currentFloorUrl) : undefined;
  const blobMapUrl = useImageBlobUrl(encodedFloorUrl);

  // Manual Start Selection State
  const actionParam = searchParams.get('action');
  const [selectedStartFloor, setSelectedStartFloor] = useState<number>(1);
  const [selectedStartNode, setSelectedStartNode] = useState<number | null>(null);

  // Dynamic Navigation Camera Controller
  const [transform, setTransform] = useState({ 
    x: window.innerWidth > 768 ? 100 : 20, 
    y: window.innerWidth > 768 ? 50 : 20, 
    scale: window.innerWidth > 768 ? 1 : 0.35 
  });
  const [isAutoFollowing, setIsAutoFollowing] = useState(true);
  const [smoothedMarker, setSmoothedMarker] = useState({ x: 0, y: 0, heading: 0 });
  const cameraControllerRef = useRef<NavigationCameraController>(null as unknown as NavigationCameraController);
  if (!cameraControllerRef.current) {
    cameraControllerRef.current = new NavigationCameraController({
      x: window.innerWidth > 768 ? 100 : 20,
      y: window.innerWidth > 768 ? 50 : 20,
      scale: window.innerWidth > 768 ? 1 : 0.35
    });
  }

  useEffect(() => {
    if (floors.length > 0) {
        const nameMap = new Map<number, string>();
        floors.forEach(f => nameMap.set(f.id, f.name));
        navManagerRef.current?.getPredictiveVoiceEngine().setFloorNames(nameMap);
    }
  }, [floors]);

  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const [showFloorToast, setShowFloorToast] = useState(false);
  const prevFloorIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevFloorIdRef.current !== null && prevFloorIdRef.current !== currentFloorId) {
      setShowFloorToast(true);
      const timer = setTimeout(() => setShowFloorToast(false), 3000);
      return () => clearTimeout(timer);
    }
    prevFloorIdRef.current = currentFloorId;
  }, [currentFloorId]);

  const handleConfirmStart = () => {
    if (locState.status === 'WAITING_FOR_FLOOR' && locState.physicalPosition) {
        engine.initializeAtFloor(selectedStartFloor, locState.physicalPosition.x, locState.physicalPosition.y);
    } else if (selectedStartNode) {
        engine.initializeAtNode(selectedStartNode);
    }
    
    const currFloor = floors.find(f => f.id === currentFloorId);
    const bId = currFloor?.buildingId || 1;
    navigate(`/destinations?presetBuildingId=${bId}&presetFloorId=${currentFloorId}`);
  };

  const handleCancelStart = () => {
    engine.cancelManualRecalibration();
    if (actionParam === 'select-start') {
       navigate('/map', { replace: true });
    }
  };

  // Sync active floor with localization if available
  // Only auto-sync when actively navigating (route exists) to prevent
  // overriding manual floor selection during map browsing.
  const hasSyncedInitialLocationRef = useRef(false);
  useEffect(() => {
      if (currentLocationParam && activeGraph && !hasSyncedInitialLocationRef.current) {
          const node = activeGraph.nodes.find(n => n.id === parseInt(currentLocationParam, 10));
          if (node) {
              engine.initializeAtNode(node.id);
              setCurrentFloorId(node.floorId);
              hasSyncedInitialLocationRef.current = true;
          }
      } else if (route && locState.navigationPosition && navStatus !== 'AT_CHECKPOINT') {
          setCurrentFloorId(locState.navigationPosition.floorId);
      }
  }, [locState.navigationPosition, currentLocationParam, activeGraph, navStatus, route, engine]);

  // Redirect to destinations page if manual start is requested
  useEffect(() => {
      if (actionParam === 'select-start') {
        const currFloor = floors.find(f => f.id === currentFloorId);
        const bId = currFloor?.buildingId || 1;
        navigate(`/destinations?presetBuildingId=${bId}&presetFloorId=${currentFloorId}`, { replace: true });
      }
    }, [actionParam, navigate, currentFloorId, floors]);

  // Fetch floors to get SVG URLs
  useEffect(() => {
    // First fetch all buildings, then fetch floors for each building
    fetch(`${API_BASE_URL}/api/v1/localization/buildings`, { cache: 'no-store' })
      .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
      })
      .then(async (buildings) => {
          if (!Array.isArray(buildings) || buildings.length === 0) {
              setFloors([]);
              return;
          }
          
          // Fetch floors for all buildings in parallel
          const floorPromises = buildings.map((b: any) => 
              fetch(`${API_BASE_URL}/api/v1/localization/buildings/${b.id}/floors`, { cache: 'no-store' })
                  .then(res => res.ok ? res.json() : [])
                  .catch(() => [])
          );
          
          const floorsArrays = await Promise.all(floorPromises);
          const allFloors = floorsArrays.flat().filter(f => f && f.id);
          
          setFloors(allFloors);
          if (allFloors.length > 0) {
              const urlStartFloor = searchParams.get('startFloorId');
              const parsedStartFloor = urlStartFloor ? parseInt(urlStartFloor, 10) : null;
              
              const preferredFloorId = parsedStartFloor || currentFloorId;
              
              setCurrentFloorId(allFloors.find((f: any) => f.id === preferredFloorId) ? preferredFloorId : allFloors[0].id);
              setSelectedStartFloor(allFloors.find((f: any) => f.id === selectedStartFloor) ? selectedStartFloor : allFloors[0].id);
              setManualRecoveryFloor(allFloors.find((f: any) => f.id === manualRecoveryFloor) ? manualRecoveryFloor : allFloors[0].id);
          }
      })
      .catch(err => {
          console.error("Error fetching buildings/floors:", err);
          setError("Failed to load floors.");
      })
      .finally(() => {
          setLoading(false);
      });
  }, [API_BASE_URL]);

  useEffect(() => {
      if (currentFloorId) {
          fetch(`${API_BASE_URL}/api/v1/localization/metadata/${currentFloorId}`, { cache: 'no-store' })
              .then(res => {
                  if (res.ok) return res.json();
                  return null;
              })
              .then(data => {
                  setMetadata(data);
                  if (data?.pixelsPerMeter) {
                      navManagerRef.current!.setConfig({ pixelsPerMeter: data.pixelsPerMeter });
                      cameraControllerRef.current.setConfig({ pixelsPerMeter: data.pixelsPerMeter });
                  }
              })
              .catch(e => console.error("Error fetching metadata:", e));
      }
  }, [currentFloorId]);

  // Dynamic recalculation helper
  const handleReroute = useCallback(async (fromNodeId?: number) => {
    if (!destinationId || !activeGraph || recalculating) return;
    setRecalculating(true);
    try {
      let sourceNodeId = fromNodeId;
      if (!sourceNodeId) {
        if (locState.navigationPosition) {
          sourceNodeId = NavigationPositionResolver.resolveNearestNode(
            locState.navigationPosition,
            locState.physicalPosition,
            activeGraph.nodes,
            activeGraph.edges
          ) || 1;
        } else {
          sourceNodeId = 1;
        }
      }

      const newRouteData = await ApiService.computeRoute(sourceNodeId, parseInt(destinationId, 10), accessProfile);
      const res = navManagerRef.current!.handleRecalculatedRoute(newRouteData.path);
      
      if (res.switchedCheckpoint) {
        setRoute(newRouteData);
        setAllSegments(navManagerRef.current!.getAllSegments());
        setCurrentSegment(navManagerRef.current!.getCurrentSegment());
        const activeEdgeIds = getRouteEdgeIds(newRouteData.path, activeGraph.edges);
        engine.startActiveNavigation(activeEdgeIds);
      }
      setRerouteMessage(res.message);
      setTimeout(() => setRerouteMessage(''), 7000);
    } catch (err: any) {
      console.error("Dynamic rerouting failed:", err);
    } finally {
      setRecalculating(false);
    }
  }, [destinationId, activeGraph, recalculating, locState.navigationPosition, accessProfile]);

  const calculateRoute = useCallback(async () => {
    if (!activeGraph) return;
    
    setLoading(true);
    setError('');
    setAvailableRoutes(null);
    setSelectedRouteType(null);
    setRoute(null);
    setAllSegments([]);
    setCurrentSegment(null);

    try {
      let sourceId: number | null = null;
      if (currentLocationParam) {
          sourceId = parseInt(currentLocationParam, 10);
      } else if (locState.navigationPosition) {
          const resolvedId = NavigationPositionResolver.resolveNearestNode(
              locState.navigationPosition, 
              locState.physicalPosition,
              activeGraph.nodes, 
              activeGraph.edges
          );
          if (resolvedId) sourceId = resolvedId;
      }
      
      if (!sourceId && locState.physicalPosition && activeGraph) {
          let nearest: any = null;
          let minDist = Infinity;
          activeGraph.nodes.filter(n => n.floorId === currentFloorId).forEach(n => {
              const d = Math.hypot(n.x - locState.physicalPosition!.x, n.y - locState.physicalPosition!.y);
              if (d < minDist) { minDist = d; nearest = n; }
          });
          if (nearest) sourceId = nearest.id;
      }

      if (!sourceId) throw new Error("No routable node found nearby.");

      const destId = parseInt(destinationId as string, 10);
      const [studentRoute, staffRoute] = await Promise.all([
        ApiService.computeRoute(sourceId, destId, 'STUDENT'),
        ApiService.computeRoute(sourceId, destId, 'AUTHORIZED_LIFT_USER')
      ]);

      setAvailableRoutes({ studentRoute, staffRoute });

      // Automatically select the 'STUDENT' route and start navigation
      const routeData = studentRoute;
      setSelectedRouteType('STUDENT');
      setAccessProfile('STUDENT');
      setRoute(routeData);
      
      setIsAutoFollowing(true);
      cameraControllerRef.current.setAutoFollowing(true);

      // Initialize multi-floor navigation manager
      navManagerRef.current!.setGraph(activeGraph.nodes, activeGraph.edges);
      navManagerRef.current!.initializeRoute(routeData.path, destId);
      
      const segments = navManagerRef.current!.getAllSegments();
      setAllSegments(segments);
      setCurrentSegment(navManagerRef.current!.getCurrentSegment());

      // Notify localization engine of active route & suspend FLP for pure PDR tracking
      const activeEdgeIds = getRouteEdgeIds(routeData.path, activeGraph.edges);
      engine.startActiveNavigation(activeEdgeIds);

      if (routeData.path && routeData.path.length > 0) {
        setCurrentFloorId(routeData.path[0].floorId);
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to routing server.');
    } finally {
      setLoading(false);
    }
  }, [destinationId, locState.navigationPosition, activeGraph, currentLocationParam]);

  const handleRouteSelection = (type: 'STUDENT' | 'AUTHORIZED_LIFT_USER') => {
    if (!availableRoutes || !activeGraph) return;
    
    const routeData = type === 'STUDENT' ? availableRoutes.studentRoute : availableRoutes.staffRoute;
    setSelectedRouteType(type);
    setAccessProfile(type);
    setRoute(routeData);
    
    setIsAutoFollowing(true);
    cameraControllerRef.current.setAutoFollowing(true);

    // Initialize multi-floor navigation manager
    navManagerRef.current!.setGraph(activeGraph.nodes, activeGraph.edges);
    navManagerRef.current!.initializeRoute(routeData.path, parseInt(destinationId as string, 10));
    
    const segments = navManagerRef.current!.getAllSegments();
    setAllSegments(segments);
    setCurrentSegment(navManagerRef.current!.getCurrentSegment());

    // Notify localization engine of active route & suspend FLP for pure PDR tracking
    const activeEdgeIds = getRouteEdgeIds(routeData.path, activeGraph.edges);
    engine.startActiveNavigation(activeEdgeIds);

    if (routeData.path && routeData.path.length > 0) {
      setCurrentFloorId(routeData.path[0].floorId);
    }
  };

  useEffect(() => {
    if (destinationId && (locState.status === 'POSITION_ESTABLISHED' || currentLocationParam)) {
      calculateRoute();
    }
  }, [destinationId, calculateRoute, locState.status, currentLocationParam]);

  const pendingTransitionRef = useRef<{ floorId: number, startTime: number } | null>(null);
  
  // Position processing loop
  useEffect(() => {
    if (!route || !locState.navigationPosition) return;

    const result = navManagerRef.current!.processPositionUpdate(
      locState.navigationPosition,
      locState.physicalPosition
    );

    if (result.action === 'REQUIRE_MANUAL_FLOOR') {
      setShowLowConfidenceFloorDialog(true);
      pendingTransitionRef.current = null;
    } else if (result.action === 'DESTINATION_REACHED') {
      // Reached final destination
      pendingTransitionRef.current = null;
    } else if (result.action === 'CHECKPOINT_REACHED') {
      if (result.targetFloorId !== undefined) {
        const now = Date.now();
        // Don't transition if we just transitioned recently
        if (now - lastTransitionTimeRef.current > 3000) {
          if (!pendingTransitionRef.current || pendingTransitionRef.current.floorId !== result.targetFloorId) {
            // Start the delay timer
            pendingTransitionRef.current = { floorId: result.targetFloorId, startTime: now };
          } else if (now - pendingTransitionRef.current.startTime >= 1200) {
            // 1.2 seconds have passed, execute transition
            handleConfirmFloorTransition(result.targetFloorId);
            pendingTransitionRef.current = null;
          }
        }
      }
    } else if (result.action === 'TRIGGER_RECALCULATION') {
      handleReroute(result.recalculateFromNodeId);
      pendingTransitionRef.current = null;
    } else {
      // Not at a checkpoint anymore, cancel any pending transition
      pendingTransitionRef.current = null;
    }
  }, [locState.navigationPosition, locState.physicalPosition, route, handleReroute]);

  const handleConfirmFloorTransition = (targetFloorId: number) => {
    engine.changeFloor(targetFloorId);
    const currentSeg = navManagerRef.current?.getCurrentSegment();
    const landingNode = currentSeg?.nextFloorTransitionNode;
    
    if (landingNode) {
      engine.initializeAtFloor(targetFloorId, landingNode.x, landingNode.y);
    } else if (locState.physicalPosition) {
      engine.initializeAtFloor(targetFloorId, locState.physicalPosition.x, locState.physicalPosition.y);
    }
    navManagerRef.current!.transitionToNextFloor(targetFloorId);
    setCurrentFloorId(targetFloorId);
    lastTransitionTimeRef.current = Date.now();
    setCurrentSegment(navManagerRef.current!.getCurrentSegment());
  };

  const handleConfirmManualFloorRecovery = () => {
    engine.changeFloor(manualRecoveryFloor);
    if (locState.physicalPosition) {
      engine.initializeAtFloor(manualRecoveryFloor, locState.physicalPosition.x, locState.physicalPosition.y);
    }
    navManagerRef.current!.resumeFromManualFloorSelection(manualRecoveryFloor);
    setCurrentFloorId(manualRecoveryFloor);
    setShowLowConfidenceFloorDialog(false);
    setCurrentSegment(navManagerRef.current!.getCurrentSegment());
  };

  useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const handleNativeWheel = (e: WheelEvent) => {
          if (e.ctrlKey) {
              e.preventDefault();
          }
      };
      svg.addEventListener('wheel', handleNativeWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleNativeWheel);
  }, [svgRef.current]);

  // Animation frame loop for 60fps dynamic camera follow & marker interpolation
  useEffect(() => {
    let animId: number;
    const tick = () => {
      const changed = cameraControllerRef.current.tick();
      if (changed) {
        setTransform(cameraControllerRef.current.getTransform());
      }
      
      const newMarker = cameraControllerRef.current.getSmoothedMarker();
      
      // BUG-18: Decouple marker from React state (direct DOM mutation at 60fps)
      const groupEl = document.getElementById('dynamic-marker-group');
      if (groupEl) {
        groupEl.setAttribute('transform', `translate(${newMarker.x}, ${newMarker.y})`);
      }
      const rotateEl = document.getElementById('dynamic-marker-rotate');
      if (rotateEl) {
        rotateEl.setAttribute('transform', `rotate(${newMarker.heading * (180/Math.PI)})`);
      }
      
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Pinch-to-zoom & drag
  const activePointers = useRef<Map<number, {clientX: number, clientY: number}>>(new Map());
  const pinchStartRef = useRef<{ dist: number; scale: number; x: number; y: number } | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = svgRef.current?.getBoundingClientRect();
      const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.1), 10);
      if (!rect) return;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const graphX = (mouseX - transform.x) / transform.scale;
      const graphY = (mouseY - transform.y) / transform.scale;
      
      const newTransform = { 
          x: mouseX - graphX * newScale, 
          y: mouseY - graphY * newScale, 
          scale: newScale 
      };
      cameraControllerRef.current.setManualTransform(newTransform);
      setTransform(newTransform);
      setIsAutoFollowing(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof Element) {
      e.target.setPointerCapture(e.pointerId);
    }
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    cameraControllerRef.current.setUserInteracting(true);
    setIsAutoFollowing(false);

    if (activePointers.current.size === 2) {
      setIsDraggingCanvas(false);
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      pinchStartRef.current = { dist, scale: transform.scale, x: transform.x, y: transform.y };
    } else if (activePointers.current.size === 1) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (activePointers.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      
      const zoomFactor = dist / pinchStartRef.current.dist;
      const newScale = Math.min(Math.max(pinchStartRef.current.scale * zoomFactor, 0.1), 10);
      
      const clientX = (pts[0].clientX + pts[1].clientX) / 2;
      const clientY = (pts[0].clientY + pts[1].clientY) / 2;
      
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const graphX = (mouseX - pinchStartRef.current.x) / pinchStartRef.current.scale;
      const graphY = (mouseY - pinchStartRef.current.y) / pinchStartRef.current.scale;
      
      const newTransform = { 
          x: mouseX - graphX * newScale, 
          y: mouseY - graphY * newScale, 
          scale: newScale 
      };
      cameraControllerRef.current.setManualTransform(newTransform);
      setTransform(newTransform);
    } else if (activePointers.current.size === 1 && isDraggingCanvas) {
      const newTransform = {
        ...transform,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      cameraControllerRef.current.setManualTransform(newTransform);
      setTransform(newTransform);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      pinchStartRef.current = null;
    }
    if (activePointers.current.size === 1) {
      const pts = Array.from(activePointers.current.values());
      setIsDraggingCanvas(true);
      setDragStart({ x: pts[0].clientX - transform.x, y: pts[0].clientY - transform.y });
    } else if (activePointers.current.size === 0) {
      setIsDraggingCanvas(false);
      cameraControllerRef.current.setUserInteracting(false);
    }
  };

  const getNavRenderPos = () => {
      const navPos = locState.navigationPosition;
      if (navPos && navPos.floorId === currentFloorId && navPos.currentEdgeId && activeGraph) {
          const edge = activeGraph.edges.find(e => e.id === navPos.currentEdgeId);
          if (edge) {
              const source = activeGraph.nodes.find(n => n.id === edge.sourceId);
              const target = activeGraph.nodes.find(n => n.id === edge.destinationId);
              if (source && target) {
                  const edgeLength = Math.hypot(target.x - source.x, target.y - source.y);
                  const ratio = edgeLength === 0 ? 0 : navPos.distanceAlongEdge / edgeLength;
                  return {
                      x: source.x + ratio * (target.x - source.x),
                      y: source.y + ratio * (target.y - source.y)
                  };
              }
          }
      }

      if (currentLocationParam && activeGraph) {
          const node = activeGraph.nodes.find(n => n.id === parseInt(currentLocationParam, 10));
          if (node && node.floorId === currentFloorId) {
              return { x: node.x, y: node.y };
          }
      }

      // Fallback to raw position if navigation position isn't fully locked
      if (locState.physicalPosition && locState.physicalPosition.floorId === currentFloorId) {
          return { x: locState.physicalPosition.x, y: locState.physicalPosition.y };
      }

      return null;
  };
  
  const navRenderPos = getNavRenderPos();

  // Dynamic Camera follow & state-aware zoom updates
  useEffect(() => {
    if (!navRenderPos || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const isApproachingTurn = !!(
      currentManeuver &&
      currentManeuver.pathDistanceToManeuver <= 7.0 &&
      currentManeuver.type.startsWith('TURN')
    );
    const isApproachingDest = !!(
      currentSegment?.isFinalSegment &&
      currentManeuver &&
      currentManeuver.pathDistanceToManeuver <= 5.0
    );

    cameraControllerRef.current.updateTarget({
      markerX: navRenderPos.x,
      markerY: navRenderPos.y,
      heading: locState.navigationPosition?.heading,
      speed: locState.navigationPosition?.velocity,
      confidence: locState.navigationPosition?.confidence,
      distanceToNextManeuver: currentManeuver?.pathDistanceToManeuver,
      remainingGraphDistance: currentManeuver?.pathDistanceToManeuver ?? currentSegment?.segmentDistance,
      isApproachingDestination: isApproachingDest,
      isApproachingTurn: isApproachingTurn,
      viewport: {
        width: rect.width || window.innerWidth,
        height: rect.height || window.innerHeight
      },
      hasActiveRoute: !!destinationId
    });
  }, [
    navRenderPos?.x,
    navRenderPos?.y,
    locState.navigationPosition?.heading,
    locState.navigationPosition?.velocity,
    locState.navigationPosition?.confidence,
    currentManeuver,
    currentSegment,
    destinationId
  ]);

  const handleRecenterCamera = () => {
    if (navRenderPos && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const isApproachingTurn = !!(
        currentManeuver &&
        currentManeuver.pathDistanceToManeuver <= 7.0 &&
        currentManeuver.type.startsWith('TURN')
      );
      const isApproachingDest = !!(
        currentSegment?.isFinalSegment &&
        currentManeuver &&
        currentManeuver.pathDistanceToManeuver <= 5.0
      );

      cameraControllerRef.current.recenter({
        markerX: navRenderPos.x,
        markerY: navRenderPos.y,
        heading: locState.navigationPosition?.heading,
        speed: locState.navigationPosition?.velocity,
        confidence: locState.navigationPosition?.confidence,
        distanceToNextManeuver: currentManeuver?.pathDistanceToManeuver,
        remainingGraphDistance: currentManeuver?.pathDistanceToManeuver ?? currentSegment?.segmentDistance,
        isApproachingDestination: isApproachingDest,
        isApproachingTurn: isApproachingTurn,
        viewport: {
          width: rect.width || window.innerWidth,
          height: rect.height || window.innerHeight
        },
        hasActiveRoute: !!destinationId
      });
      setIsAutoFollowing(true);
    }
  };

  const [stepHistory, setStepHistory] = useState<{x: number, y: number, floorId: number}[]>([]);
  useEffect(() => {
      if (navRenderPos) {
          setStepHistory(prev => {
              const last = prev[prev.length - 1];
              if (!last || Math.hypot(last.x - navRenderPos.x, last.y - navRenderPos.y) > 2) {
                  return [...prev, { x: navRenderPos.x, y: navRenderPos.y, floorId: currentFloorId }];
              }
              return prev;
          });
      }
  }, [navRenderPos?.x, navRenderPos?.y, currentFloorId]);

  const inverseScale = 1 / transform.scale;

  // --- SVG Render Layers Memoization (For Panning 60FPS) ---
  const edgesRenderLayer = useMemo(() => {
    return activeGraph?.edges.map((edge) => {
      const source = activeGraphNodesMap.get(edge.sourceId);
      const target = activeGraphNodesMap.get(edge.destinationId);
      if (!source || !target || source.floorId !== currentFloorId || target.floorId !== currentFloorId) return null;
      const opacity = route?.path && route.path.length > 0 ? 0 : 1;
      return (
        <g key={`${edge.sourceId}-${edge.destinationId}`} style={{ opacity, transition: 'opacity 0.5s ease', pointerEvents: opacity === 0 ? 'none' : 'auto' }}>
          <line 
            x1={source.x} y1={source.y}
            x2={target.x} y2={target.y}
            stroke="#94a3b8" strokeWidth={4 * inverseScale} 
          />
          {edge.distance > 0 && (
            <text 
                x={source.x + (target.x - source.x) / 2} 
                y={source.y + (target.y - source.y) / 2 - (5 * inverseScale)} 
                fill="#94a3b8" fontSize={8 * inverseScale} textAnchor="middle"
            >
                {edge.distance.toFixed(1)}m
            </text>
          )}
        </g>
      );
    });
  }, [activeGraph?.edges, activeGraphNodesMap, currentFloorId, route?.path, inverseScale]);

  const memoizedContiguousSegments = useMemo(() => {
      if (!route?.path || !activeGraph?.edges) return [];
      const floorPathNodes = route.path.filter((n: any) => n.floorId === currentFloorId);
      if (floorPathNodes.length === 0) return [];
      
      const edgeSet = new Set(activeGraph.edges.map(e => `${e.sourceId}-${e.destinationId}`));
      const edgeExists = (u: number, v: number) => edgeSet.has(`${u}-${v}`) || edgeSet.has(`${v}-${u}`);
      
      const floorSubSegments: any[][] = [];
      let currentSubSeg: any[] = [];
      
      for (let i = 0; i < floorPathNodes.length; i++) {
          const node = floorPathNodes[i];
          currentSubSeg.push(node);
          
          if (i < floorPathNodes.length - 1) {
              const nextNode = floorPathNodes[i + 1];
              if (!edgeExists(node.id, nextNode.id)) {
                  if (currentSubSeg.length >= 2) floorSubSegments.push([...currentSubSeg]);
                  currentSubSeg = [];
              }
          }
      }
      if (currentSubSeg.length >= 2) floorSubSegments.push(currentSubSeg);
      return floorSubSegments;
  }, [route?.path, activeGraph?.edges, currentFloorId]);

  const nodesRenderLayer = useMemo(() => {
    return visibleNodes.map((node) => {
      const opacity = route?.path && route.path.length > 0 ? 0 : 1;
      return (
        <g 
          key={node.id} 
          onClick={() => navigate(`/map?destinationId=${node.id}`)}
          className="cursor-pointer group"
          style={{ opacity, transition: 'opacity 0.5s ease', pointerEvents: opacity === 0 ? 'none' : 'auto' }}
        >
          <circle 
            cx={node.x} cy={node.y} 
            r={15 * inverseScale} 
            fill="#777777" 
            className="transition-all group-hover:fill-black"
          />
          <text 
            x={node.x + 15 * inverseScale} y={node.y + 5 * inverseScale} 
            fill="#475569" 
            fontSize={18 * inverseScale} 
            fontWeight="bold"
            className="transition-all group-hover:fill-black pointer-events-none"
          >
            {node.name ? node.name : (node.type === 'ROOM' ? node.id : 'Node ' + node.id)}
          </text>
        </g>
      );
    });
  }, [visibleNodes, route?.path, inverseScale, navigate]);
  // ---------------------------------------------------------

  const renderScaleBar = () => {
    const ppm = metadata?.pixelsPerMeter;
    if (!ppm || ppm <= 0) return null;
    
    const targetPixels = 100;
    const onScreenPpm = ppm * transform.scale;
    const exactMeters = targetPixels / onScreenPpm;
    
    let displayMeters = 1;
    if (exactMeters >= 50) displayMeters = 50;
    else if (exactMeters >= 20) displayMeters = 20;
    else if (exactMeters >= 10) displayMeters = 10;
    else if (exactMeters >= 5) displayMeters = 5;
    else if (exactMeters >= 2) displayMeters = 2;
    else displayMeters = 1;

    const actualWidthPx = displayMeters * onScreenPpm;

    return (
        <div className="absolute bottom-20 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-md shadow-lg border border-gray-200 z-30 pointer-events-none flex flex-col items-center">
            <div className="text-[11px] font-bold text-gray-700 mb-1 leading-none">{displayMeters} {displayMeters === 1 ? 'Meter' : 'Meters'}</div>
            <div className="border-x-2 border-b-2 border-gray-800" style={{ width: `${Math.max(actualWidthPx, 20)}px`, height: '6px' }}></div>
        </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[100vh] w-[100vw] -m-4 relative overflow-hidden bg-[#f8fafc]">
      {renderScaleBar()}
      
      {/* Left Sidebar - Routing Guide */}
      <AnimatePresence>
        {isRouteGuideOpen && (
          <motion.div 
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute md:relative left-0 top-0 h-full min-h-0 w-80 bg-white/95 backdrop-blur-md border-r border-gray-200 p-5 pt-28 flex flex-col z-20 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-xl font-bold text-gray-800">Route Guide</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => voiceService.toggleMute()}
                  title={isVoiceMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
                  className={`p-2 rounded-lg border transition-all ${isVoiceMuted ? 'bg-gray-100 text-gray-400 border-gray-300' : 'bg-green-50 text-green-700 border-green-200 shadow-sm'}`}
                >
                  {isVoiceMuted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setIsRouteGuideOpen(false)}
                  title="Collapse Panel"
                  className="p-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              </div>
            </div>

          {/* Scrollable Content Wrapper */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0 pb-4">
            {/* Multi-Floor Navigation State Badge */}
            {allSegments.length > 1 && (
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                <span>MULTI-FLOOR ROUTE</span>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  Stage {(currentSegment?.segmentIndex ?? 0) + 1} of {allSegments.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {allSegments.map((seg, idx) => {
                  const isActive = seg.segmentIndex === currentSegment?.segmentIndex;
                  const isPassed = seg.segmentIndex < (currentSegment?.segmentIndex ?? 0);
                  const floorObj = floors.find(f => f.id === seg.floorId);
                  const floorTitle = floorObj?.name || `Floor ${seg.floorId}`;
                  return (
                    <div 
                      key={idx}
                      onClick={() => setCurrentFloorId(seg.floorId)}
                      className={`text-xs p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        isActive 
                          ? 'bg-black text-white font-bold border-black shadow-sm' 
                          : isPassed 
                            ? 'bg-gray-100 text-gray-400 border-gray-200 line-through' 
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : isPassed ? 'bg-gray-300' : 'bg-slate-400'}`}></span>
                        <span>{floorTitle}</span>
                      </div>
                      <span className="text-[10px] opacity-80">
                        {seg.isFinalSegment ? 'Destination' : `via ${seg.transitionNode?.type === 'LIFT' ? 'Lift' : 'Stairs'}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-[#222222] border-t-transparent animate-spin"></div>
              <p className="text-gray-600 text-sm">Calculating optimal routes...</p>
            </div>
          ) : error ? (
            <p className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-100">{error}</p>
          ) : availableRoutes && !selectedRouteType ? (
            <div className="animate-fade-in flex flex-col flex-1 min-h-0 mt-2">
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Select Route Option</h3>
              
              <button 
                onClick={() => handleRouteSelection('STUDENT')}
                className="w-full p-4 mb-3 bg-white border-2 border-blue-200 hover:border-blue-500 rounded-xl text-left transition-all shadow-sm group"
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-blue-800 text-sm group-hover:text-blue-900 transition-colors">Student Route (Stairs Only)</div>
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-bold">{availableRoutes.studentRoute.totalDistance.toFixed(1)}m</div>
                </div>
              </button>
              
              <button 
                onClick={() => handleRouteSelection('AUTHORIZED_LIFT_USER')}
                className="w-full p-4 bg-white border-2 border-emerald-200 hover:border-emerald-500 rounded-xl text-left transition-all shadow-sm group"
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-emerald-800 text-sm group-hover:text-emerald-900 transition-colors">Staff Route (Lifts Allowed)</div>
                  <div className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md font-bold">{availableRoutes.staffRoute.totalDistance.toFixed(1)}m</div>
                </div>
              </button>
            </div>
          ) : route ? (
            <div className="animate-fade-in flex flex-col">
              <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                <button 
                  onClick={() => handleRouteSelection('STUDENT')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${selectedRouteType === 'STUDENT' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Student
                </button>
                <button 
                  onClick={() => handleRouteSelection('AUTHORIZED_LIFT_USER')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${selectedRouteType === 'AUTHORIZED_LIFT_USER' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Staff
                </button>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-800 font-bold bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-3">
                  <span>Total: {route.totalDistance.toFixed(1)}m</span>
                  <span className="border-l border-gray-300 pl-3">Floors: {new Set(route.path.map((n: any) => n.floorId)).size}</span>
                </span>
                {recalculating && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded flex items-center gap-1 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div> Rerouting...
                  </span>
                )}
              </div>
              <div className="mt-2">
                <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Instructions</p>
                  <div className="space-y-4">
                    {(() => {
                      const groups: { floorId: number | null, floorName: string | null, instructions: string[] }[] = [];
                      let trackingFloorId = route.path?.[0]?.floorId || currentFloorId;
                      let trackingFloorObj = floors.find(f => f.id === trackingFloorId);
                      let currentGroup: { floorId: number | null, floorName: string | null, instructions: string[] } = { 
                          floorId: trackingFloorId, 
                          floorName: trackingFloorObj ? trackingFloorObj.name : `Floor ${trackingFloorId}`,
                          instructions: [] 
                      };
                      
                      route.instructions?.forEach((inst: string) => {
                        currentGroup.instructions.push(inst);
                        const match = inst.match(/Take (?:Elevator|Stairs) to Floor (\d+)\./);
                        if (match) {
                          groups.push(currentGroup);
                          const nextFloorId = parseInt(match[1], 10);
                          const nextFloorObj = floors.find(f => f.id === nextFloorId);
                          currentGroup = { 
                              floorId: nextFloorId, 
                              floorName: nextFloorObj ? nextFloorObj.name : `Floor ${nextFloorId}`,
                              instructions: [] 
                          };
                        }
                      });
                      if (currentGroup.instructions.length > 0) {
                        groups.push(currentGroup);
                      }
                      
                      return groups.map((group, gIdx) => (
                        <div key={gIdx} className="mb-2">
                          <h4 className="text-[11px] font-bold text-gray-800 bg-gray-200/60 p-2 rounded-md mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {group.floorName}
                          </h4>
                          <div className="space-y-2">
                            {group.instructions.map((inst, i) => {
                              let displayInst = inst;
                              const match = inst.match(/Take (?:Elevator|Stairs) to Floor (\d+)\./);
                              if (match) {
                                  const nextFloorId = parseInt(match[1], 10);
                                  const nextFloorObj = floors.find(f => f.id === nextFloorId);
                                  if (nextFloorObj) {
                                      displayInst = inst.replace(`Floor ${nextFloorId}`, nextFloorObj.name);
                                  }
                              }
                              return (
                                <div key={i} className="bg-gray-50 border border-gray-100 p-3 rounded-xl shadow-sm text-sm text-gray-600 font-medium">
                                  {displayInst}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm italic">Select a destination to begin routing.</p>
          )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isRouteGuideOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsRouteGuideOpen(true)}
            className="absolute top-28 left-4 z-20 bg-white p-3 rounded-xl shadow-lg border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-50 transition-colors"
            title="Open Route Guide"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Map Viewer Area */}
      <div className="flex-1 overflow-hidden relative bg-[#f8fafc]">
      {locState.status === 'OUTSIDE_BUILDING' && (
        <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md text-center">
            <div className="text-red-500 mb-4 flex justify-center">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Outside Navigation Area</h2>
            <p className="text-slate-600">You are currently outside the supported indoor navigation area of GHRCE. Please proceed inside the campus to use the navigation features.</p>
          </div>
        </div>
      )}
        {/* Floating Notifications & Alerts */}
        <AnimatePresence>
          {rerouteMessage && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute top-28 left-6 right-6 z-40 bg-amber-500 text-white font-bold p-3.5 rounded-xl shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{rerouteMessage}</span>
              </div>
              <button onClick={() => setRerouteMessage('')} className="text-white/80 hover:text-white text-sm">✕</button>
            </motion.div>
          )}

          {showFloorToast && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-lg font-bold border border-white/10 flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              {floors.find(f => f.id === currentFloorId)?.name || `Floor ${currentFloorId}`}
            </motion.div>
          )}

          {/* Persistent Floor / Navigation Status Widget */}
          {(() => {
            const isNavigating = navStatus !== 'IDLE' && route?.path && route.path.length > 0;
            const destFloorId = isNavigating ? route.path[route.path.length - 1].floorId : null;
            const destFloor = floors.find(f => f.id === destFloorId);
            const currFloor = floors.find(f => f.id === currentFloorId);
            let floorsRemaining = 0;
            let directionStr = "";
            if (isNavigating && currentSegment) {
              const currentSegIdx = allSegments.findIndex(s => s === currentSegment);
              if (currentSegIdx !== -1) {
                floorsRemaining = allSegments.length - currentSegIdx - 1;
                if (floorsRemaining > 0 && currentSegment.nextFloorId !== undefined) {
                  const currFloorObj = floors.find(f => f.id === currentFloorId);
                  const nextFloorObj = floors.find(f => f.id === currentSegment.nextFloorId);
                  if (currFloorObj && nextFloorObj) {
                    directionStr = nextFloorObj.level > currFloorObj.level ? "Up ⬆" : "Down ⬇";
                  }
                }
              }
            }
            
            return isNavigating ? (
              <motion.div 
                drag
                dragMomentum={false}
                whileDrag={{ scale: 1.05, opacity: 0.9, cursor: 'grabbing' }}
                className="absolute top-28 right-4 z-30 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-slate-200/60 flex flex-col gap-1 min-w-[190px] max-w-[240px] cursor-grab touch-none"
              >
                {/* Integrated Turn Maneuver Header */}
                {currentManeuver && navStatus === 'NAVIGATING_SEGMENT' && (
                  <div className="bg-slate-900 text-white p-2.5 rounded-xl flex items-center gap-2.5 mb-2 shadow-sm border border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
                      {currentManeuver.type.includes('LEFT') ? '↰' : currentManeuver.type.includes('RIGHT') ? '↱' : currentManeuver.type.includes('TRANSITION') ? '▲' : '↑'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {currentManeuver.type === 'STAIRCASE_TRANSITION' ? `Take Stairs to ${floors.find(f => f.id === currentManeuver.targetFloorId)?.name || 'Floor ' + currentManeuver.targetFloorId}` :
                         currentManeuver.type === 'LIFT_TRANSITION' ? `Take Elevator to ${floors.find(f => f.id === currentManeuver.targetFloorId)?.name || 'Floor ' + currentManeuver.targetFloorId}` :
                         currentManeuver.type === 'DESTINATION_ARRIVAL' ? 'Arrive at Destination' :
                         currentManeuver.type.replace('TURN_', '').replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        in {Math.max(1, Math.round(currentManeuver.pathDistanceToManeuver))}m
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  <span>Journey</span>
                  <span className="text-emerald-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Active</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-800 gap-4">
                  <span className="text-slate-500 text-xs">Current:</span>
                  <span>{currFloor?.name || `Floor ${currentFloorId}`}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-800 gap-4 mb-2">
                  <span className="text-slate-500 text-xs">Dest:</span>
                  <span>{destFloor?.name || `Floor ${destFloorId}`}</span>
                </div>
                
                {floorsRemaining > 0 ? (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-center items-center text-xs font-bold text-amber-500 gap-1">
                    {floorsRemaining} Floor{floorsRemaining > 1 ? 's' : ''} Left (Go {directionStr})
                  </div>
                ) : (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-center items-center text-xs font-bold text-emerald-500 gap-1">
                    On Destination Floor
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="absolute top-28 right-4 z-30 bg-white/95 backdrop-blur-md px-4 py-2 rounded-xl shadow-md border border-slate-200/60 flex items-center gap-2 text-sm font-bold text-slate-700">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                {currFloor?.name || `Floor ${currentFloorId}`}
              </div>
            );
          })()}

          {showLowConfidenceFloorDialog && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="absolute top-28 right-4 z-40 bg-white border border-slate-300 p-4 rounded-2xl shadow-xl w-80 backdrop-blur-md"
            >
              <div className="flex items-center gap-2 mb-2 text-slate-800 font-bold text-sm">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Select Your Current Floor</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Unable to accurately verify your floor level automatically.</p>
              
              <div className="grid grid-cols-3 gap-2 mb-3">
                {floors.map(fl => (
                  <button
                    key={fl.id}
                    onClick={() => setManualRecoveryFloor(fl.id)}
                    className={`py-2 px-1 text-xs rounded-lg font-bold border transition-all ${
                      manualRecoveryFloor === fl.id 
                        ? 'bg-black text-white border-black shadow-sm' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {fl.name}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowLowConfidenceFloorDialog(false)}
                  className="w-1/3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleConfirmManualFloorRecovery}
                  className="w-2/3 py-2 text-xs font-bold text-white bg-black hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
                >
                  Resume Navigation
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          className="w-full h-full relative overflow-hidden bg-gray-50 rounded-2xl shadow-inner border border-gray-200/50"
          style={{ minHeight: '60vh' }}
        >
          <svg 
            ref={svgRef} 
            width="100%" 
            height="100%"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ cursor: isDraggingCanvas ? 'grabbing' : 'grab', position: 'relative', zIndex: 10, touchAction: 'none' }}
          >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            <g transform={`rotate(${metadata?.rotation ?? 0} ${metadata?.originX ?? 512} ${metadata?.originY ?? 512})`}>
                {(blobMapUrl || encodedFloorUrl || currentFloorUrl) && (
                    <image 
                          preserveAspectRatio="none"
                          href={blobMapUrl || encodedFloorUrl || currentFloorUrl}
                          xlinkHref={blobMapUrl || encodedFloorUrl || currentFloorUrl}
                          width={metadata?.svgWidth || 1024} 
                          height={metadata?.svgHeight || 1024} 
                          opacity={0.85}
                          style={{ pointerEvents: 'none' }}
                    />
                )}
            </g>
            <text x="40" y="60" fill="#94a3b8" fontSize="24" fontWeight="bold">
              {floors.find(f => f.id === currentFloorId)?.name || `Floor ${currentFloorId}`}
            </text>

            {/* Draw all graph edges for exploration (faded if navigating) */}
            {edgesRenderLayer}

            {/* Draw all graph nodes (faded if navigating) */}
            {nodesRenderLayer}

            {/* Active Route Highlighting & Dynamic Split Progress */}
            {(() => {
              if (!route?.path || route.path.length === 0) return null;
              
              const splitRoute = NavigationPathSplitter.splitPathAtPosition(
                route.path,
                locState.navigationPosition?.currentEdgeId,
                navRenderPos,
                activeGraph?.edges || []
              );

              const routeBaseColor = accessProfile === 'STUDENT' ? '#1d4ed8' : '#059669';
              const routeHighlightColor = accessProfile === 'STUDENT' ? '#3b82f6' : '#10b981';
              const routePulseColor = accessProfile === 'STUDENT' ? '#93c5fd' : '#a7f3d0';

              const getContiguousChunks = (points: any[]) => {
                  const chunks: any[][] = [];
                  let currentChunk: any[] = [];
                  for (let i = 0; i < points.length; i++) {
                      if (points[i].floorId === currentFloorId) {
                          currentChunk.push(points[i]);
                      } else {
                          if (currentChunk.length >= 2) chunks.push(currentChunk);
                          currentChunk = [];
                      }
                  }
                  if (currentChunk.length >= 2) chunks.push(currentChunk);
                  return chunks;
              };

              const completedChunks = getContiguousChunks(splitRoute.completedPoints);
              const remainingChunks = getContiguousChunks(splitRoute.remainingPoints);

              return (
                <g>
                  {/* Layer 1: Conduit Road Glow (per contiguous segment) */}
                  {memoizedContiguousSegments.map((seg: any[], segIdx: number) => seg.length >= 2 && (
                    <polyline 
                      key={`glow-${segIdx}`}
                      points={seg.map((n: any) => `${n.x},${n.y}`).join(' ')}
                      fill="none" 
                      stroke={routeBaseColor} 
                      strokeWidth={14 * inverseScale} 
                      strokeOpacity="0.18" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                  ))}

                  {/* Layer 2: Completed Route Segment (Muted) */}
                  {completedChunks.map((seg: any[], segIdx: number) => (
                    <polyline 
                      key={`comp-${segIdx}`}
                      points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none" 
                      stroke="#94a3b8" 
                      strokeWidth={7 * inverseScale} 
                      strokeOpacity="0.85" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                  ))}

                  {/* Layer 3: Remaining Route Segment (Vibrant Emerald) */}
                  {remainingChunks.map((seg: any[], segIdx: number) => (
                    <g key={`rem-${segIdx}`}>
                      <polyline 
                        points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" 
                        stroke={routeHighlightColor} 
                        strokeWidth={9 * inverseScale} 
                        strokeOpacity="0.95" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                      {/* Directional Pulse Beam (Animation removed for performance) */}
                      <polyline 
                        points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" 
                        stroke={routePulseColor} 
                        strokeWidth={3.5 * inverseScale} 
                        strokeDasharray={`${10 * inverseScale} ${14 * inverseScale}`} 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                    </g>
                  ))}
                </g>
              );
            })()}

            {/* Destination Landmark Beacon */}
            {(() => {
              const destNode = activeGraph?.nodes.find(n => n.id === parseInt(destinationId || '0', 10));
              if (destNode && destNode.floorId === currentFloorId) {
                return (
                  <g transform={`translate(${destNode.x}, ${destNode.y})`}>
                    <circle r={22 * inverseScale} fill="#000000" fillOpacity="0.10" />
                    <circle r={13 * inverseScale} fill="#0f172a" stroke="#ffffff" strokeWidth={2.5 * inverseScale} />
                    <text y={-20 * inverseScale} textAnchor="middle" fill="#0f172a" fontSize={13 * inverseScale} fontWeight="bold">
                      🏁 {destNode.name || 'Destination'}
                    </text>
                  </g>
                );
              }
              return null;
            })()}

            {/* Transition Checkpoint Badge (Stairs/Lift) */}
            {(() => {
              const cpNode = currentSegment?.transitionNode;
              if (cpNode && currentSegment?.floorId === currentFloorId) {
                return (
                  <g transform={`translate(${cpNode.x}, ${cpNode.y})`}>
                    <circle r={26 * inverseScale} fill="#10b981" fillOpacity="0.15" />
                    <circle r={14 * inverseScale} fill="#059669" stroke="#ffffff" strokeWidth={2.5 * inverseScale} />
                    <text y={-22 * inverseScale} textAnchor="middle" fill="#047857" fontSize={12 * inverseScale} fontWeight="bold">
                      {cpNode.type === 'LIFT' ? '🛗 Elevator' : '🪜 Stairs'} {(() => {
                        const currLvl = floors.find(f => f.id === currentFloorId)?.level;
                        const nextLvl = floors.find(f => f.id === currentSegment.nextFloorId)?.level;
                        const nextName = floors.find(f => f.id === currentSegment.nextFloorId)?.name || `Floor ${currentSegment.nextFloorId}`;
                        const arrow = currLvl !== undefined && nextLvl !== undefined ? (nextLvl > currLvl ? '⬆' : '⬇') : '➔';
                        return `${arrow} ${nextName}`;
                      })()}
                    </text>
                  </g>
                );
              }
              return null;
            })()}

            {/* Draw Step History Trail */}
            {stepHistory.length > 0 && (
                <polyline 
                    points={stepHistory.filter(h => h.floorId === currentFloorId).map(h => `${h.x},${h.y}`).join(' ')}
                    fill="none" 
                    stroke="#444444" 
                    strokeWidth={4 * inverseScale} 
                    strokeDasharray={`${6 * inverseScale} ${4 * inverseScale}`} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />
            )}

            {/* Smoothed Dynamic Navigation Position Marker */}
            {(() => {
                if (!navRenderPos) return null;
                
                let fallbackHeadingDeg = 0;
                if (route?.path && route.path.length > 1) {
                   const floorPath = route.path.filter(n => n.floorId === currentFloorId);
                   if (floorPath.length > 1) {
                      fallbackHeadingDeg = (Math.atan2(floorPath[1].y - floorPath[0].y, floorPath[1].x - floorPath[0].x) * 180 / Math.PI) + 90;
                   }
                }
                
                const finalHeadingDeg = (smoothedMarker.heading || locState.navigationPosition?.heading) 
                    ? (smoothedMarker.heading || locState.navigationPosition?.heading || 0) * (180/Math.PI)
                    : fallbackHeadingDeg;

                return (
                  <g 
                      id="dynamic-marker-group"
                      transform={`translate(${smoothedMarker.x || navRenderPos.x}, ${smoothedMarker.y || navRenderPos.y})`}
                      style={{ pointerEvents: 'none' }}
                  >
                     {/* Radar pulse aura */}
                     <circle 
                       r={9 * inverseScale} 
                       fill="#10b981" 
                     />
                     
                     {/* Precision aura halo */}
                     <circle 
                       r={15 * inverseScale} 
                       fill="#ffffff" 
                       stroke="#10b981" 
                       strokeWidth={2.5 * inverseScale} 
                     />
                     
                     {/* Rotating Directional 3D Navigation Arrow */}
                     <g id="dynamic-marker-rotate" transform={`rotate(${finalHeadingDeg})`}>
                       <polygon 
                            points={`
                                0,${-14 * inverseScale} 
                                ${9 * inverseScale},${10 * inverseScale} 
                                0,${5 * inverseScale} 
                                ${-9 * inverseScale},${10 * inverseScale}
                            `} 
                            fill="#0f172a" 
                            stroke="#ffffff" 
                            strokeWidth={2 * inverseScale}
                       />
                       <polygon 
                            points={`
                                0,${-14 * inverseScale} 
                                ${9 * inverseScale},${10 * inverseScale} 
                                0,${5 * inverseScale}
                            `} 
                            fill="#10b981" 
                       />
                     </g>
                  </g>
                );
            })()}

          </g>
        </svg>

        {/* Floating Re-center Button when manual pan is active */}
        <AnimatePresence>
          {!isAutoFollowing && (navRenderPos || destinationId) && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 15 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRecenterCamera}
              className="absolute bottom-20 right-6 z-30 flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 hover:bg-slate-900 text-white rounded-full shadow-2xl border border-white/20 backdrop-blur-md font-bold text-xs tracking-wider transition-all"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Re-center</span>
            </motion.button>
          )}
        </AnimatePresence>

        <button
            onClick={() => {
                engine.stop();
                setTimeout(() => engine.start(), 100);
            }}
            className="absolute bottom-6 left-6 z-20 p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-lg transition-transform active:scale-95"
            title="Force Recalibrate"
        >
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        </button>

        {/* Floor Selector */}
        <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2 items-start pointer-events-auto max-w-[calc(100%-2rem)]">
          <AnimatePresence>
            {isFloorSelectorOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="flex gap-2 overflow-x-auto pb-1 p-1"
              >
                {floors.map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => { setCurrentFloorId(f.id); setIsFloorSelectorOpen(false); }} 
                      className={`px-5 py-2.5 rounded-xl shadow-sm font-bold transition-all whitespace-nowrap ${currentFloorId === f.id ? 'bg-[#222222] text-white scale-[1.05]' : 'bg-white text-gray-500 hover:text-gray-800 border border-gray-200'}`}
                    >
                      {f.name}
                    </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setIsFloorSelectorOpen(!isFloorSelectorOpen)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-800 rounded-xl shadow-md font-bold transition-all border border-gray-200 hover:bg-gray-50"
          >
            <span>{floors.find(f => f.id === currentFloorId)?.name || `Floor ${currentFloorId}`}</span>
            <svg className={`w-4 h-4 transition-transform ${isFloorSelectorOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
        </div>
      </div>
    </div>  

      <AnimatePresence>
        {Capacitor.isNativePlatform() && navStatus !== 'IDLE' && route?.path && route.path.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto"
            style={{ maxWidth: '100vw' }}
          >
            {/* Gradient fade edge */}
            <div className="h-6 bg-gradient-to-t from-slate-900/95 to-transparent" />
            
            <div className="bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 px-4 pb-[env(safe-area-inset-bottom,8px)] pt-3">
              {/* Current Instruction Row */}
              <div className="flex items-center gap-3 mb-3">
                {/* Maneuver Icon */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                  currentManeuver?.type.includes('TRANSITION') ? 'bg-amber-500/20 text-amber-400' :
                  currentManeuver?.type === 'DESTINATION_ARRIVAL' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {currentManeuver?.type.includes('LEFT') ? '↰' : 
                   currentManeuver?.type.includes('RIGHT') ? '↱' : 
                   currentManeuver?.type.includes('STAIRCASE') ? '🪜' :
                   currentManeuver?.type.includes('LIFT') ? '🛗' :
                   currentManeuver?.type === 'DESTINATION_ARRIVAL' ? '📍' : '↑'}
                </div>
                
                {/* Instruction Text */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm leading-tight truncate">
                    {currentManeuver?.type === 'STAIRCASE_TRANSITION' 
                      ? `Take Stairs → ${floors.find(f => f.id === currentManeuver.targetFloorId)?.name || 'Next Floor'}`
                      : currentManeuver?.type === 'LIFT_TRANSITION'
                      ? `Take Elevator → ${floors.find(f => f.id === currentManeuver.targetFloorId)?.name || 'Next Floor'}`
                      : currentManeuver?.type === 'DESTINATION_ARRIVAL'
                      ? 'Arriving at Destination'
                      : currentManeuver?.type === 'TURN_LEFT' || currentManeuver?.type === 'TURN_SHARP_LEFT'
                      ? 'Turn Left ahead'
                      : currentManeuver?.type === 'TURN_RIGHT' || currentManeuver?.type === 'TURN_SHARP_RIGHT'
                      ? 'Turn Right ahead'
                      : currentManeuver?.type === 'TURN_SLIGHT_LEFT'
                      ? 'Slight Left ahead'
                      : currentManeuver?.type === 'TURN_SLIGHT_RIGHT'
                      ? 'Slight Right ahead'
                      : currentManeuver?.type === 'U_TURN'
                      ? 'Make a U-Turn'
                      : 'Continue Straight'}
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5">
                    {currentManeuver 
                      ? `in ${Math.max(1, Math.round(currentManeuver.pathDistanceToManeuver))}m`
                      : 'Calculating...'}
                  </div>
                </div>
                
                {/* Distance Badge */}
                <div className="text-right shrink-0">
                  <div className="text-emerald-400 font-bold text-lg tabular-nums">
                    {route.totalDistance ? `${route.totalDistance.toFixed(0)}m` : '—'}
                  </div>
                  <div className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">Total</div>
                </div>
              </div>
              
              {/* Floor Progress Bar */}
              {allSegments.length > 1 && (() => {
                const currentSegIdx = allSegments.findIndex(s => s === currentSegment);
                const progress = currentSegIdx >= 0 ? ((currentSegIdx + 1) / allSegments.length) * 100 : 0;
                return (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      <span>{floors.find(f => f.id === currentFloorId)?.name || 'Current'}</span>
                      <span className="text-slate-400">
                        {currentSegIdx >= 0 ? `${currentSegIdx + 1}/${allSegments.length} segments` : ''}
                      </span>
                      <span>{floors.find(f => f.id === route.path[route.path.length - 1]?.floorId)?.name || 'Dest'}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${Math.max(5, progress)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })()}
              
              {/* Next Maneuver Preview (if upcoming) */}
              {upcomingManeuvers.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/40">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider shrink-0">Then</span>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {upcomingManeuvers.slice(0, 3).map((m, i) => (
                      <div key={m.id || i} className="flex items-center gap-1.5 shrink-0">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                          m.type.includes('TRANSITION') ? 'bg-amber-500/20 text-amber-400' :
                          m.type === 'DESTINATION_ARRIVAL' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {m.type.includes('LEFT') ? '↰' : 
                           m.type.includes('RIGHT') ? '↱' : 
                           m.type.includes('STAIRCASE') ? '🪜' :
                           m.type.includes('LIFT') ? '🛗' :
                           m.type === 'DESTINATION_ARRIVAL' ? '📍' : '↑'}
                        </span>
                        <span className="text-slate-400 text-[11px] font-medium">
                          {Math.max(1, Math.round(m.pathDistanceToManeuver))}m
                        </span>
                        {i < Math.min(upcomingManeuvers.length, 3) - 1 && (
                          <span className="text-slate-600 text-[10px]">›</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Sidebar - Location & Navigation */}
      <AnimatePresence>
        {isLocationPanelOpen && (
          <motion.div 
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute md:relative right-0 top-0 h-full w-72 bg-white/95 backdrop-blur-md border-l border-gray-200 p-5 pt-28 flex flex-col z-20 shadow-xl overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-gray-800">Your Location</h3>
              <button
                onClick={() => setIsLocationPanelOpen(false)}
                title="Collapse Panel"
                className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-5 pb-3 border-b border-gray-100">Sensor Fusion & Floor Tracking</p>
            
            <div className="mb-6 text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                <p className="text-gray-600 mb-2 border-b pb-2 border-gray-200">Status: <span className={locState.status === 'POSITION_ESTABLISHED' ? 'text-green-600 font-bold' : locState.status === 'OUTSIDE_BUILDING' ? 'text-red-600 font-bold' : 'text-yellow-600 font-bold'}>{locState.status.replace(/_/g, ' ')}</span></p>
                
                {locState.navigationPosition && (
                    <>
                        <p className="text-gray-500 flex justify-between"><span>Confidence:</span> <span className="text-gray-800 font-bold bg-white px-2 py-0.5 rounded shadow-sm">{locState.navigationPosition.confidence.replace('_', ' ')}</span></p>
                        <p className="text-gray-500 flex justify-between"><span>Motion State:</span> <span className="text-gray-800 font-medium">{locState.navigationPosition.motionState || 'UNKNOWN'}</span></p>
                        <p className="text-gray-500 flex justify-between"><span>Heading:</span> <span className="text-gray-800 font-medium">{locState.navigationPosition.heading !== undefined ? (locState.navigationPosition.heading * (180/Math.PI)).toFixed(1) + '°' : 'N/A'}</span></p>
                        <p className="text-gray-500 flex justify-between"><span>Speed:</span> <span className="text-gray-800 font-medium">{locState.navigationPosition.velocity !== undefined ? locState.navigationPosition.velocity.toFixed(2) + ' m/s' : '0.00 m/s'}</span></p>
                        <p className="text-gray-500 flex justify-between"><span>Current Floor:</span> <span className="text-gray-800 font-medium">{locState.navigationPosition.floorId}</span></p>
                        <p className="text-gray-500 flex justify-between"><span>Current Edge:</span> <span className="text-gray-800 font-medium">{locState.navigationPosition.currentEdgeId ?? 'None'}</span></p>
                    </>
                )}
            </div>

            <button 
                onClick={() => engine.triggerManualRecalibration()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm w-full font-bold shadow-sm transition-all mb-3"
            >
                Recalibrate Location
            </button>

            <button 
                onClick={() => {
                  const currFloor = floors.find(f => f.id === currentFloorId);
                  const bId = currFloor?.buildingId || 1;
                  navigate(`/destinations?presetBuildingId=${bId}&presetFloorId=${currentFloorId}`);
                }}
                className="mt-auto bg-[#222222] hover:bg-[#444444] text-white px-4 py-3 rounded-xl text-sm w-full font-bold shadow-sm transition-all hover:shadow-md"
            >
                Find Destination
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isLocationPanelOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsLocationPanelOpen(true)}
            className="absolute top-28 right-4 z-20 bg-white p-3 rounded-xl shadow-lg border border-gray-200 text-gray-700 hover:text-black hover:bg-gray-50 transition-colors"
            title="Open Location Status"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Initialization Status Overlays */}
      <AnimatePresence>
      {locState.status === 'INITIALIZING_LOCATION' && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
        >
           <div className="w-12 h-12 rounded-full border-4 border-[#222222] border-t-transparent animate-spin mb-4"></div>
           <h2 className="text-2xl font-bold text-gray-800 mb-2">Detecting Location</h2>
           <p className="text-gray-500 font-medium mb-6">Listening to sensors...</p>
           
           <button 
              onClick={() => engine.triggerManualRecalibration()}
              className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
           >
               Skip Auto-Detection
           </button>
        </motion.div>
      )}

      {(locState.status === 'WAITING_FOR_FLOOR' && !locState.navigationPosition) && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-2">Select Your Floor</h2>
            <p className="text-sm text-gray-500 mb-6">We've found your position on the map, but we need to know which floor you are on.</p>

            <label className="text-sm font-bold text-gray-700 mb-2">Floor</label>
            <select 
              className="mb-6 p-3 border border-gray-300 rounded-lg outline-none focus:border-[#222222]"
              value={selectedStartFloor}
              onChange={(e) => setSelectedStartFloor(parseInt(e.target.value))}
            >
              {floors.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button 
                onClick={handleCancelStart}
                className="w-1/3 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmStart}
                className="w-2/3 py-3 bg-[#222222] text-white rounded-xl font-bold hover:bg-[#444444]"
              >
                Start Navigation
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Manual Start Dialog has been moved to /destinations */}
      </AnimatePresence>

    </div>
  );
}

class MapPageErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, info: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("MapPage Error Boundary caught:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee', color: 'red', fontFamily: 'monospace' }}>
          <h2>MapPage Crashed</h2>
          <p><strong>Error:</strong> {this.state.error?.message}</p>
          <pre>{this.state.error?.stack}</pre>
          <hr />
          <pre>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MapPageWithBoundary() {
  return (
    <MapPageErrorBoundary>
      <MapPage />
    </MapPageErrorBoundary>
  );
}
