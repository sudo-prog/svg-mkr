import { useState } from 'react';
import { Landing } from './components/Landing';
import { Editor } from './components/Editor';
import './index.css';

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);

  return imageFile ? (
    <Editor file={imageFile} onBack={() => setImageFile(null)} />
  ) : (
    <Landing onImage={setImageFile} />
  );
}
