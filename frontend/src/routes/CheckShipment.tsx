import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ShipmentData {
  'container_x': number;
  'container_y': number;
  'container_z': number;
  layout: number[][][]; // 3D array [x][y][z]
}

const CheckShipment: React.FC = () => {
  const [shipmentId, setShipmentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shipmentData, setShipmentData] = useState<ShipmentData | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`http://localhost:8000/api/check-shipment/${shipmentId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setShipmentData(data);
      setCurrentLayer(0); // Reset to first layer
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const boxIdDict = React.useRef<{ [key: string]: number }>({});
  const nextGenericId = React.useRef(1);

  const genericBoxId = (boxId: string | null): number | null => {
    if (boxId === null) return null;
    if (boxIdDict.current[boxId] !== undefined) {
      return boxIdDict.current[boxId];
    } else {
      boxIdDict.current[boxId] = nextGenericId.current;
      nextGenericId.current += 1;
      return boxIdDict.current[boxId];
    }
  };

  const getBoxColor = (boxId: string | null): string => {
    const colors = [
      'bg-nord-aurora-red',
      'bg-nord-aurora-green',
      'bg-nord-aurora-yellow',
      'bg-nord-aurora-pink',
      'bg-nord-aurora-orange',
      'bg-nord-frost-0',
      'bg-nord-frost-1',
      'bg-nord-frost-2',
      'bg-nord-frost-3',
      'bg-nord-snowStorm-0',
    ];
    const gBoxId: number | null = genericBoxId(boxId);
    if (gBoxId === null) {
      return 'bg-nord-polarNight-2 border-nord-polarNight-3'; // Empty space
    } else {
      // Generate a random opacity between 30 and 100 (interval of 5)
      const opacities = Array.from({ length: 15 }, (_, i) => 30 + i * 5);
      const randomIndex = Math.floor(Math.random() * opacities.length);
      const opacity = opacities[randomIndex];
      return `${colors[gBoxId % colors.length]} opacity-[${opacity}]`;
    }
  };

  const renderGrid = () => {
    if (!shipmentData) return null;

    const { 'container_x': x, 'container_z': z, layout } = shipmentData;

    return (
      <div className="mb-6">
        <div
          className="grid gap-x-0 gap-y-2 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${x}, 1fr)`,
            maxWidth: `${Math.min(x * 40, 800)}px`
          }}
        >
          {Array.from({ length: z }, (_, zIndex) =>
            Array.from({ length: x }, (_, xIndex) => {
              const boxId: string | null = (layout[xIndex]?.[currentLayer]?.[z-1-zIndex]).toString() || null;
              return (
                <div
                  key={`${xIndex}-${zIndex}`}
                  className={`w-8 h-8 border-2 flex items-center justify-center text-m font-semibold text-nord-polarNight-2 ${getBoxColor((boxId))} border-nord-polarNight-3`}
                  title={boxId ? `Box ID: ${boxId}` : 'Empty'}
                >
                  {genericBoxId(boxId) || ''}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const nextLayer = () => {
    if (shipmentData && currentLayer < shipmentData['container_y'] - 1) {
      setCurrentLayer(currentLayer + 1);
    }
  };

  const prevLayer = () => {
    if (currentLayer > 0) {
      setCurrentLayer(currentLayer - 1);
    }
  };

  if (shipmentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-nord-polarNight-0 p-4">
        <div className="bg-nord-polarNight-1 rounded-lg shadow-lg p-6 w-full max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-nord-snowStorm-2">Shipment Layout</h2>
            <button
              onClick={() => {
                setShipmentData(null);
                setShipmentId('');
                setCurrentLayer(0);
              }}
              className="px-4 py-2 bg-nord-frost-2 text-nord-snowStorm-0 rounded-md hover:bg-nord-frost-3 font-bold transition-colors"
            >
              New Search
            </button>
          </div>

          <div className="mb-4 text-center">
            <div className="bg-nord-polarNight-2 p-3 rounded-lg mb-4">
              <p className="text-m text-nord-snowStorm-0 font-medium">
                Container Size: {shipmentData['container_x']} × {shipmentData['container_y']} × {shipmentData['container_z']}
              </p>
            </div>

            <h3 className="text-xl font-semibold mb-2 text-nord-snowStorm-0">
              Layer {currentLayer + 1} of {shipmentData['container_y']}
            </h3>
            <p className="text-m text-nord-frost-2">
              (Depth level {currentLayer + 1})
            </p>
          </div>

          {renderGrid()}

          <div className="flex justify-center items-center gap-4">
            <button
              onClick={prevLayer}
              disabled={currentLayer === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${currentLayer === 0
                ? 'bg-nord-polarNight-2 text-nord-snowStorm-0 cursor-not-allowed'
                : 'bg-nord-frost-2 text-nord-snowStorm-0 hover:bg-nord-frost-3'
                }`}
            >
              <ChevronLeft size={20} />
              Previous Layer
            </button>

            <span className="px-4 py-2 bg-nord-snowStorm-0 rounded-md font-medium text-nord-polarNight-3">
              {currentLayer + 1} / {shipmentData['container_y']}
            </span>

            <button
              onClick={nextLayer}
              disabled={currentLayer === shipmentData['container_y'] - 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${currentLayer === shipmentData['container_y'] - 1
                ? 'bg-nord-polarNight-2 text-nord-snowStorm-0 cursor-not-allowed'
                : 'bg-nord-frost-2 text-nord-snowStorm-0 hover:bg-nord-frost-3'
                }`}
            >
              Next Layer
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-nord-frost-2">
              Different colors represent different box IDs. Empty spaces are shown in gray.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-nord-polarNight-0 p-4">
      <div className="bg-nord-polarNight-1 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-nord-snowStorm-0">Check Shipment Layout</h2>

        {error && (
          <div className="mb-2 p-3 bg-nord-aurora-red border-red-200 border-2 rounded-md">
            <p className="text-nord-snowStorm-0 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="shipmentId" className="block text-sm font-medium text-nord-snowStorm-0 mb-2">
              <input
                type="text"
                id="shipmentId"
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-nord-snowStorm-0 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-nord-frost-2 focus:border-nord-frost-3 transition-colors"
                placeholder="Enter shipment ID..."
                onKeyUp={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit(e);
                  }
                }}
              />
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-nord-frost-1 text-nord-polarNight-2 font-semibold py-3 px-4 rounded-md hover:bg-nord-frost-2 focus:outline-none focus:ring-1 focus:bg-nord-frost-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Get Shipment Layout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckShipment;