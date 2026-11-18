import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  GraphNodeData,
  GraphEdgeData,
  GraphMetadataData,
} from "../../localization/types/GraphTypes";
import { GraphTransform } from "../../localization/graph/GraphTransform";
import { Inspectors } from "./Inspectors";
import { ValidationEngine, ValidationIssue } from "./ValidationEngine";
import { useAuth } from "../../context/AuthContext";
import { BuildingDTO } from "../BuildingManager/BuildingManager";
import { FloorDTO } from "../BuildingManager/FloorManager";
import { GraphAnalysisPanel } from "./GraphAnalysisPanel";
import { CommandManager } from "./CommandManager";
import { useImageBlobUrl } from "../../hooks/useImageBlobUrl";
import { useLocalization } from "../../context/LocalizationContext";
import { API_BASE_URL } from "../../config";

export const GraphEditorPage: React.FC = () => {
  // Context State
  const [buildings, setBuildings] = useState<BuildingDTO[]>([]);
  const [floors, setFloors] = useState<FloorDTO[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(
    null,
  );
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);
  const currentFloorUrl = floors.find(
    (fl) => fl.id === selectedFloorId,
  )?.svgMapUrl;
  const encodedFloorUrl = currentFloorUrl
    ? encodeURI(currentFloorUrl)
    : undefined;
  const blobMapUrl = useImageBlobUrl(encodedFloorUrl);

  // Canvas panning/zooming state
  const [transform, setTransform] = useState({
    x: window.innerWidth > 768 ? 50 : 20,
    y: window.innerWidth > 768 ? 50 : 20,
    scale: window.innerWidth > 768 ? 1 : 0.35,
  });

  // Graph State
  const [nodes, setNodes] = useState<GraphNodeData[]>([]);
  const [edges, setEdges] = useState<GraphEdgeData[]>([]);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  
  // Memoized Node Lookup for fast rendering
  const nodesMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const [metadata, setMetadata] = useState<GraphMetadataData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  let nextTempId = useRef(-1);
  const { token, logout } = useAuth();
  const { refreshGraph } = useLocalization();

  // Viewport State
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection & Interaction State
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const [dragStartNodes, setDragStartNodes] = useState<GraphNodeData[] | null>(null);
  const [dragStartEdges, setDragStartEdges] = useState<GraphEdgeData[] | null>(null);
  const [mode, setMode] = useState<
    "SELECT" | "CREATE_DESTINATION" | "CREATE_CONNECTOR" | "CREATE_EDGE" | "MEASURE" | "CALIBRATE"
  >("SELECT");
  const [edgeStartNode, setEdgeStartNode] = useState<number | null>(null);
  const [measurePoints, setMeasurePoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Marquee Selection State
  const [marqueeStart, setMarqueeStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Node Search
  const [searchQuery, setSearchQuery] = useState("");

  // Telemetry Breadcrumbs
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [telemetryPoints, setTelemetryPoints] = useState<{ x: number; y: number; floorId: number; timestamp: number }[]>([]);

  const fetchTelemetry = async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/api/v1/admin/telemetry/unmapped`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              setTelemetryPoints(data);
          }
      } catch (e) {
          console.error("Failed to load telemetry", e);
      }
  };

  useEffect(() => {
      if (showTelemetry) {
          fetchTelemetry();
      }
  }, [showTelemetry, selectedFloorId]);

  const [, forceRender] = useState(0);
  const cmdManager = useRef(
    new CommandManager(() => {
      forceRender((prev) => prev + 1);
      setIsDirty(true);
    }),
  );

  const pushSnapshot = (oldNodes: GraphNodeData[], oldEdges: GraphEdgeData[], newNodes: GraphNodeData[], newEdges: GraphEdgeData[]) => {
    cmdManager.current.execute({
        execute: () => { setNodes(newNodes); setEdges(newEdges); },
        undo: () => { setNodes(oldNodes); setEdges(oldEdges); }
    });
  };

  // Fetch Buildings
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/admin/buildings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
           if (res.status === 401 || res.status === 403) logout();
           throw new Error("Failed to fetch buildings");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setBuildings(data);
          if (data.length > 0) setSelectedBuildingId(data[0].id);
        }
      })
      .catch((e) => console.error(e));
  }, [token, logout]);

  // Fetch Floors when Building changes
  useEffect(() => {
    if (!token || !selectedBuildingId) return;
    fetch(`${API_BASE_URL}/api/v1/admin/buildings/${selectedBuildingId}/floors`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
           if (res.status === 401 || res.status === 403) logout();
           throw new Error("Failed to fetch floors");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setFloors(data);
          if (data.length > 0) {
            setSelectedFloorId(data[0].id);
          } else {
            setSelectedFloorId(null);
            setNodes([]);
            setEdges([]);
            setMetadata(null);
          }
        }
      })
      .catch((e) => console.error(e));
  }, [selectedBuildingId, token, logout]);

  // Fetch initial data when Floor changes
  useEffect(() => {
    const loadGraph = async () => {
      if (!token || !selectedFloorId) return;
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [nRes, eRes, mRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/admin/nodes?floorId=${selectedFloorId}`, { headers }),
          fetch(`${API_BASE_URL}/api/v1/admin/edges?floorId=${selectedFloorId}`, { headers }),
          fetch(`${API_BASE_URL}/api/v1/admin/metadata/${selectedFloorId}`, { headers }),
        ]);

        if (nRes.status === 401 || nRes.status === 403) {
          logout();
          return;
        }
        const nData = await nRes.json();
        const mappedNodes = nData.map((n: any) => ({
          ...n,
          floorId: n.floor ? n.floor.id : n.floorId,
        }));
        const eData = await eRes.json();
        const mData = await mRes.json();

        setNodes(mappedNodes);
        setEdges(eData);
        setMetadata(mData);
        cmdManager.current.clear();
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setIsDirty(false);
      } catch (error) {
        console.error("Failed to load graph", error);
      }
    };
    loadGraph();
  }, [selectedFloorId, token, logout]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") setIsSpacePressed(true);
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeIds.length > 0) {
          const newNodes = nodes.filter((n) => !selectedNodeIds.includes(n.id));
          const newEdges = edges.filter(
            (e) =>
              !selectedNodeIds.includes(e.sourceId) &&
              !selectedNodeIds.includes(e.destinationId),
          );
          pushSnapshot(nodes, edges, newNodes, newEdges);
          setSelectedNodeIds([]);
          setIsDirty(true);
        } else if (selectedEdgeId !== null) {
          const newEdges = edges.filter((ed) => ed.id !== selectedEdgeId);
          pushSnapshot(nodes, edges, nodes, newEdges);
          setSelectedEdgeId(null);
          setIsDirty(true);
        }
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        cmdManager.current.undo();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setIsSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNodeIds, selectedEdgeId, nodes, edges]);

  const handleNodeSearch = () => {
    if (!searchQuery) return;
    const q = searchQuery.toLowerCase();
    const found = nodes.filter(
      (n) =>
        (n.name && n.name.toLowerCase().includes(q)) ||
        (n.internalName && n.internalName.toLowerCase().includes(q)),
    );
    if (found.length > 0) {
      setSelectedNodeIds(found.map((f) => f.id));
      const n = found[0];
      setTransform({
        x: -n.x + window.innerWidth / 2 - 150,
        y: -n.y + window.innerHeight / 2,
        scale: 1.5,
      });
    }
  };

  const updateNodesAndRecalculateEdges = (newNodes: GraphNodeData[]) => {
    setNodes(newNodes);
    setEdges((prevEdges) =>
      prevEdges.map((e) => {
        const srcNode = newNodes.find((n) => n.id === e.sourceId);
        const destNode = newNodes.find((n) => n.id === e.destinationId);
        if (srcNode && destNode) {
          const pxDist = Math.sqrt(
            Math.pow(destNode.x - srcNode.x, 2) +
              Math.pow(destNode.y - srcNode.y, 2),
          );
          const newDist = pxDist / (metadata?.pixelsPerMeter || 1);
          if (Math.abs(e.distance - newDist) > 0.001) {
            return { ...e, distance: newDist };
          }
        }
        return e;
      }),
    );
    setIsDirty(true);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    svg.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleNativeWheel);
  }, []);

  // Canvas panning/zooming state
  const activePointers = useRef<
    Map<number, { clientX: number; clientY: number }>
  >(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    scale: number;
    x: number;
    y: number;
  } | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * zoomFactor, 0.1), 10);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: newScale };

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const graphX = (mouseX - t.x) / t.scale;
      const graphY = (mouseY - t.y) / t.scale;

      return {
        x: mouseX - graphX * newScale,
        y: mouseY - graphY * newScale,
        scale: newScale,
      };
    });
  };

  const getSVGPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(g.getScreenCTM()!.inverse());
  };

  const handleCreateNode = (x: number, y: number, nodeType: string) => {
    if (!selectedFloorId) return alert("Select a floor first");
    const newNodeReq = {
      x,
      y,
      type: nodeType,
      floorId: selectedFloorId,
      name: "New Node",
      isEnabled: true,
      routeVisibility: true,
      isAccessible: true,
      isSearchable: true,
    };
    const savedNode = { ...newNodeReq, id: nextTempId.current-- };
    setNodes([...nodes, savedNode as GraphNodeData]);
    setSelectedNodeIds([savedNode.id]);
    setIsDirty(true);
    setMode("SELECT");
  };

  const handleCreateCrossFloorEdge = (targetId: number) => {
    if (!selectedNodeIds[0]) return;
    const src = nodes.find((n) => n.id === selectedNodeIds[0]);
    if (!src) return;

    const newEdge: GraphEdgeData = {
      id: nextTempId.current--,
      sourceId: src.id,
      destinationId: targetId,
      distance: 0, // Backend auto-calculates on save based on exact floor difference
      direction: "BIDIRECTIONAL",
      traversalType: "STAIRS",
      isEnabled: true,
      isFloorTransition: true,
    };
    
    setEdges([...edges, newEdge]);
    setIsDirty(true);
    alert(`Created cross-floor edge to Node ${targetId}. Please Save Graph to apply.`);
  };

  const handleSplitEdgeWithBendNode = (edgeId: number) => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const srcNode = nodes.find((n) => n.id === edge.sourceId);
    const destNode = nodes.find((n) => n.id === edge.destinationId);
    if (!srcNode || !destNode) return;

    const midX = Math.round((srcNode.x + destNode.x) / 2);
    const midY = Math.round((srcNode.y + destNode.y) / 2);
    const ppm = metadata?.pixelsPerMeter || 1;

    const bendCount = nodes.filter((n) => n.type === "CORRIDOR_BEND").length + 1;
    const bendName = `CB_${String(bendCount).padStart(3, "0")}`;

    const newBendNode: GraphNodeData = {
      id: nextTempId.current--,
      name: bendName,
      x: midX,
      y: midY,
      type: "CORRIDOR_BEND",
      floorId: srcNode.floorId,
      isEnabled: true,
      routeVisibility: true,
      isAccessible: true,
      isSearchable: false,
    };

    const dist1 = Math.hypot(midX - srcNode.x, midY - srcNode.y) / ppm;
    const dist2 = Math.hypot(destNode.x - midX, destNode.y - midY) / ppm;

    const edge1: GraphEdgeData = {
      id: nextTempId.current--,
      sourceId: srcNode.id,
      destinationId: newBendNode.id,
      distance: dist1,
      direction: edge.direction || "BIDIRECTIONAL",
      traversalType: edge.traversalType || "NORMAL",
      isEnabled: edge.isEnabled ?? true,
      isFloorTransition: false,
    };

    const edge2: GraphEdgeData = {
      id: nextTempId.current--,
      sourceId: newBendNode.id,
      destinationId: destNode.id,
      distance: dist2,
      direction: edge.direction || "BIDIRECTIONAL",
      traversalType: edge.traversalType || "NORMAL",
      isEnabled: edge.isEnabled ?? true,
      isFloorTransition: false,
    };

    setNodes([...nodes, newBendNode]);
    setEdges([...edges.filter((e) => e.id !== edgeId), edge1, edge2]);
    setSelectedNodeIds([newBendNode.id]);
    setSelectedEdgeId(null);
    setIsDirty(true);
    setMode("SELECT");
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof Element) {
      e.target.setPointerCapture(e.pointerId);
    }
    activePointers.current.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    if (activePointers.current.size === 2) {
      setIsDraggingCanvas(false);
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(
        pts[0].clientX - pts[1].clientX,
        pts[0].clientY - pts[1].clientY,
      );
      pinchStartRef.current = {
        dist,
        scale: transform.scale,
        x: transform.x,
        y: transform.y,
      };
      return;
    }

    if (activePointers.current.size === 1) {
      const target = e.target as Element;
      const isBackgroundClick =
        target === svgRef.current ||
        target.id === "canvas-bg" ||
        target.tagName === "image";

      const pt = getSVGPoint(e.clientX, e.clientY);

      if ((mode === "SELECT" && isBackgroundClick) || isSpacePressed) {
        if (e.shiftKey && !isSpacePressed) {
          setMarqueeStart(pt);
          setMarqueeEnd(pt);
        } else {
          setIsDraggingCanvas(true);
          setDragStart({
            x: e.clientX - transform.x,
            y: e.clientY - transform.y,
          });
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
        }
      } else if (mode === "CREATE_DESTINATION" || mode === "CREATE_CONNECTOR") {
        const t = mode === "CREATE_DESTINATION" ? "ROOM" : "CORRIDOR";
        handleCreateNode(Math.round(pt.x), Math.round(pt.y), t);
      } else if (mode === "MEASURE" || mode === "CALIBRATE") {
        if (measurePoints.length === 0) {
          setMeasurePoints([pt]);
        } else if (measurePoints.length === 1) {
          setMeasurePoints([measurePoints[0], pt]);

          if (mode === "CALIBRATE") {
            const distPx = Math.hypot(
              pt.x - measurePoints[0].x,
              pt.y - measurePoints[0].y,
            );
            const actualMeters = prompt(
              `Line drawn is ${distPx.toFixed(2)} pixels long.\n\nEnter the actual real-world length in METERS to calibrate the scale:`,
            );
            if (
              actualMeters &&
              !isNaN(parseFloat(actualMeters)) &&
              parseFloat(actualMeters) > 0
            ) {
              const ppm = distPx / parseFloat(actualMeters);
              if (metadata) {
                setMetadata({ ...metadata, pixelsPerMeter: ppm });
                
                // Instantly recalculate all current edges in the frontend to reflect the new scale
                const updatedEdges = edges.map(edge => {
                    const src = nodes.find(n => n.id === edge.sourceId);
                    const dest = nodes.find(n => n.id === edge.destinationId);
                    if (src && dest) {
                        const pxDist = Math.sqrt(Math.pow(src.x - dest.x, 2) + Math.pow(src.y - dest.y, 2));
                        return { ...edge, distance: pxDist / ppm };
                    }
                    return edge;
                });
                setEdges(updatedEdges);
                
                setIsDirty(true);
                alert(
                  `Calibrated successfully! Scale is now ${ppm.toFixed(2)} pixels per meter.`,
                );
              }
            }
            setMode("SELECT");
            setMeasurePoints([]);
          }
        }
      }
    }
  };

      const handlePointerMove = (e: React.PointerEvent) => {
        // ALWAYS track mouse position for the Measure/Calibrate UI overlay
        const pt = getSVGPoint(e.clientX, e.clientY);
        setMousePos(pt);

        if (!activePointers.current.has(e.pointerId)) return;
        activePointers.current.set(e.pointerId, {
          clientX: e.clientX,
          clientY: e.clientY,
        });

        if (activePointers.current.size === 2 && pinchStartRef.current) {
          const pts = Array.from(activePointers.current.values());
          const dist = Math.hypot(
            pts[0].clientX - pts[1].clientX,
            pts[0].clientY - pts[1].clientY,
          );
          const zoomFactor = dist / pinchStartRef.current.dist;
          const newScale = Math.min(
            Math.max(pinchStartRef.current.scale * zoomFactor, 0.1),
            10,
          );

          const clientX = (pts[0].clientX + pts[1].clientX) / 2;
          const clientY = (pts[0].clientY + pts[1].clientY) / 2;

          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;

          const mouseX = clientX - rect.left;
          const mouseY = clientY - rect.top;
          const graphX =
            (mouseX - pinchStartRef.current.x) / pinchStartRef.current.scale;
          const graphY =
            (mouseY - pinchStartRef.current.y) / pinchStartRef.current.scale;

          setTransform({
            x: mouseX - graphX * newScale,
            y: mouseY - graphY * newScale,
            scale: newScale,
          });
          return;
        }

        if (activePointers.current.size === 1) {
          const pt = getSVGPoint(e.clientX, e.clientY);
          setMousePos(pt);

          if (draggedNodeId !== null && mode === "SELECT" && !isSpacePressed) {
            updateNodesAndRecalculateEdges(
              nodes.map((n) =>
                n.id === draggedNodeId
                  ? { ...n, x: Math.round(pt.x), y: Math.round(pt.y) }
                  : n,
              ),
            );
            return;
          }

          if (isDraggingCanvas) {
            setTransform((t) => ({
              ...t,
              x: e.clientX - dragStart.x,
              y: e.clientY - dragStart.y,
            }));
            return;
          }

          if (marqueeStart) {
            setMarqueeEnd(pt);
          }
        }
      };

      const handlePointerUp = (e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId);

        if (activePointers.current.size < 2) {
          pinchStartRef.current = null;
        }

        if (draggedNodeId !== null) {
          setDraggedNodeId(null);
          if (dragStartNodes && dragStartEdges) {
              pushSnapshot(dragStartNodes, dragStartEdges, nodes, edges);
              setDragStartNodes(null);
              setDragStartEdges(null);
          }
        }

        if (marqueeStart && marqueeEnd) {
          const minX = Math.min(marqueeStart.x, marqueeEnd.x);
          const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
          const minY = Math.min(marqueeStart.y, marqueeEnd.y);
          const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

          const selected = nodes.filter(
            (n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY,
          );
          setSelectedNodeIds(selected.map((n) => n.id));

          setMarqueeStart(null);
          setMarqueeEnd(null);
        }

        if (activePointers.current.size === 1) {
          const pts = Array.from(activePointers.current.values());
          setIsDraggingCanvas(true);
          setDragStart({
            x: pts[0].clientX - transform.x,
            y: pts[0].clientY - transform.y,
          });
        } else if (activePointers.current.size === 0) {
          setIsDraggingCanvas(false);
        }
      };

      const handleNodeClick = (e: React.MouseEvent, nodeId: number) => {
        if (isSpacePressed) return;
        if (mode === "CREATE_EDGE") {
          if (edgeStartNode === null) {
            setEdgeStartNode(nodeId);
          } else if (edgeStartNode !== nodeId) {
            const src = nodes.find((n) => n.id === edgeStartNode)!;
            const dest = nodes.find((n) => n.id === nodeId)!;

            const distPx = Math.sqrt(
              Math.pow(src.x - dest.x, 2) + Math.pow(src.y - dest.y, 2),
            );
            const ppm = metadata?.pixelsPerMeter || 1;
            const newEdgeReq = {
              sourceId: edgeStartNode,
              destinationId: nodeId,
              distance: distPx / ppm,
              direction: "BIDIRECTIONAL",
              isEnabled: true,
              isFloorTransition: src.floorId !== dest.floorId,
              traversalType: "NORMAL",
            };

            const savedEdge = { ...newEdgeReq, id: nextTempId.current-- };
            setEdges([...edges, savedEdge as GraphEdgeData]);
            setEdgeStartNode(null);
            setMode("SELECT");
            setSelectedEdgeId(savedEdge.id);
            setIsDirty(true);
          }
        } else {
          if (e.shiftKey) {
            setSelectedNodeIds((prev) =>
              prev.includes(nodeId)
                ? prev.filter((id) => id !== nodeId)
                : [...prev, nodeId],
            );
          } else {
            setSelectedNodeIds([nodeId]);
            setSelectedEdgeId(null);
          }
        }
      };

      const handleSave = async () => {
        if (!selectedFloorId || !metadata) return;
        const payload = {
          floorId: selectedFloorId,
          metadata: metadata,
          nodes: nodes,
          edges: edges,
        };
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/admin/graph/import`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            await fetch(`${API_BASE_URL}/api/v1/graph/reload`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            
            // Tell the localization engine in THIS tab to refresh
            if (refreshGraph) {
                await refreshGraph();
            }

            // Tell the localization engine in OTHER tabs to refresh
            const bc = new BroadcastChannel('graph_sync');
            bc.postMessage('REFRESH_GRAPH');
            bc.close();

            alert("Graph synchronized successfully!");
            setIsDirty(false);
            const [nRes, eRes, mRes] = await Promise.all([
              fetch(`${API_BASE_URL}/api/v1/admin/nodes?floorId=${selectedFloorId}`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              fetch(`${API_BASE_URL}/api/v1/admin/edges?floorId=${selectedFloorId}`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              fetch(`${API_BASE_URL}/api/v1/admin/metadata/${selectedFloorId}`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);
            const nData = await nRes.json();
            const mappedNodes = nData.map((n: any) => ({
              ...n,
              floorId: n.floor ? n.floor.id : n.floorId,
            }));
            setNodes(mappedNodes);
            setEdges(await eRes.json());
            setMetadata(await mRes.json());
            setSelectedNodeIds([]);
            setSelectedEdgeId(null);
          } else {
            const err = await res.json();
            alert("Failed to save graph: " + (err.message || "Unknown error"));
          }
        } catch (e) {
          console.error(e);
          alert("Error saving graph");
        }
      };

      const handleExport = () => {
        if (!selectedFloorId || !metadata) return;
        
        // Prevent exporting if there are unsaved nodes with temporary IDs
        if (nodes.some(n => n.id < 0) || edges.some(e => e.id < 0)) {
            alert("Warning: You have unsaved changes with temporary IDs (like -1). Please click 'Save Graph' first to assign permanent IDs before exporting.");
            return;
        }

        const payload = {
          metadata: metadata,
          nodes: nodes,
          edges: edges,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `graph_floor_${selectedFloorId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };

      const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const payload = JSON.parse(event.target?.result as string);
            const { valid, errors } =
              ValidationEngine.validateImportPackage(payload);
            if (!valid) {
              alert(
                "Import Failed due to invalid package:\n" + errors.join("\n"),
              );
              return;
            }

            let finalNodes = payload.nodes;
            let finalEdges = payload.edges;

            // If the imported graph belongs to a different floor (e.g. user deleted the old floor and created a new one)
            // we must automatically remap all nodes and edges to the current floor and assign them fresh temporary IDs.
            if (finalNodes.length > 0 && finalNodes[0].floorId !== selectedFloorId) {
              let tempId = -1;
              const idMapping = new Map<number, number>();

              finalNodes = finalNodes.map((n: any) => {
                const newId = tempId--;
                idMapping.set(n.id, newId);
                return { ...n, id: newId, floorId: selectedFloorId };
              });

              finalEdges = finalEdges.map((edge: any) => ({
                ...edge,
                id: tempId--,
                sourceId: idMapping.has(edge.sourceId) ? idMapping.get(edge.sourceId) : edge.sourceId,
                destinationId: idMapping.has(edge.destinationId) ? idMapping.get(edge.destinationId) : edge.destinationId
              }));
            }

            setNodes(finalNodes);
            setEdges(finalEdges);
            setMetadata(payload.metadata);
            setIsDirty(true);
            alert(
              "Import successful! Please review the layout and click 'Save Graph' when ready.",
            );
          } catch (err) {
            alert("Invalid JSON file.");
          }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      const validationIssues = ValidationEngine.validateGraph(
        nodes,
        edges,
        metadata,
        selectedFloorId || undefined,
      );

      const renderEdgePath = (src: GraphNodeData, dest: GraphNodeData) => {
        return `M ${src.x} ${src.y} L ${dest.x} ${dest.y}`;
      };

      const inverseScale = 1 / Math.max(0.4, Math.min(transform.scale, 4.0));

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
            <div style={{ position: 'absolute', bottom: '20px', left: '70px', backgroundColor: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 30, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', marginBottom: '4px', lineHeight: 1 }}>{displayMeters} {displayMeters === 1 ? 'Meter' : 'Meters'}</div>
                <div style={{ borderLeft: '2px solid #1e293b', borderRight: '2px solid #1e293b', borderBottom: '2px solid #1e293b', width: `${Math.max(actualWidthPx, 20)}px`, height: '6px' }}></div>
            </div>
        );
      };

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 65px)",
            width: "100vw",
            overflow: "hidden",
            backgroundColor: "#f1f5f9",
            fontFamily: "sans-serif",
            position: "relative",
          }}
        >
          {renderScaleBar()}
          {/* CONTEXT BAR */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              padding: "10px 20px",
              backgroundColor: "white",
              borderBottom: "1px solid #e2e8f0",
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: "bold", color: "#1e293b" }}>Context:</div>
            <select
              value={selectedBuildingId || ""}
              onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
              style={selectStyle}
            >
              <option value="" disabled>
                Select Building
              </option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={selectedFloorId || ""}
              onChange={(e) => setSelectedFloorId(Number(e.target.value))}
              style={selectStyle}
              disabled={!selectedBuildingId || floors.length === 0}
            >
              <option value="" disabled>
                Select Floor
              </option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} (Level {f.level})
                </option>
              ))}
            </select>
            <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Search Node..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={selectStyle}
                onKeyDown={(e) => e.key === "Enter" && handleNodeSearch()}
              />
              <button
                onClick={handleNodeSearch}
                style={{
                  ...selectStyle,
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Find
              </button>
              <button
                onClick={handleExport}
                disabled={!selectedFloorId}
                style={{
                  ...selectStyle,
                  background: selectedFloorId ? "#64748b" : "#cbd5e1",
                  color: "white",
                  border: "none",
                  cursor: selectedFloorId ? "pointer" : "not-allowed",
                }}
                title="Export Graph to JSON"
              >
                Export
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedFloorId}
                style={{
                  ...selectStyle,
                  background: selectedFloorId ? "#64748b" : "#cbd5e1",
                  color: "white",
                  border: "none",
                  cursor: selectedFloorId ? "pointer" : "not-allowed",
                }}
                title="Import Graph from JSON"
              >
                Import
              </button>
              <input
                type="file"
                accept=".json"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleImport}
              />
              <button
                className="btn btn-primary"
                onClick={handleSave}
                style={{ opacity: 1, cursor: "pointer", background: "#10b981", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px" }}
              >
                Save Graph
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* TOOLBAR */}
            <div
              style={{
                width: "130px",
                backgroundColor: "#ffffff",
                borderRight: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "10px 6px",
                boxShadow: "2px 0 5px rgba(0,0,0,0.05)",
                zIndex: 10,
                gap: "4px",
              }}
            >
              <button
                onClick={() => setMode("SELECT")}
                style={btnStyle(mode === "SELECT")}
                title="Select (V)"
              >
                ↖ Select
              </button>
              <button
                onClick={() => setMode("CREATE_DESTINATION")}
                style={btnStyle(mode === "CREATE_DESTINATION")}
                title="Add Destination (+D)"
              >
                + Destination
              </button>
              <button
                onClick={() => setMode("CREATE_CONNECTOR")}
                style={btnStyle(mode === "CREATE_CONNECTOR")}
                title="Add Connector (+C)"
              >
                + Connector
              </button>
              <button
                onClick={() => setMode("CREATE_EDGE")}
                style={btnStyle(mode === "CREATE_EDGE")}
                title="Add Edge (E)"
              >
                ↗ Add Edge
              </button>
              <button
                onClick={() => {
                  setMode("MEASURE");
                  setMeasurePoints([]);
                }}
                style={btnStyle(mode === "MEASURE")}
                title="Measure Distance (M)"
              >
                📏 Measure
              </button>
              <button
                onClick={() => {
                  setMode("CALIBRATE");
                  setMeasurePoints([]);
                }}
                style={btnStyle(mode === "CALIBRATE")}
                title="Calibrate Scale"
              >
                ⚙ Calibrate
              </button>
              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0', width: '100%' }} />
              <button
                onClick={() => {
                    if (!showTelemetry) fetchTelemetry();
                    setShowTelemetry(!showTelemetry);
                }}
                style={btnStyle(showTelemetry)}
                title="Toggle Unmapped Telemetry"
              >
                📡 Telemetry
              </button>
            </div>

            {/* VIEWPORT */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
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
                style={{
                  cursor: isSpacePressed ? "grab" : "crosshair",
                  position: "relative",
                  zIndex: 10,
                  touchAction: "none",
                }}
              >
                <defs>
                  <marker
                    id="arrowHead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="25"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                  </marker>
                  <marker
                    id="arrowHeadSelected"
                    markerWidth="10"
                    markerHeight="7"
                    refX="25"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                  </marker>
                  <pattern
                    id="grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width="40" height="40" fill="none" />
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <g
                  ref={gRef}
                  transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
                >
                  <g transform={`rotate(${metadata?.rotation ?? 0} ${metadata?.originX ?? 512} ${metadata?.originY ?? 512})`}>
                    {(blobMapUrl || encodedFloorUrl || currentFloorUrl) && (
                      <image
                        preserveAspectRatio="none"
                        href={blobMapUrl || encodedFloorUrl || currentFloorUrl}
                        xlinkHref={blobMapUrl || encodedFloorUrl || currentFloorUrl}
                        width={metadata?.svgWidth || 1024}
                        height={metadata?.svgHeight || 1024}
                        opacity={0.85}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                  </g>
                  <rect
                    id="canvas-bg"
                    width="10000"
                    height="10000"
                    x="-5000"
                    y="-5000"
                    fill="url(#grid)"
                  />

                  {/* Edges */}
                  {edges.map((e) => {
                    if (e.isFloorTransition) return null;
                    const src = nodesMap.get(e.sourceId);
                    const dest = nodesMap.get(e.destinationId);
                    if (!src || !dest) return null;
                    return (
                      <g
                        key={e.id}
                        onClick={() => {
                          setSelectedEdgeId(e.id);
                          setSelectedNodeIds([]);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                          <path
                            d={renderEdgePath(src, dest)}
                            stroke={
                              selectedEdgeId === e.id
                                ? "#3b82f6"
                                : e.isEnabled
                                  ? "#64748b"
                                  : "#cbd5e1"
                            }
                            strokeWidth={
                              (selectedEdgeId === e.id ? 2 : 1) * inverseScale
                            }
                            strokeDasharray={
                              !e.isEnabled
                                ? "5,5"
                                : e.isFloorTransition
                                  ? "10,10"
                                  : "0"
                            }
                            fill="none"
                            markerEnd={
                              e.direction !== "BIDIRECTIONAL"
                                ? "url(#arrowHead)"
                                : undefined
                            }
                          />

                          {/* Edge weight label */}
                          {e.distance > 0 && selectedEdgeId === e.id && (
                            <text
                              x={src.x + (dest.x - src.x) / 2}
                              y={src.y + (dest.y - src.y) / 2 - 5 * inverseScale}
                              fill="#3b82f6"
                              fontSize={8 * inverseScale}
                              textAnchor="middle"
                            >
                              {e.distance.toFixed(1)}m
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Nodes */}
                    {nodes.map((n) => (
                      <g
                        key={n.id}
                        transform={`translate(${n.x}, ${n.y})`}
                        onClick={(e) => handleNodeClick(e, n.id)}
                        onPointerDown={(e) => {
                          if (mode === "SELECT") {
                            setDraggedNodeId(n.id);
                            setDragStartNodes([...nodes]);
                            setDragStartEdges([...edges]);
                            if (!selectedNodeIds.includes(n.id)) {
                              setSelectedNodeIds(
                                e.shiftKey ? [...selectedNodeIds, n.id] : [n.id],
                              );
                            }
                          }
                        }}
                        style={{ cursor: mode === "SELECT" ? "grab" : "pointer" }}
                      >
                        <circle
                          r={
                            (selectedNodeIds.includes(n.id) ? 9 : 6) *
                            inverseScale
                          }
                          fill={
                            selectedNodeIds.includes(n.id)
                              ? "#3b82f6"
                              : n.type === "ROOM"
                                ? "#10b981"
                                : n.type === "CORRIDOR_BEND"
                                  ? "#06b6d4"
                                  : n.type === "STAIRCASE" || n.type === "LIFT"
                                    ? "#8b5cf6"
                                    : "#f59e0b"
                          }
                          stroke={
                            selectedNodeIds.includes(n.id) ? "#1d4ed8" : "#ffffff"
                          }
                          strokeWidth={1 * inverseScale}
                        />
                        <text
                          y={17 * inverseScale}
                          fontSize={11 * inverseScale}
                          fontWeight="bold"
                          fill="#334155"
                          textAnchor="middle"
                          pointerEvents="none"
                        >
                          {n.name || n.internalName || n.id}
                        </text>
                      </g>
                    ))}

                  {/* Telemetry Breadcrumbs */}
                  {showTelemetry && telemetryPoints.map((tp, i) => (
                      tp.floorId === selectedFloorId && (
                          <circle
                              key={`tp-${i}`}
                              cx={tp.x}
                              cy={tp.y}
                              r={3 * inverseScale}
                              fill="rgba(239, 68, 68, 0.4)"
                              style={{ pointerEvents: 'none' }}
                          />
                      )
                  ))}

                  {/* Marquee */}
                  {marqueeStart && marqueeEnd && (
                    <rect
                      x={Math.min(marqueeStart.x, marqueeEnd.x)}
                      y={Math.min(marqueeStart.y, marqueeEnd.y)}
                      width={Math.abs(marqueeEnd.x - marqueeStart.x)}
                      height={Math.abs(marqueeEnd.y - marqueeStart.y)}
                      fill="rgba(59, 130, 246, 0.2)"
                      stroke="#3b82f6"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                  )}
                  {/* MEASURE / CALIBRATE INSTRUCTIONS */}
                  {(mode === "MEASURE" || mode === "CALIBRATE") && (
                    <g>
                      {/* Guide Line */}
                      {measurePoints.length > 0 && (
                        <line
                          x1={measurePoints[0].x}
                          y1={measurePoints[0].y}
                          x2={
                            measurePoints.length === 2
                              ? measurePoints[1].x
                              : mousePos.x
                          }
                          y2={
                            measurePoints.length === 2
                              ? measurePoints[1].y
                              : mousePos.y
                          }
                          stroke={mode === "CALIBRATE" ? "#f59e0b" : "#ef4444"}
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      )}
                      {/* Text Box */}
                      <text
                        x={
                          measurePoints.length > 0
                            ? measurePoints[0].x + ((measurePoints.length === 2 ? measurePoints[1].x : mousePos.x) - measurePoints[0].x) / 2
                            : mousePos.x + 20
                        }
                        y={
                          measurePoints.length > 0
                            ? measurePoints[0].y + ((measurePoints.length === 2 ? measurePoints[1].y : mousePos.y) - measurePoints[0].y) / 2 - 10
                            : mousePos.y - 10
                        }
                        fill={mode === "CALIBRATE" ? "#f59e0b" : "#ef4444"}
                        fontSize={measurePoints.length === 0 ? "18" : "14"}
                        fontWeight="bold"
                        textAnchor={measurePoints.length === 0 ? "start" : "middle"}
                        style={{ pointerEvents: "none", textShadow: "1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white" }}
                      >
                        {mode === "CALIBRATE"
                          ? measurePoints.length === 0 
                              ? "Step 1: Click first point to calibrate" 
                              : "Step 2: Click second point"
                          : measurePoints.length === 0
                              ? "Click to start measuring"
                              : (
                                  Math.sqrt(
                                    Math.pow((measurePoints.length === 2 ? measurePoints[1].x : mousePos.x) - measurePoints[0].x, 2) +
                                    Math.pow((measurePoints.length === 2 ? measurePoints[1].y : mousePos.y) - measurePoints[0].y, 2)
                                  ) / (metadata?.pixelsPerMeter || 1)
                                ).toFixed(2) + "m"
                        }
                      </text>
                    </g>
                  )}
                </g>
              </svg>
            </div>

            {/* Right Sidebar Toggle Button */}
            <button 
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              style={{
                  position: 'absolute',
                  right: isRightPanelOpen ? '350px' : '0px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 100,
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRight: 'none',
                  padding: '20px 8px',
                  cursor: 'pointer',
                  borderRadius: '8px 0 0 8px',
                  boxShadow: '-2px 0 5px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b'
              }}
              title={isRightPanelOpen ? "Collapse Panel" : "Expand Panel"}
            >
              {isRightPanelOpen ? '▶' : '◀'}
            </button>

            {/* Right Sidebar (Inspectors & Analysis) */}
            <div
              style={{
                width: isRightPanelOpen ? "350px" : "0px",
                backgroundColor: "white",
                borderLeft: isRightPanelOpen ? "1px solid #e2e8f0" : "none",
                display: isRightPanelOpen ? "flex" : "none",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              <Inspectors
                edges={edges}
                selectedNode={
                  nodes.find((n) => n.id === selectedNodeIds[0]) || null
                }
                selectedEdge={
                  edges.find((e) => e.id === selectedEdgeId) || null
                }
                metadata={metadata}
                validationIssues={validationIssues}
                onUpdateNode={(n) =>
                  updateNodesAndRecalculateEdges(
                    nodes.map((node) => (node.id === n.id ? n : node)),
                  )
                }
                onUpdateEdge={(e) => {
                  setEdges(edges.map((edge) => (edge.id === e.id ? e : edge)));
                  setIsDirty(true);
                }}
                onUpdateMetadata={(meta) => {
                  if (metadata && meta.pixelsPerMeter !== metadata.pixelsPerMeter && meta.pixelsPerMeter && meta.pixelsPerMeter > 0) {
                      const updatedEdges = edges.map(edge => {
                          const src = nodes.find(n => n.id === edge.sourceId);
                          const dest = nodes.find(n => n.id === edge.destinationId);
                          if (src && dest) {
                              const pxDist = Math.sqrt(Math.pow(src.x - dest.x, 2) + Math.pow(src.y - dest.y, 2));
                              return { ...edge, distance: pxDist / (meta.pixelsPerMeter || 1) };
                          }
                          return edge;
                      });
                      setEdges(updatedEdges);
                  }
                  setMetadata(meta);
                  setIsDirty(true);
                }}
                onSelectIssue={(i) => {
                  if (i.elementIds.length > 0) setSelectedNodeIds(i.elementIds);
                }}
                onDeleteNode={(id) => {
                  setNodes(nodes.filter((n) => n.id !== id));
                  setEdges(
                    edges.filter(
                      (e) => e.sourceId !== id && e.destinationId !== id,
                    ),
                  );
                  setSelectedNodeIds((prev) =>
                    prev.filter((pid) => pid !== id),
                  );
                  setIsDirty(true);
                }}
                onDeleteEdge={(id) => {
                  setEdges(edges.filter((e) => e.id !== id));
                  setSelectedEdgeId(null);
                  setIsDirty(true);
                }}
                onSplitEdgeWithBend={handleSplitEdgeWithBendNode}
                onCreateCrossFloorEdge={handleCreateCrossFloorEdge}
              />
              <div style={{ padding: "20px" }}>
                <GraphAnalysisPanel nodes={nodes} edges={edges} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    const selectStyle = {
      padding: "5px 10px",
      borderRadius: "4px",
      border: "1px solid #cbd5e1",
      outline: "none",
    };
    const btnStyle = (active: boolean): React.CSSProperties => ({
      width: "100%",
      padding: "8px 6px",
      marginBottom: "0px",
      backgroundColor: active ? "#222222" : "#f8fafc",
      color: active ? "#ffffff" : "#475569",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: 600,
      whiteSpace: "nowrap",
      transition: "all 0.2s",
      boxShadow: active ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
    });
