import React from "react";
import { useState } from "react";

const CreateShipment: React.FC = () => {
  type Box = {
    customer_id: string;
    length: number;
    breadth: number;
    height: number;
    latitude: number;
    longitude: number;
    weight: number;
    fragile: boolean;
  };

  const defaultBox: Box = {
    customer_id: "",
    length: 0,
    breadth: 0,
    height: 0,
    latitude: 0,
    longitude: 0,
    weight: 0,
    fragile: false,
  };

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [container, setContainer] = useState({
    container_x: 0,
    container_z: 0,
    container_y: 0,
    max_weight: 0,
  });
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setUploadMessage('Text copied to clipboard');
    } catch (err) {
      setError(`Failed to copy text: ${err}`);
    } finally {
      setTimeout(() => setUploadMessage(null), 3000);
      return true;
    }
  };

  const handleBoxChange = (idx: number, field: keyof Box, value: any) => {
    const updated = boxes.map((box, i) =>
      i === idx ? { ...box, [field]: value } : box
    );
    setBoxes(updated);
  };

  const addBox = () => {
    setBoxes([...boxes, { ...defaultBox }]);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);

        // Validate and set container data
        if (jsonData.container) {
          const { container_x, container_y, container_z, max_weight } = jsonData.container;
          if (container_x && container_y && container_z && max_weight) {
            setContainer({
              container_x: Number(container_x),
              container_y: Number(container_y),
              container_z: Number(container_z),
              max_weight: Number(max_weight),
            });
          }
        }

        // Validate and set boxes data
        if (jsonData.boxes && Array.isArray(jsonData.boxes)) {
          const validatedBoxes = jsonData.boxes.map((box: any) => ({
            customer_id: box.customer_id || "",
            length: Number(box.length) || 0,
            breadth: Number(box.breadth) || 0,
            height: Number(box.height) || 0,
            latitude: Number(box.latitude) || 0,
            longitude: Number(box.longitude) || 0,
            weight: Number(box.weight) || 0,
            fragile: Boolean(box.fragile),
          }));
          setBoxes(validatedBoxes);
        }

        setUploadMessage("JSON data uploaded successfully!");
        setError(null);

        // Clear upload message after 3 seconds
        setTimeout(() => setUploadMessage(null), 3000);
      } catch (err) {
        setError("Invalid JSON format. Please check your file.");
        setUploadMessage(null);
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:8000/api/create-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ container, boxes }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Shipment created successfully:", data);

      setShipmentId(data.shipment_id);
      setBoxes([]); // Reset boxes after successful submission
      setContainer({ container_x: 0, container_y: 0, container_z: 0, max_weight: 0 }); // Reset container dimensions
      setError(null); // Clear any previous errors
      setLoading(false); // Reset loading state

    } catch (err: any) {
      console.error("Error creating shipment:", err);
      setError(err.message || "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-dvh w-dvw bg-nord-polarNight-0 p-4">
      <div className="w-[50dvw] gap-4 flex flex-col">
        <fieldset className="flex flex-col p-4 rounded-lg border-2 border-nord-frost-3 bg-nord-polarNight-1 text-nord-snowStorm-0">
          <legend className="text-center px-2 text-xl border-2 rounded-lg bg-nord-polarNight-1 border-nord-frost-3">Container Details</legend>
          <label className="mb-4">
            Width (X):
            <input
              className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
              type="number"
              min={0}
              required
              value={container.container_x}
              onChange={e => setContainer({ ...container, container_x: Number(e.target.value) })}
            />
          </label>
          <label className="mb-4">
            Length (Y):
            <input
              className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
              type="number"
              min={0}
              required
              value={container.container_y}
              onChange={e => setContainer({ ...container, container_y: Number(e.target.value) })}
            />
          </label>
          <label className="mb-4">
            Height (Z):
            <input
              className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
              type="number"
              min={0}
              required
              value={container.container_z}
              onChange={e => setContainer({ ...container, container_z: Number(e.target.value) })}
            />
          </label>
          <label className="mb-4">
            Weight Capacity:
            <input
              className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
              type="number"
              min={0}
              required
              value={container.max_weight}
              onChange={e => setContainer({ ...container, max_weight: Number(e.target.value) })}
            />
          </label>
        </fieldset>

        {boxes.length > 0 && (
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            {boxes.map((box, idx) => (
              <fieldset key={idx} className="flex flex-col p-4 rounded-lg border-2 border-nord-frost-3 bg-nord-polarNight-1 text-nord-snowStorm-0">
                <legend className="text-center px-2 text-xl border-2 rounded-lg bg-nord-polarNight-1 border-nord-frost-3">Box {idx + 1}</legend>
                <label className="mb-4">
                  Customer ID:
                  <input
                    className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
                    type="text"
                    value={box.customer_id}
                    required
                    onChange={e => handleBoxChange(idx, "customer_id", e.target.value)}
                  />
                </label>
                <label className="mb-4">
                  Length:
                  <input
                    className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
                    type="number"
                    value={box.length}
                    min={0}
                    required
                    onChange={e => handleBoxChange(idx, "length", Number(e.target.value))}
                  />
                </label>
                <label className="mb-4">
                  Breadth:
                  <input
                    className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
                    type="number"
                    value={box.breadth}
                    min={0}
                    required
                    onChange={e => handleBoxChange(idx, "breadth", Number(e.target.value))}
                  />
                </label>
                <label className="mb-4">
                  Height:
                  <input
                    className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
                    type="number"
                    value={box.height}
                    min={0}
                    required
                    onChange={e => handleBoxChange(idx, "height", Number(e.target.value))}
                  />
                </label>
                <label className="mb-4">
                  Latitude:
                  <input
                    className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
                    type="number"
                    value={box.latitude}
                    required
                    onChange={e => handleBoxChange(idx, "latitude", Number(e.target.value))}
                  />
                </label>
                <label className="mb-4">
                  Longitude:
                  <input
                    className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
                    type="number"
                    value={box.longitude}
                    required
                    onChange={e => handleBoxChange(idx, "longitude", Number(e.target.value))}
                  />
                </label>
                <label className="mb-4">
                  Weight:
                  <input
                    className="no-spinner bg-nord-polarNight-2 pl-1 pr-0 w-full"
                    type="number"
                    value={box.weight}
                    min={0}
                    required
                    onChange={e => handleBoxChange(idx, "weight", Number(e.target.value))}
                  />
                </label>
                <label className="mb-4">
                  Fragile:
                  <input
                    className="ml-5"
                    type="checkbox"
                    checked={box.fragile}
                    onChange={e => handleBoxChange(idx, "fragile", e.target.checked)}
                  />
                </label>
              </fieldset>
            ))}
          </div>
        )}
        <div className="flex justify-between gap-4">
          <button type="button" className="bg-nord-frost-0 p-2 rounded-lg font-bold text-xl text-nord-polarNight-1 w-full cursor-pointer" onClick={addBox}>Add Box</button>
          <label className="bg-nord-aurora-orange p-2 rounded-lg font-bold text-xl text-nord-polarNight-1 w-full text-center cursor-pointer">
            Upload JSON
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <button type="button" className="bg-nord-aurora-green p-2 rounded-lg font-bold text-xl text-nord-polarNight-1 w-full cursor-pointer" disabled={loading || boxes.length === 0} onClick={handleSubmit}>
            {loading ? "Submitting..." : "Create Shipment"}
          </button>
        </div>
        {uploadMessage && (
          <div className="w-full bg-nord-aurora-green text-nord-polarNight-1 p-2 rounded-lg text-center">
            {uploadMessage}
          </div>
        )}
        {shipmentId && (
          <div className="w-full bg-nord-aurora-yellow text-nord-polarNight-1 p-2 rounded-lg text-center"
            onClick={() => copyToClipboard(shipmentId)}>
            <strong>Shipment ID: {shipmentId}</strong>
          </div>
        )}
        {error && (
          <div className="w-full bg-nord-aurora-red text-nord-polarNight-1 p-2 rounded-lg text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateShipment;