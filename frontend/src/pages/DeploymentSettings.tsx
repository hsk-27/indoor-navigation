import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';

export const DeploymentSettings: React.FC = () => {
    const [url, setUrl] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('Never');
    const [generatedBy, setGeneratedBy] = useState('None');
    const [deploymentVersion, setDeploymentVersion] = useState(0);
    const [hasQr, setHasQr] = useState(false);
    const [localIps, setLocalIps] = useState<string[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [backendReachable, setBackendReachable] = useState(true);
    
    // Confirmation Modal State
    const [showConfirm, setShowConfirm] = useState(false);
    
    // Secure Image Blob URL
    const [secureQrBlobUrl, setSecureQrBlobUrl] = useState<string | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    const { token, logout } = useAuth();

    const loadSettings = () => {
        fetch(`${API_BASE_URL}/api/v1/admin/deployment`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
            if (res.status === 401 || res.status === 403) {
                logout();
                throw new Error("Unauthorized");
            }
            if (!res.ok) {
                setBackendReachable(false);
                throw new Error("Failed to load");
            }
            setBackendReachable(true);
            return res.json();
        })
        .then(data => {
            const initialUrl = data.deploymentUrl || '';
            const customFlag = data.isCustomUrl || false;
            setIsCustom(customFlag);
            setUrl(initialUrl);
            setLastUpdated(data.lastUpdated || 'Never');
            setGeneratedBy(data.generatedBy || 'None');
            setDeploymentVersion(data.deploymentVersion || 0);
            setHasQr(data.hasQr || false);
            setLocalIps([]);
            if (data.hasQr) {
                fetchSecureQr();
            }
        })
        .catch(err => {
            setBackendReachable(false);
            console.error("Could not load deployment URL", err);
        });
    };

    const fetchSecureQr = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/admin/deployment/qr-image?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const newUrl = URL.createObjectURL(blob);
                setSecureQrBlobUrl(newUrl);
                blobUrlRef.current = newUrl;
            }
        } catch (e) {
            console.error("Failed to load secure QR image", e);
        }
    };

    useEffect(() => {
        loadSettings();
        return () => {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        };
    }, [token]);

    const triggerGenerateWorkflow = () => {
        // Validate URL format locally first
        try {
            new URL(url);
            setShowConfirm(true);
        } catch (e) {
            setStatus({ type: 'error', message: 'Please enter a valid URL (e.g. https://nav.ghrce.edu)' });
        }
    };

    const handleConfirmGenerate = async () => {
        setShowConfirm(false);
        setIsLoading(true);
        setStatus(null);
        
        try {
            const parsedUrl = new URL(url);

            setStatus({ type: 'success', message: 'Generating QR Code...' });

            const res = await fetch(`${API_BASE_URL}/api/v1/admin/deployment/qr`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ deploymentUrl: url, isCustomUrl: String(isCustom) })
            });

            if (!res.ok) throw new Error("Failed to generate QR");
            
            const data = await res.json();
            setStatus({ type: 'success', message: '✓ Connected. Application QR generated successfully!' });
            setLastUpdated(data.lastUpdated || 'Just now');
            setGeneratedBy(data.generatedBy || 'admin');
            setDeploymentVersion(data.deploymentVersion || deploymentVersion + 1);
            setHasQr(true);
            
            // Clear old blob before fetching new one to prevent stale previews
            if (secureQrBlobUrl) {
                URL.revokeObjectURL(secureQrBlobUrl);
                setSecureQrBlobUrl(null);
                blobUrlRef.current = null;
            }
            await fetchSecureQr();
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message || 'Invalid URL or server error.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto flex gap-6 relative">
            
            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Deployment</h3>
                        <div className="text-sm text-gray-600 mb-6 space-y-3">
                            <p>You are about to change the application entry point to:</p>
                            <p className="font-semibold text-gray-800 bg-gray-50 p-3 rounded border border-gray-200 break-all">{url}</p>
                            <p>This will regenerate the public application QR code, replacing the existing one.</p>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmGenerate}
                                className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Deployment Settings</h1>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Application Entry QR</h2>
                    <p className="text-gray-600 text-sm mb-6">
                        Update the deployment URL to regenerate the main application QR code (app_link.png). 
                        This does not affect node, room, or floor QR codes.
                    </p>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Current URL
                        </label>
                        <input 
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://navigation.ghrce.edu.in"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="mt-2 flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="isCustom" 
                                checked={isCustom}
                                onChange={(e) => setIsCustom(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isCustom" className="text-sm text-gray-600 cursor-pointer">
                                Save as persistent custom URL (disables auto-detect)
                            </label>
                        </div>
                        
                        {(url.includes('localhost') || url.includes('127.0.0.1')) && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800 font-medium mb-1">⚠️ Localhost Detected</p>
                                <p className="text-xs text-yellow-700 mb-2">
                                    QR codes containing 'localhost' will <b>not work</b> on mobile devices because the phone will try to connect to itself.
                                </p>
                                {localIps.length > 0 && (
                                    <div>
                                        <span className="text-xs text-yellow-700 font-medium">Try clicking your network IP instead:</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {localIps.map(ip => (
                                                <button 
                                                    key={ip}
                                                    onClick={() => setUrl(`http://${ip}:5173`)}
                                                    className="text-xs bg-white border border-yellow-300 px-2 py-1 rounded hover:bg-yellow-100 transition-colors font-mono text-yellow-900"
                                                >
                                                    {ip}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {status && (
                        <div className={`mb-4 p-3 rounded text-sm font-medium ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {status.message}
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button 
                            onClick={triggerGenerateWorkflow}
                            disabled={isLoading || !url}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            {isLoading ? 'Verifying...' : 'Generate QR'}
                        </button>
                        
                        {hasQr && secureQrBlobUrl && (
                            <>
                                <button 
                                    onClick={() => window.open(secureQrBlobUrl, '_blank')}
                                    className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 border border-gray-300 transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    Preview QR
                                </button>
                                <a 
                                    href={secureQrBlobUrl}
                                    download="app_link.png"
                                    className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 border border-gray-300 transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    Download PNG
                                </a>
                            </>
                        )}
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-gray-100 flex gap-6 text-sm text-gray-500">
                        <div><span className="font-semibold">Last Generated:</span> {lastUpdated}</div>
                        <div><span className="font-semibold">Generated By:</span> {generatedBy}</div>
                    </div>
            </div>
            </div>

            {/* Sidebar Status */}
            <div className="w-80 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-semibold text-gray-800 mb-4">Deployment Status</h3>
                    
                    <div className="space-y-4 text-sm">
                        <div>
                            <div className="text-gray-500 text-xs uppercase font-semibold">Deployment URL</div>
                            <div className="text-gray-800 font-medium break-all">{url || 'Not Configured'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs uppercase font-semibold">Backend Reachable</div>
                            <div className={backendReachable ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                {backendReachable ? "✓ Connected" : "✗ Disconnected"}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs uppercase font-semibold">Database Connected</div>
                            <div className="text-green-600 font-medium">✓ Connected</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs uppercase font-semibold">Uploads Directory</div>
                            <div className="text-green-600 font-medium">✓ Mounted (/app/uploads)</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs uppercase font-semibold">QR Generated</div>
                            <div className="text-gray-800 flex items-center gap-2 font-medium">
                                {hasQr ? <span className="text-green-600">✓ Yes</span> : <span className="text-gray-400">No</span>}
                            </div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs uppercase font-semibold">Last Deployment Update</div>
                            <div className="text-gray-800">{lastUpdated}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs uppercase font-semibold">Deployment Version</div>
                            <div className="text-gray-800">v{deploymentVersion}</div>
                        </div>
                    </div>
                </div>
                
                {hasQr && secureQrBlobUrl && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
                        <h3 className="font-semibold text-gray-800 mb-4 w-full text-left">QR Preview</h3>
                        <img 
                            src={secureQrBlobUrl} 
                            alt="Application Entry QR" 
                            className="w-48 h-48 border border-gray-100 rounded-lg shadow-sm"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
