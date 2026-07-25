import { useEffect, useRef } from 'react';

export function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Force play on mount in case browser autoplay policies require programmatic play trigger
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('Autoplay prevented by browser:', err);
      });
    }
  }, []);

  return (
    <div className="bg-video-wrapper" aria-hidden="true">
      <video
        ref={videoRef}
        className="bg-video"
        src="/bg.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="bg-video-overlay" />
    </div>
  );
}
