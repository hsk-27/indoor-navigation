package com.indoor.nav.services;

import com.indoor.nav.dtos.NodeResponse;

/**
 * Resolves a physical QR code string to a validated Node location.
 * Implemented by GraphServiceImpl via the getNodeByQrId method.
 *
 * NOTE: This interface is retained for documentation clarity.
 * The QR lookup is handled by GraphService.getNodeByQrId() and
 * exposed by PublicDataController at GET /api/v1/graph/nodes/qr/{qrId}.
 */
public interface QRService {
    NodeResponse resolveLocationByQrId(String qrId);
}
