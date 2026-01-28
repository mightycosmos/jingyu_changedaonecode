"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

interface PDFViewerProps {
  pdfUrl: string;
  currentSlide: number;
  totalSlides: number;
  onSlideChange: (slide: number) => void;
  onPdfLoad?: (numPages: number) => void;
}

export default function PDFViewer({
  pdfUrl,
  currentSlide,
  totalSlides,
  onSlideChange,
  onPdfLoad,
}: PDFViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDF.js worker 설정 - 컴포넌트 마운트 시 한 번만 설정
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // public 폴더에 배치한 로컬 worker 파일 사용 (배포 시에도 안정적)
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }, []);

  useEffect(() => {
    if (pdfUrl) {
      setLoading(true);
      setError(null);
      setNumPages(null);
    }
  }, [pdfUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    if (onPdfLoad) {
      onPdfLoad(numPages);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF 로드 실패:", error);
    setError("PDF 파일을 불러올 수 없습니다.");
    setLoading(false);
  };

  const handlePrevSlide = () => {
    if (currentSlide > 1) {
      onSlideChange(currentSlide - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentSlide < totalSlides) {
      onSlideChange(currentSlide + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const displayPages = numPages || totalSlides;

  return (
    <div className="h-full flex flex-col">
      {/* PDF 컨트롤 바 */}
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevSlide}
            disabled={currentSlide === 1}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={currentSlide}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= displayPages) {
                  onSlideChange(page);
                }
              }}
              className="w-12 text-center border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
              min={1}
              max={displayPages}
            />
            <span className="text-sm text-gray-600">/ {displayPages}</span>
          </div>

          <button
            onClick={handleNextSlide}
            disabled={currentSlide >= displayPages}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-100 rounded"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <span className="text-sm text-gray-600 w-12 text-center">{zoom}%</span>
          
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-100 rounded"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          <button className="p-1.5 hover:bg-gray-100 rounded">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF 컨텐츠 영역 */}
      <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-6">
        {!pdfUrl ? (
          <div className="text-center">
            <p className="text-gray-600">PDF URL을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500 break-all max-w-md">PDF URL: {pdfUrl.substring(0, 100)}...</p>
          </div>
        ) : (
          <div
            className="bg-white shadow-lg"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center center',
            }}
          >
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="text-center p-8 min-w-[800px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">PDF 로딩 중...</p>
                </div>
              }
            >
              {numPages && (
                <Page
                  pageNumber={currentSlide}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="border border-gray-300"
                  width={800}
                />
              )}
            </Document>
          </div>
        )}
      </div>

      {/* 썸네일 네비게이션 */}
      <div className="h-32 border-t border-gray-200 bg-white overflow-x-auto">
        <div className="flex gap-2 p-2 h-full">
          {pdfUrl && numPages && Array.from({ length: displayPages }, (_, i) => i + 1).map((slideNum) => (
            <button
              key={slideNum}
              onClick={() => onSlideChange(slideNum)}
              className={`
                flex-shrink-0 w-24 h-full rounded border-2 transition-all overflow-hidden
                ${slideNum === currentSlide 
                  ? "border-primary shadow-lg ring-2 ring-primary/30" 
                  : "border-gray-300 hover:border-gray-400"
                }
              `}
            >
              <Document file={pdfUrl}>
                <Page
                  pageNumber={slideNum}
                  width={96}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

