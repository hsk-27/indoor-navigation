import React, { useState } from 'react';

export const CapacitorServerConfig: React.FC<{ onConfigured: () => void }> = () => {
    const [url, setUrl] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [error, setError] = useState('');

    const handleConnect = async () => {
        if (!url) return;
        
        // Ensure proper format
        let finalUrl = url.trim();
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'http://' + finalUrl;
        }

        setIsTesting(true);
        setError('');

        try {
            // Test connection with a short timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${finalUrl}/api/v1/localization/buildings`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                localStorage.setItem('APP_DEPLOYMENT_URL', finalUrl);
                window.location.reload();
            } else {
                setError('Server responded with an error. Check the URL.');
            }
        } catch (err) {
            setError('Could not connect. Ensure your phone is on the same Wi-Fi and the IP/Port are correct.');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-blue-50 flex flex-col items-center justify-center z-[9999] p-6 text-center">
            <h2 className="text-3xl font-extrabold text-slate-800 mb-4">Connect to Server</h2>
            <p className="text-slate-600 mb-6">Enter your computer's local IP address and port 8080 (e.g., http://192.168.x.x:8080).</p>
            
            <input 
                type="text" 
                value={url} 
                onChange={e => setUrl(e.target.value)}
                className="w-full max-w-xs p-3 border rounded-xl mb-4 border-gray-300"
                placeholder="http://192.168.x.x:8080"
            />
            
            {error && (
                <div className="text-red-500 text-sm font-bold mb-4 max-w-xs">
                    {error}
                </div>
            )}

            <button 
                onClick={handleConnect}
                disabled={!url || isTesting}
                className={`w-full max-w-xs text-white font-bold py-3 px-6 rounded-xl transition-colors ${!url || isTesting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {isTesting ? 'Connecting...' : 'Connect'}
            </button>
            
            <div className="mt-8 text-sm text-slate-500 max-w-xs">
                <strong>Tip:</strong> You can find the correct URL in the Web Dashboard under "Deployment Settings".
            </div>
        </div>
    );
};
