import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Home() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Multi-Hazard Early Warning Dashboard</h1>
      <p style={{ marginTop: '1rem', color: '#64748b' }}>
        System scaffolded. Ready for feature slices.
      </p>
    </main>
  );
}

function NotFound() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>404 - Page Not Found</h2>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
