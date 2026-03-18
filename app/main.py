"""
FastAPI application for CareCompanion Agent
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

# Import from agent module
from .agent import (
    get_db_connection,
    create_user,
    get_medications,
    get_symptom_logs,
    get_appointments,
    parse_discharge_instructions,
    create_medication_schedule,
    get_medication_info,
    log_symptom_check,
    daily_symptom_checkin,
    analyze_symptom_trends,
    generate_visit_summary,
    medical_knowledge_retrieval,
    consult_discharge_instructions,
    create_appointment,
    add_note,
    init_db,
    agent  # Make sure your agent.py exports 'agent'
)
from langchain_core.messages import HumanMessage

# Initialize FastAPI
app = FastAPI(title="CareCompanion API", description="Healthcare Scheduler Agent API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    try:
        # Check if DB env vars are set before trying to connect
        required_db_vars = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_PORT"]
        missing_vars = [var for var in required_db_vars if not os.getenv(var)]
        
        if missing_vars:
            print(f"⚠️ Database environment variables not set: {', '.join(missing_vars)}")
            print("✅ Continuing without database connection - some features will be limited")
        else:
            init_db()
            print("✅ Database initialized")
    except Exception as e:
        print(f"⚠️ Database initialization warning: {e}")
        print("✅ Continuing without database connection - some features will be limited")

# ===============================
# Pydantic Models
# ===============================

class UserCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class UserResponse(BaseModel):
    user_id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime

class SymptomLog(BaseModel):
    user_id: int
    symptom: str
    severity: int
    condition_type: Optional[str] = None
    
    class Config:
        # Allow population by field name
        populate_by_name = True

class MedicationAdd(BaseModel):
    user_id: int
    medication_name: str
    dosage: Optional[str] = None
    schedule: Optional[str] = None

class AppointmentCreate(BaseModel):
    user_id: int
    appointment_time: datetime
    reason: Optional[str] = None

class DischargeParse(BaseModel):
    user_id: int
    discharge_text: str

class SimpleChatRequest(BaseModel):
    message: str

class SimpleChatResponse(BaseModel):
    response: str
    session_id: Optional[str] = None  # Added for compatibility

# ===============================
# API Endpoints
# ===============================

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <html>
        <head>
            <title>CareCompanion API</title>
            <style>
                body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
                .endpoint { background: #f4f4f4; padding: 10px; margin: 10px 0; border-radius: 5px; }
                .status { color: green; }
            </style>
        </head>
        <body>
            <h1>🏥 CareCompanion API</h1>
            <p class="status">✅ API is running</p>
            
            <h2>Available Endpoints:</h2>
            
            <div class="endpoint">
                <strong>GET /health</strong> - Check API health
                <br>
                <a href="/health">Test health endpoint</a>
            </div>
            
            <div class="endpoint">
                <strong>POST /chat</strong> - Send a message to the agent
            </div>
            
            <div class="endpoint">
                <strong>POST /users</strong> - Create a new user
            </div>
            
            <div class="endpoint">
                <strong>GET /users/{user_id}/medications</strong> - Get user medications
            </div>
            
            <div class="endpoint">
                <strong>POST /symptoms/log</strong> - Log a symptom
            </div>
            
            <p>For full API documentation, visit <a href="/docs">/docs</a> (Swagger UI)</p>
        </body>
    </html>
    """

