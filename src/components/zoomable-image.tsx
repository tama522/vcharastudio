"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ZoomableImageProps {
  src: string;
  alt: string;
  label: string;
  width: number;
  height: number;
  sizes: string;
  buttonOnly?: boolean;
  imageHref?: string;
}

export function ZoomableImage({
  src,
  alt,
  label,
  width,
  height,
  sizes,
  buttonOnly = false,
  imageHref,
}: ZoomableImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      {buttonOnly ? (
        <div className="zoomable-image-trigger">
          {imageHref ? (
            <Link
              aria-label={`${label}  open details`}
              className="zoomable-image-link"
              href={imageHref}
            >
              <Image alt={alt} src={src} width={width} height={height} sizes={sizes} unoptimized />
            </Link>
          ) : (
            <Image alt={alt} src={src} width={width} height={height} sizes={sizes} unoptimized />
          )}
          <button
            aria-label={`${label}  view fullscreen`}
            className="zoomable-image-badge zoomable-image-badge-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(true);
            }}
          >
            Zoom
          </button>
        </div>
      ) : (
        <button
          aria-label={`${label}  view fullscreen`}
          className="zoomable-image-trigger"
          type="button"
          onClick={() => setIsOpen(true)}
        >
          <Image alt={alt} src={src} width={width} height={height} sizes={sizes} unoptimized />
          <span className="zoomable-image-badge">Zoom</span>
        </button>
      )}

      {isOpen ? (
        <div
          aria-label={label}
          aria-modal="true"
          className="modal-overlay"
          role="dialog"
          onClick={() => setIsOpen(false)}
        >
          <div className="lightbox-chrome" onClick={(event) => event.stopPropagation()}>
            <div className="lightbox-meta">
              <p className="modal-title">{label}</p>
            </div>
            <button
              aria-label="Close"
              className="btn-icon lightbox-close"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="modal-body modal-body-full" onClick={(event) => event.stopPropagation()}>
            <Image
              alt={alt}
              className="lightbox-image"
              src={src}
              width={width}
              height={height}
              sizes="100vw"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
