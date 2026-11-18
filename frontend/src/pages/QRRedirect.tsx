import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiService } from '../services/ApiService';

export default function QRRedirect() {
  const { qrId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!qrId) {
      setError('No QR code identifier provided.');
      return;
    }

    const resolveLocation = async () => {
      try {
        const node = await ApiService.validateQR(qrId);
        if (node && node.id) {
          // Successfully resolved, redirect to map with starting location set
          navigate(`/map?currentLocationId=${node.id}`, { replace: true });
        } else {
          setError('Invalid QR code location data.');
        }
      } catch (err) {
        console.error('QR Resolution Error:', err);
        setError('Unknown QR Code or unable to connect to the server.');
      }
    };

    resolveLocation();
  }, [qrId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      {!error ? (
        <>
          <div className="w-12 h-12 rounded-full border-4 border-[#222222] border-t-transparent animate-spin mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Locating you...</h2>
          <p className="text-gray-500">Please wait while we resolve your scanned location.</p>
        </>
      ) : (
        <>
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Location Not Found</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/map?action=select-start')}
            className="bg-[#222222] hover:bg-[#444444] text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-all"
          >
            Select Location Manually
          </button>
        </>
      )}
    </div>
  );
}
