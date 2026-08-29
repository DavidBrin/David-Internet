from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(
    title="Tutorial 2: POST Requests",
    description="Learn how to create POST endpoints with FastAPI",
)


class Item(BaseModel):
    """
    A Pydantic model for request body validation. pydantic is a library we highly recommend using in the future for validating request bodies throughout ECE140A and ECE140B. 
    """
    name: str
    description: str | None = None
    price: float
    quantity: int = 1


class Message(BaseModel):
    """
    A simple message model. This is also a Pydantic model. Pydantic models are a way to validate the request body of a POST request.
    """
    text: str
    author: str | None = None


# In-memory storage for demonstration
items_db: list[Item] = []
messages_db: list[Message] = []


@app.post("/items")
def create_item(item: Item):
    """A POST endpoint that accepts an Item in the request body."""
    items_db.append(item)
    return {"message": "Item created successfully", "item": item}


@app.post("/messages")
def create_message(message: Message):
    """A POST endpoint that accepts a Message in the request body."""
    messages_db.append(message)
    return {"message": "Message received", "data": message}


@app.get("/items")
def list_items():
    """GET endpoint to view all created items."""
    print(items_db)
    return {"items": items_db}


@app.get("/messages")
def list_messages():
    """GET endpoint to view all messages."""
    return {"messages": messages_db}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
