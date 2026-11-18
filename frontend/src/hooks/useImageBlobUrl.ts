import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export function useImageBlobUrl(url?: string) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!url) {
            setBlobUrl(null);
            return;
        }

        const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;

        let isActive = true;
        
        fetch(fullUrl)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch image');
                return res.blob();
            })
            .then(blob => {
                if (!isActive) return;
                const objectUrl = URL.createObjectURL(blob);
                setBlobUrl(objectUrl);
            })
            .catch(err => {
                console.error("Error fetching image for blob URL:", err);
                if (isActive) {
                    setBlobUrl(fullUrl); // Fallback to original URL
                }
            });

        return () => {
            isActive = false;
            setBlobUrl(currentUrl => {
                if (currentUrl && currentUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(currentUrl);
                }
                return null;
            });
        };
    }, [url]);

    return blobUrl;
}
