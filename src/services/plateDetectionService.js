import { API_CONFIG } from '../../config';

class PlateDetectionService {
  constructor() {
    this.baseUrl = API_CONFIG.LICENSE_PLATE_API_URL;
  }

  async detectPlate(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);

    const queryParams = new URLSearchParams();
    if (options.detectVehiclesFirst !== undefined) {
      queryParams.append('detect_vehicles_first', String(options.detectVehiclesFirst));
    }
    if (options.plateConfidence) {
      queryParams.append('plate_confidence', String(options.plateConfidence));
    }
    if (options.readerConfidence) {
      queryParams.append('reader_confidence', String(options.readerConfidence));
    }
    if (options.platePadding) {
      queryParams.append('plate_padding', String(options.platePadding));
    }

    const queryString = queryParams.toString();
    const url = `${this.baseUrl}/detect${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Detection failed with status: ${response.status}`);
    }

    return response.json();
  }

  async detectPlateFromBase64(base64Data, options = {}) {
    const queryParams = new URLSearchParams();
    if (options.detectVehiclesFirst !== undefined) {
      queryParams.append('detect_vehicles_first', String(options.detectVehiclesFirst));
    }
    if (options.plateConfidence) {
      queryParams.append('plate_confidence', String(options.plateConfidence));
    }
    if (options.readerConfidence) {
      queryParams.append('reader_confidence', String(options.readerConfidence));
    }
    if (options.platePadding) {
      queryParams.append('plate_padding', String(options.platePadding));
    }

    const queryString = queryParams.toString();
    const url = `${this.baseUrl}/detect_base64${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Data })
    });

    if (!response.ok) {
      throw new Error(`Detection failed with status: ${response.status}`);
    }

    return response.json();
  }

  getPlateImageUrl(filename) {
    if (!filename) return null;
    // Handle both cases: where the API returns a relative path starting with / or just a filename
    const formattedFilename = filename.startsWith('/') ? filename : `/plate_image/${filename}`;
    return `${this.baseUrl}${formattedFilename}`;
  }

  async getActiveStreams() {
    const response = await fetch(`${this.baseUrl}/streams`);

    if (!response.ok) {
      throw new Error(`Failed to fetch streams: ${response.status}`);
    }

    return response.json();
  }

  async getHealthInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}

export const plateDetectionService = new PlateDetectionService();
