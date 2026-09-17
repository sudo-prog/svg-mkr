import React, { useState } from 'react';
import { Landing } from './components/Landing';
import { Editor } from './components/Editor';
import './index.css';

/**
 * SVG_MKR v2 — App root.
 * Landing (3D revolving text + upload) → Editor (live canvas + effects).
 */
export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const handleBack = () => setImageSrc(null);

  return imageSrc ? (
    <Editor imageSrc={imageSrc} onBack={handleBack} />
  ) : (
    <Landing onImageSelected={setImageSrc} />
  );
}
