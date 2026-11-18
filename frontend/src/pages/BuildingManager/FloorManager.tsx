import React, { useState, useEffect, useRef } from 'react';
import { BuildingDTO } from './BuildingManager';

export interface FloorDTO {
    id: number;
    name: string;
    level: number;
    description: string;
    sortOrder: number;
    isEnabled: boolean;
    svgMapUrl: string;
}

interface Props {
    building: BuildingDTO;
    token: string | null;
}

export const FloorManager: React.FC<Props> = ({ building, token }) => {
    const [floors, setFloors] = useState<FloorDTO[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    
    const [newFloorName, setNewFloorName] = useState("");
    const [newFloorLevel, setNewFloorLevel] = useState("0");
    const [newFloorDesc, setNewFloorDesc] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFloors = async () => {
        try {
            const res = await fetch(`/api/v1/admin/buildings/${building.id}/floors`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFloors(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchFloors();
    }, [building.id, token]);

    const handleUploadSubmit = async () => {
        if (!newFloorName.trim()) return alert("Floor name is required");
        if (!fileInputRef.current?.files?.length) return alert("Please select an SVG file");

        const formData = new FormData();
        formData.append("name", newFloorName);
        formData.append("level", newFloorLevel);
        formData.append("description", newFloorDesc);
        formData.append("svgFile", fileInputRef.current.files[0]);

        try {
            const res = await fetch(`/api/v1/admin/buildings/${building.id}/floors`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            if (res.ok) {
                setIsUploading(false);
                setNewFloorName("");
                setNewFloorLevel("0");
                setNewFloorDesc("");
                fetchFloors();
            } else {
                const err = await res.json();
                alert(err.message || "Failed to upload floor");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure? This deletes ALL nodes and edges on this floor!")) return;
        try {
            const res = await fetch(`/api/v1/admin/floors/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchFloors();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDuplicate = async (id: number) => {
        try {
            const res = await fetch(`/api/v1/admin/floors/${id}/duplicate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchFloors();
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleEnable = async (f: FloorDTO) => {
        try {
            const res = await fetch(`/api/v1/admin/floors/${f.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: !f.isEnabled })
            });
            if (res.ok) fetchFloors();
        } catch (e) {
            console.error(e);
        }
    };

    const moveFloor = async (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= floors.length) return;
        
        const newFloors = [...floors];
        const temp = newFloors[index];
        newFloors[index] = newFloors[index + direction];
        newFloors[index + direction] = temp;
        
        // Optimistic UI update
        setFloors(newFloors);

        // Update backend for both swapped floors
        try {
            await fetch(`/api/v1/admin/floors/${newFloors[index].id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sortOrder: index })
            });
            await fetch(`/api/v1/admin/floors/${newFloors[index + direction].id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sortOrder: index + direction })
            });
        } catch(e) {
            console.error("Failed to reorder", e);
            fetchFloors(); // Revert on failure
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>{building.name} Floors</h1>
                    <div style={{ color: '#64748b' }}>{building.description}</div>
                </div>
                <button onClick={() => setIsUploading(!isUploading)} style={addBtnStyle}>
                    {isUploading ? "Cancel Upload" : "+ Add New Floor"}
                </button>
            </div>

            {isUploading && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
                    <h3 style={{ marginTop: 0 }}>Upload New Floor SVG</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                            <label style={labelStyle}>Floor Name (e.g. Ground Floor)</label>
                            <input style={inputStyle} value={newFloorName} onChange={e => setNewFloorName(e.target.value)} />
                        </div>
                        <div>
                            <label style={labelStyle}>Logical Level (e.g. 0, 1, -1)</label>
                            <input style={inputStyle} type="number" value={newFloorLevel} onChange={e => setNewFloorLevel(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={labelStyle}>Description</label>
                        <input style={inputStyle} value={newFloorDesc} onChange={e => setNewFloorDesc(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={labelStyle}>SVG Map File</label>
                        <input type="file" accept=".svg" ref={fileInputRef} style={inputStyle} />
                    </div>
                    <button onClick={handleUploadSubmit} style={saveBtnStyle}>Upload and Initialize</button>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {floors.map((f, i) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', marginRight: '20px' }}>
                            <button onClick={() => moveFloor(i, -1)} disabled={i === 0} style={arrowBtnStyle}>▲</button>
                            <button onClick={() => moveFloor(i, 1)} disabled={i === floors.length - 1} style={arrowBtnStyle}>▼</button>
                        </div>
                        
                        <div style={{ width: '80px', height: '80px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginRight: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {f.svgMapUrl ? <img src={f.svgMapUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={f.name} /> : "No Map"}
                        </div>

                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>{f.name} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>(Level {f.level})</span></h3>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{f.description || "No description"}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => handleToggleEnable(f)} style={f.isEnabled ? enabledStyle : disabledStyle}>
                                {f.isEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button onClick={() => handleDuplicate(f.id)} style={actionBtnStyle}>Duplicate</button>
                            <button onClick={() => handleDelete(f.id)} style={deleteStyle}>Delete</button>
                        </div>
                    </div>
                ))}
                {floors.length === 0 && !isUploading && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px', backgroundColor: 'white', borderRadius: '8px' }}>
                        No floors added yet. Click "+ Add New Floor" to get started.
                    </div>
                )}
            </div>
        </div>
    );
};

const inputStyle = { width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' as any };
const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '5px' };
const addBtnStyle = { backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const saveBtnStyle = { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' };
const enabledStyle = { backgroundColor: '#dcfce7', color: '#166534', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const disabledStyle = { backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const actionBtnStyle = { backgroundColor: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const deleteStyle = { backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const arrowBtnStyle = { backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', fontSize: '1.2rem' };
