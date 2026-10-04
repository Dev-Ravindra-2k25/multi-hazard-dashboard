import React from 'react';

export function Loader({ message = 'Loading risk data...' }) {
  return (
    <div className="loader-container">
      <div className="spinner"></div>
      <p className="loader-text">{message}</p>
    </div>
  );
}

export default Loader;