@app.get("/health")
async def health_check():
    """Check if API is running and database is connected"""
    try:
        # Try to connect to database only if env vars are set
        db_status = "disconnected"
        if all([os.getenv("DB_HOST"), os.getenv("DB_NAME"), os.getenv("DB_USER"), 
                os.getenv("DB_PASSWORD"), os.getenv("DB_PORT")]):
            try:
                conn = get_db_connection()
                conn.close()
                db_status = "connected"
            except Exception as e:
                db_status = f"error: {str(e)}"
        else:
            db_status = "not configured"
        
        api_key = os.getenv("NEW_GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
        return {
            "status": "healthy", 
            "database": db_status,
            "api_key_configured": bool(api_key)
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.post("/chat", response_model=SimpleChatResponse)
async def simple_chat(request: SimpleChatRequest):
    """Simple chat endpoint for testing"""
    try:
        messages = [HumanMessage(content=request.message)]
        result = await agent.ainvoke({"messages": messages})
        response = result["messages"][-1].content
        return SimpleChatResponse(response=response, session_id="default_session")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# User endpoints
@app.post("/users", response_model=UserResponse)
async def create_new_user(user: UserCreate):
    """Create a new user"""
    try:
        user_id = create_user(user.name, user.email, user.phone)
        return {
            "user_id": user_id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "created_at": datetime.now()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Medication endpoints
@app.get("/users/{user_id}/medications")
async def get_user_medications(user_id: int):
    """Get all medications for a user"""
    try:
        medications = get_medications(user_id)
        return {
            "user_id": user_id,
            "medications": [
                {"name": m[0], "dosage": m[1], "schedule": m[2]}
                for m in medications
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/medications/schedule/{user_id}")
async def get_medication_schedule(user_id: int):
    """Get medication schedule for a user"""
    try:
        schedule = create_medication_schedule.invoke({"user_id": user_id})
        return {"schedule": schedule}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/medications/info/{medication_name}")
async def lookup_medication(medication_name: str):
    """Get information about a specific medication"""
    try:
        info = get_medication_info.invoke({"medication_name": medication_name})
        return {"medication": medication_name, "info": info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Symptom endpoints
@app.post("/symptoms/log")
async def log_symptom_endpoint(symptom: SymptomLog):
    """Log a symptom for a user"""
    try:
        # Use model_dump() instead of dict() for Pydantic v2
        result = log_symptom_check.invoke(symptom.model_dump())
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/symptoms")
async def get_user_symptoms(user_id: int):
    """Get symptom history for a user"""
    try:
        symptoms = get_symptom_logs(user_id)
        return {
            "user_id": user_id,
            "symptoms": [
                {"symptom": s[0], "severity": s[1], "logged_at": s[2]}
                for s in symptoms
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/symptoms/analyze")
async def analyze_symptoms(user_id: int, days: int = 7):
    """Analyze symptom trends for a user"""
    try:
        analysis = analyze_symptom_trends.invoke({"user_id": user_id, "days": days})
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Appointment endpoints
@app.post("/appointments")
async def create_new_appointment(appointment: AppointmentCreate):
    """Create a new appointment"""
    try:
        appointment_id = create_appointment(
            appointment.user_id,
            appointment.appointment_time,
            appointment.reason
        )
        return {"appointment_id": appointment_id, "status": "created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/appointments")
async def get_user_appointments(user_id: int):
    """Get appointments for a user"""
    try:
        appointments = get_appointments(user_id)
        return {
            "user_id": user_id,
            "appointments": [
                {"id": a[0], "time": a[1], "reason": a[2]}
                for a in appointments
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Discharge instructions endpoints
@app.post("/discharge/parse")
async def parse_discharge(data: DischargeParse):
    """Parse discharge instructions"""
    try:
        # Use model_dump() instead of dict() for Pydantic v2
        result = parse_discharge_instructions.invoke(data.model_dump())
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Visit summary endpoint
@app.get("/users/{user_id}/visit-summary")
async def get_visit_summary(user_id: int):
    """Generate a visit summary for a user"""
    try:
        summary = generate_visit_summary.invoke({"user_id": user_id})
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Medical knowledge endpoint
@app.get("/medical-knowledge/{topic}")
async def get_medical_knowledge(topic: str):
    """Get medical information about a topic"""
    try:
        info = medical_knowledge_retrieval(topic)
        return {"topic": topic, "information": info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Daily check-in endpoint
@app.post("/users/{user_id}/daily-checkin")
async def daily_checkin(user_id: int, condition_type: Optional[str] = None):
    """Get daily symptom check-in questions"""
    try:
        checkin = daily_symptom_checkin.invoke({
            "user_id": user_id,
            "condition_type": condition_type
        })
        return {"checkin": checkin}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run with: uvicorn app.main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
