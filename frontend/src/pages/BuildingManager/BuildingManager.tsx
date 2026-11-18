import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FloorManager } from './FloorManager';

export interface BuildingDTO {
    id: number;
    name: string;
    description: string;
    isEnabled: boolean;
}

export const BuildingManager: React.FC = () => {
    const { token, logout } = useAuth();
    const [buildings, setBuildings] = useState<BuildingDTO[]>([]);
    const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newBuildingName, setNewBuildingName] = useState("");
    const [newBuildingDesc, setNewBuildingDesc] = useState("");

    const fetchBuildings = async () => {
        try {
            const res = await fetch('/api/v1/admin/buildings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                logout();
                return;
            }
            const data = await res.json();
            setBuildings(data);
        } catch (e) {
            console.error("Failed to load buildings", e);
        }
    };

    useEffect(() => {
        fetchBuildings();
    }, [token]);

    const handleCreateBuilding = async () => {
        if (!newBuildingName.trim()) return alert("Name is required");
        
        try {
            const res = await fetch('/api/v1/admin/buildings', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newBuildingName, description: newBuildingDesc, isEnabled: true })
            });
            if (!res.ok) {
                const err = await res.json();
                alert(err.message || "Failed to create building");
                return;
            }
            setIsCreating(false);
            setNewBuildingName("");
            setNewBuildingDesc("");
            fetchBuildings();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteBuilding = async (id: number) => {
        if (!window.confirm("Are you sure? This deletes ALL floors in this building!")) return;
        try {
            const res = await fetch(`/api/v1/admin/buildings/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchBuildings();
            if (selectedBuildingId === id) setSelectedBuildingId(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleEnable = async (b: BuildingDTO) => {
        try {
            const res = await fetch(`/api/v1/admin/buildings/${b.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: !b.isEnabled })
            });
            if (res.ok) fetchBuildings();
        } catch (e) {
            console.error(e);
        }
    };

    const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

    return (
        <div style={{ display: 'flex', height: '100%', backgroundColor: '#f8fafc' }}>
            <div style={{ width: '300px', backgroundColor: '#fff', borderRight: '1px solid #e2e8f0', padding: '20px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>Buildings</h2>
                    <button onClick={() => setIsCreating(true)} style={addBtnStyle}>+ Add</button>
                </div>

                {isCreating && (
                    <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
                        <input 
                            placeholder="Building Name" 
                            value={newBuildingName} 
                            onChange={e => setNewBuildingName(e.target.value)}
                            style={inputStyle}
                        />
                        <input 
                            placeholder="Description" 
                            value={newBuildingDesc} 
                            onChange={e => setNewBuildingDesc(e.target.value)}
                            style={inputStyle}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleCreateBuilding} style={saveBtnStyle}>Save</button>
                            <button onClick={() => setIsCreating(false)} style={cancelBtnStyle}>Cancel</button>
                        </div>
                    </div>
                )}

                {buildings.map(b => (
                    <div 
                        key={b.id} 
                        style={{...cardStyle, borderLeft: selectedBuildingId === b.id ? '4px solid #3b82f6' : '4px solid transparent'}}
                        onClick={() => setSelectedBuildingId(b.id)}
                    >
                        <div style={{ fontWeight: 'bold', color: '#334155' }}>{b.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '10px' }}>{b.description || "No description"}</div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
                            <button onClick={(e) => { e.stopPropagation(); handleToggleEnable(b); }} style={b.isEnabled ? enabledStyle : disabledStyle}>
                                {b.isEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(b.id); }} style={deleteStyle}>Delete</button>
                        </div>
                    </div>
                ))}
            </div>
            
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                {selectedBuilding ? (
                    <FloorManager building={selectedBuilding} token={token} />
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        Select a building from the sidebar to manage its floors.
                    </div>
                )}
            </div>
        </div>
    );
};

const inputStyle = { width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' as any };
const addBtnStyle = { backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const saveBtnStyle = { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', flex: 1 };
const cancelBtnStyle = { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', flex: 1 };
const cardStyle = { backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.2s' };
const enabledStyle = { backgroundColor: '#dcfce7', color: '#166534', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' };
const disabledStyle = { backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' };
const deleteStyle = { backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' };
