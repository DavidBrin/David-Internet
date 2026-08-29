from fastapi import FastAPI
import uvicorn

app = FastAPI(
    title="Tutorial 1: GET Requests",
    description="Learn how to create GET endpoints with FastAPI",
)


@app.get("/")
def read_root():
    """A simple GET endpoint that returns a welcome message."""
    return {"message": "Hello, World!"} # Notice that we can a dictionary of key-value pairs


@app.get("/hello/{name}")
def say_hello(name: str):
    """A GET endpoint with a path parameter."""
    return {"message": f"Hello, {name}!"} # The dictionary that we return is converted to a JSON response

# TODO: Try changing the default values and create your own function!
@app.get("/items")
def get_items(param_1: int = 0, param_2: int = 10, param_3: str = "plus"):
    """A GET endpoint with query parameters."""
    # Calculator logic based on param_3
    if param_3 == "plus":
        result = param_1 + param_2
    elif param_3 == "minus":
        result = param_1 - param_2
    else:
        result = "Invalid operation. Use 'plus' or 'minus'."
    return {
        "result": result
    }# The return value on these functions can be formatted however we want!


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
