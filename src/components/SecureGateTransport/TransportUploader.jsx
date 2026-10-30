import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { plateDetectionService } from '../../services/plateDetectionService';

export default function TransportUploader({ themeUtils, onDetectStart, onDetectSuccess, onDetectError }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      onDetectError("Please select a valid image file");
      return;
    }
    
    setSelectedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
    
    // Reset previous results if any
    onDetectStart();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onDetectStart(); // Reset parent state
  };

  const handleDetect = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      const result = await plateDetectionService.detectPlate(selectedImage, {
        detectVehiclesFirst: true
      });
      
      onDetectSuccess(result);
    } catch (error) {
      onDetectError(error.message || "Failed to connect to detection API");
    } finally {
      setIsUploading(false);
    }
  };

  const borderColor = themeUtils.getBorderColor();
  const bgColor = themeUtils.getBgColor('panel');

  return (
    <div className="w-full h-full relative flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* Upload Zone */}
      {!previewUrl ? (
        <div 
          className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg m-4 transition-colors hover:bg-black/5"
          style={{ borderColor: borderColor }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-6">
            <Upload size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Upload Vehicle Image</h3>
          <p className="text-sm opacity-70 mb-6 text-center max-w-sm">
            Drag and drop an image here, or click to select a file from your computer. 
            Supported formats: JPG, PNG.
          </p>
          <button className="px-6 py-2.5 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
            Browse Files
          </button>
        </div>
      ) : (
        <div className="flex-1 relative flex flex-col items-center justify-center bg-black/90 p-4">
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${isUploading ? 'opacity-50' : 'opacity-100'}`}
            />
            
            {/* Loading Overlay */}
            {isUploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10">
                <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                <p className="text-white font-bold tracking-widest uppercase">Analyzing Image...</p>
              </div>
            )}
            
            {/* Action Buttons Overlay */}
            {!isUploading && (
              <div className="absolute bottom-6 flex gap-4 z-20">
                <button 
                  onClick={clearImage}
                  className="px-6 py-2.5 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors border border-white/20 flex items-center gap-2"
                >
                  <X size={18} />
                  Clear
                </button>
                <button 
                  onClick={handleDetect}
                  className="px-8 py-2.5 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
                >
                  <ImageIcon size={18} />
                  Detect Plate
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
