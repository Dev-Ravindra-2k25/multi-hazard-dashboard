import React, { useEffect, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

export function HazardBreakdown({ score }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const floodIdx = score?.floodIdx ?? 0;
  const seismicIdx = score?.seismicIdx ?? 0;
  const cyclonIdx = score?.cyclonIdx ?? 0;

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Flood Index', 'Seismic Index', 'Cyclone Index'],
        datasets: [
          {
            label: 'Hazard Risk (0-100)',
            data: [floodIdx, seismicIdx, cyclonIdx],
            backgroundColor: [
              'rgba(59, 130, 246, 0.7)',  // Blue for flood
              'rgba(234, 88, 12, 0.7)',   // Orange/Brown for seismic
              'rgba(168, 85, 247, 0.7)'   // Purple for cyclone
            ],
            borderColor: [
              '#2563eb',
              '#ea580c',
              '#9333ea'
            ],
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => ` Index: ${context.parsed.y} / 100`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20
            },
            title: {
              display: true,
              text: 'Risk Index (0-100)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [floodIdx, seismicIdx, cyclonIdx]);

  return (
    <div className="hazard-breakdown-card">
      <h3 className="card-title">Hazard Layer Breakdown</h3>
      <p className="card-subtitle">Individual 0–100 risk indices computed per hazard type</p>

      <div className="chart-container">
        <canvas ref={canvasRef} />
      </div>

      <div className="indices-grid">
        <div className="index-stat flood">
          <span className="index-label">🌊 Flood Index</span>
          <span className="index-val">{floodIdx}</span>
        </div>
        <div className="index-stat seismic">
          <span className="index-label">🌋 Seismic Index</span>
          <span className="index-val">{seismicIdx}</span>
        </div>
        <div className="index-stat cyclone">
          <span className="index-label">🌀 Cyclone Index</span>
          <span className="index-val">{cyclonIdx}</span>
        </div>
      </div>
    </div>
  );
}

export default HazardBreakdown;
