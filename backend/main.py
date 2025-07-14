from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
from datetime import datetime
import uuid
import os
from typing import List

###
from optimize_packaging import Optimizer, Block
optimized_layout = []
###

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "walmart_shipments"
COLLECTION_NAME = "shipments"

try:
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    print("Connected to MongoDB successfully!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")


class Box(BaseModel):
    customer_id: str
    length: int
    breadth: int
    height: int
    latitude: float
    longitude: float
    weight: float
    fragile: bool


class BoxList(BaseModel):
    boxes: List[Box]


class Container(BaseModel):
    container_y: int  # lenght/depth
    container_x: int  # width
    container_z: int  # height
    max_weight: float  # maximum weight the container can hold


class ShipmentRequest(BaseModel):
    container: Container
    boxes: List[Box]


class ShipmentResponse(BaseModel):
    shipment_id: str
    message: str
    total_boxes: int
    created_at: str


class ShipmentLayout(BaseModel):
    container_x: float
    container_y: float
    container_z: float
    layout: List[List[List]]


def generate_shipment_id():
    """Generate a unique shipment ID"""
    return f"SHIP-{uuid.uuid4().hex[:8].upper()}"


def generate_box_id():
    """Generate a unique box ID"""
    return f"BOX-{uuid.uuid4().hex[:8].upper()}"


@app.get("/")
async def root():
    return {"message": "Welcome to the Walmart Shipment API"}


@app.post("/api/create-shipment", response_model=ShipmentResponse)
async def create_shipment(request: ShipmentRequest):
    try:
        shipment_id = generate_shipment_id()

        boxes_with_ids = []
        for box in request.boxes:
            box_data = box.dict()
            box_data["box_id"] = generate_box_id()
            boxes_with_ids.append(box_data)

        shipment_data = {
            "shipment_id": shipment_id,
            "container": request.container.dict(),
            "boxes": boxes_with_ids,
            "total_boxes": len(request.boxes),
            "created_at": datetime.utcnow(),
            "status": "created",
        }

        container_dims = (
            request.container.container_x,
            request.container.container_y,
            request.container.container_z,
        )
        
        Blocks = []
        for box in boxes_with_ids:
            Blocks += [
                Block(
                    box["box_id"],
                    box["length"],
                    box["breadth"],
                    box["height"],
                    box["weight"],
                    box["customer_id"],
                    box["fragile"],
                )
            ]
        
        optimized_layout = Optimizer(Blocks, container_dims)
        shipment_data["layout"] = optimized_layout

        result = collection.insert_one(shipment_data)

        if result.inserted_id:
            print(f"Shipment created successfully with ID: {shipment_id}")
            print(f"MongoDB Object ID: {result.inserted_id}")
            print(f"Box IDs: {[box['box_id'] for box in boxes_with_ids]}")

            return ShipmentResponse(
                shipment_id=shipment_id,
                message="Shipment created successfully",
                total_boxes=len(request.boxes),
                created_at=shipment_data["created_at"].isoformat(),
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to create shipment")

    except Exception as e:
        print(f"Error creating shipment: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/check-shipment/{shipment_id}")
async def get_shipment(shipment_id: str):
    """Get shipment details by shipment ID"""
    try:
        shipment = collection.find_one({"shipment_id": shipment_id}, {"_id": 0})

        if shipment:
            container = shipment.get("container", {})
            return ShipmentLayout(
                container_x=container.get("container_x", 0),
                container_y=container.get("container_y", 0),
                container_z=container.get("container_z", 0),
                layout=shipment.get("layout", []),
            )
        else:
            raise HTTPException(status_code=404, detail="Shipment not found")

    except Exception as e:
        print(f"Error fetching shipment: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/shipments")
async def get_all_shipments():
    """Get all shipments"""
    try:
        shipments = list(collection.find({}, {"_id": 0}).sort("created_at", -1))
        return {"shipments": shipments, "count": len(shipments)}

    except Exception as e:
        print(f"Error fetching shipments: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/box/{box_id}")
async def get_box(box_id: str):
    """Get box details by box ID"""
    try:
        shipment = collection.find_one(
            {"boxes.box_id": box_id}, {"_id": 0, "shipment_id": 1, "boxes.$": 1}
        )

        if shipment and shipment.get("boxes"):
            box = shipment["boxes"][0]
            return {"box": box, "shipment_id": shipment["shipment_id"]}
        else:
            raise HTTPException(status_code=404, detail="Box not found")

    except Exception as e:
        print(f"Error fetching box: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
