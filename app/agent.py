"""
CareCompanion Agent - Healthcare Scheduler and Post-Discharge Support
"""

import os
import json
import psycopg2
import google.generativeai as genai
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from dateutil import parser as date_parser
from google.oauth2 import service_account
from googleapiclient.discovery import build
from zoneinfo import ZoneInfo
from pypdf import PdfReader
from langchain_core.tools import tool

# LangChain/LangGraph imports for agent creation
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage

# ===============================
# CONFIGURATION & INITIALIZATION
# ===============================

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY") or os.getenv("NEW_GOOGLE_API_KEY"))
_genai_model = genai.GenerativeModel("gemini-2.5-flash")

# ===============================
# DATABASE CONNECTION
# ===============================

def get_db_connection():
    """Create a connection to Neon PostgreSQL"""
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        port=os.environ["DB_PORT"],
        sslmode="require",
        connect_timeout=10
    )

def get_connection():
    """Alias for get_db_connection"""
    return get_db_connection()

# ===============================
# REFERENCE DATABASES
# ===============================

MEDICATIONS_DB = {
    "acetaminophen": {
        "purpose": "Relieves mild to moderate pain and reduces fever",
        "common_side_effects": "Generally well-tolerated; rare side effects include nausea",
        "warnings": "Do not exceed 3000mg per day. Do not take with alcohol.",
        "food_instructions": "Can be taken with or without food"
    },
    "ibuprofen": {
        "purpose": "Reduces pain, inflammation, and fever",
        "common_side_effects": "Stomach upset, nausea, dizziness",
        "warnings": "Take with food to prevent stomach upset.",
        "food_instructions": "Take with food or milk"
    },
    "metoprolol": {
        "purpose": "Lowers blood pressure and heart rate",
        "common_side_effects": "Tiredness, dizziness, slow heartbeat",
        "warnings": "Do not stop taking suddenly.",
        "food_instructions": "Take with food"
    },
}

WARNING_SIGNS_DB = {
    "cardiac_surgery": {
        "emergency_signs": [
            "chest pain that is severe or getting worse",
            "difficulty breathing or shortness of breath at rest",
            "sudden weakness on one side of body"
        ],
        "urgent_signs": [
            "incision is red, swollen, or draining pus",
            "fever above 100.4°F",
            "leg swelling that is new or getting worse"
        ],
        "expected_symptoms": [
            "mild soreness around incision",
            "tiredness and fatigue for several weeks"
        ]
    },
}

MEDICATIONS_LOG_DB = {
    "common_medications": {
        "metoprolol": {
            "generic_name": "Metoprolol",
            "brand_names": ["Lopressor", "Toprol-XL"],
            "drug_class": "Beta-blocker",
            "common_uses": ["high blood pressure", "heart failure"],
            "typical_dosages": ["25mg", "50mg", "100mg"],
            "common_side_effects": ["tiredness", "dizziness"],
            "serious_warnings": ["Do not stop suddenly"],
            "food_interactions": "Can be taken with or without food",
            "timing_notes": "Take at same time each day"
        },
    }
}

REMINDERS_DB = {
    "reminder_types": {
        "medication": {
            "priority": "high",
            "default_advance_time": "15 minutes",
            "allow_snooze": True
        },
        "appointment": {
            "priority": "high",
            "reminder_schedule": ["1 day before", "2 hours before"]
        }
    }
}

# ===============================
# DATABASE HELPER FUNCTIONS
# ===============================

def create_user(name: str, email: str = None, phone: str = None) -> int:
    """Add a new user to the users table."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (name, email, phone) VALUES (%s, %s, %s) RETURNING user_id;",
        (name, email, phone)
    )
    user_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return user_id

def add_medication(user_id: int, medication_name: str, dosage: str = None, schedule: str = None) -> int:
    """Add a medication record for a user"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO medication_logs (user_id, medication_name, dosage, schedule)
           VALUES (%s, %s, %s, %s) RETURNING medication_id;""",
        (user_id, medication_name, dosage, schedule)
    )
    medication_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return medication_id

def get_medications(user_id: int):
    """Get medications for a user"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT medication_name, dosage, schedule
        FROM medication_logs
        WHERE user_id = %s
        ORDER BY created_at DESC;
    """, (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

def add_discharge_instruction(user_id: int, instruction: str) -> int:
    """Add discharge instructions for a user"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO discharge_instructions (user_id, instruction) VALUES (%s, %s) RETURNING instruction_id;",
        (user_id, instruction)
    )
    instruction_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return instruction_id

def create_appointment(user_id: int, appointment_time, reason: str = None) -> int:
    """Schedule an appointment for a patient"""
    conn = get_connection()
    cur = conn.cursor()
    if hasattr(appointment_time, 'tzinfo') and appointment_time.tzinfo is not None:
        appointment_time = appointment_time.replace(tzinfo=None)
    cur.execute("""
        INSERT INTO appointments (user_id, appointment_time, reason)
        VALUES (%s, %s, %s) RETURNING id;
    """, (user_id, appointment_time, reason))
    appointment_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return appointment_id

def get_appointments(user_id: int):
    """Get appointments for a user"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, appointment_time, reason
        FROM appointments
        WHERE user_id = %s
        ORDER BY appointment_time;
    """, (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

def add_reminder(user_id: int, reminder_type: str, message: str, remind_at):
    """Add a reminder for a user"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO reminders (user_id, reminder_type, message, remind_at) VALUES (%s, %s, %s, %s) RETURNING reminder_id;",
        (user_id, reminder_type, message, remind_at)
    )
    reminder_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return reminder_id

def get_symptom_logs(user_id: int):
    """Get symptom history for a user"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT symptom, severity, logged_at
        FROM symptom_logs
        WHERE user_id = %s
        ORDER BY logged_at DESC;
    """, (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

def log_symptom(user_id: int, symptom: str, severity: int) -> int:
    """Add a symptom log to the database"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO symptom_logs (user_id, symptom, severity)
        VALUES (%s, %s, %s) RETURNING symptom_id;
    """, (user_id, symptom, severity))
    symptom_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return symptom_id

def add_note(user_id: int, content: str) -> int:
    """Add a note for a user"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO notes (user_id, content) VALUES (%s, %s) RETURNING note_id;",
        (user_id, content)
    )
    note_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return note_id

# ===============================
# GOOGLE CALENDAR INTEGRATION
# ===============================

def authenticate_google_calendar():
    """Authenticate with Google Calendar using service account"""
    SCOPES = ["https://www.googleapis.com/auth/calendar"]
    credentials = service_account.Credentials.from_service_account_file(
        "service_account.json",
        scopes=SCOPES
    )
    return build("calendar", "v3", credentials=credentials)

def sync_appointment_to_google_calendar(appointment_time, summary, description=None, duration_minutes=30):
    """Sync an appointment to Google Calendar"""
    service = authenticate_google_calendar()
    CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID")
    TIMEZONE = "America/New_York"
    
    if appointment_time.tzinfo is None:
        appointment_time = appointment_time.replace(tzinfo=ZoneInfo(TIMEZONE))
    
    start_time = appointment_time.isoformat()
    end_time = (appointment_time + timedelta(minutes=duration_minutes)).isoformat()
    
    event = {
        "summary": summary,
        "description": description or "",
        "start": {"dateTime": start_time, "timeZone": TIMEZONE},
        "end": {"dateTime": end_time, "timeZone": TIMEZONE},
    }
    
    created_event = service.events().insert(calendarId=CALENDAR_ID, body=event).execute()
    return created_event.get("htmlLink")

# ===============================
# HELPER FUNCTIONS
# ===============================

def assess_symptom_severity(symptom: str, severity: int, condition_data: dict) -> dict:
    """Helper function to assess symptom severity"""
    symptom_lower = symptom.lower()
    
    emergency_signs = condition_data.get("emergency_signs", [])
    for sign in emergency_signs:
        if any(word in symptom_lower for word in sign.lower().split()):
            if severity >= 7:
                return {"level": "emergency", "reason": f"This matches: {sign}"}
    
    urgent_signs = condition_data.get("urgent_signs", [])
    for sign in urgent_signs:
        if any(word in symptom_lower for word in sign.lower().split()):
            if severity >= 5:
                return {"level": "urgent", "reason": f"This could indicate: {sign}"}
    
    if severity >= 8:
        return {"level": "urgent", "reason": f"Severe symptom (severity {severity}/10)"}
    if severity >= 5:
        return {"level": "monitor", "reason": f"Moderate symptom (severity {severity}/10)"}
    
    return {"level": "normal", "reason": "Mild symptom within expected range."}

# ===============================
# TOOL 1: DISCHARGE PARSER
# ===============================

@tool
def parse_discharge_instructions(user_id: int, discharge_text: str) -> str:
    """
    Parse discharge instructions and extract:
    - Medications
    - Appointments
    - Care instructions
    """
    prompt = f"""
You are a medical discharge parser.
Extract structured information from the discharge instructions below.
Return ONLY valid JSON in this format (no markdown fences, no extra text):

{{
    "medications": [
        {{
            "name": "string",
            "dosage": "string",
            "schedule": "string"
        }}
    ],
    "appointments": [
        {{
            "datetime": "string or null",
            "reason": "string"
        }}
    ],
    "care_instructions": [
        "string"
    ]
}}

Discharge Instructions:
{discharge_text}
"""
    try:
        response = _genai_model.generate_content(prompt)
        raw_output = response.text.strip()
        if raw_output.startswith("```"):
            raw_output = raw_output.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw_output)
    except Exception as e:
        return f"⚠️ Parsing failed: {str(e)}"
    
    # Store Medications
    for med in parsed.get("medications", []):
        add_medication(
            user_id=user_id,
            medication_name=med.get("name"),
            dosage=med.get("dosage"),
            schedule=med.get("schedule"),
        )
    
    # Store Appointments
    for appt in parsed.get("appointments", []):
        dt_string = appt.get("datetime")
        reason = appt.get("reason")
        if dt_string:
            try:
                appointment_time = date_parser.parse(dt_string)
                create_appointment(user_id=user_id, appointment_time=appointment_time, reason=reason)
            except Exception:
                pass
    
    # Store Care Instructions
    for instruction in parsed.get("care_instructions", []):
        add_discharge_instruction(user_id, instruction)
    
    return (
        f"✅ Discharge instructions processed successfully.\n"
        f"- Medications added: {len(parsed.get('medications', []))}\n"
        f"- Appointments scheduled: {len(parsed.get('appointments', []))}\n"
        f"- Care instructions saved: {len(parsed.get('care_instructions', []))}"
    )

# ===============================
# TOOL 2: MEDICATION SCHEDULE
# ===============================

@tool
def create_medication_schedule(user_id: int) -> str:
    """
    Create a daily medication reminder schedule for a patient.
    """
    medications = get_medications(user_id)
    if not medications:
        return "No medications found for this patient. Please add medications first."
    
    all_reminders = []
    schedule_output = ["📋 YOUR DAILY MEDICATION SCHEDULE", "=" * 40, ""]
    
    for med in medications:
        med_name = med[0].lower() if med[0] else ""
        dosage = med[1] if len(med) > 1 and med[1] else ""
        frequency = med[2] if len(med) > 2 and med[2] else "once daily"
        
        if not med_name:
            continue
        
        med_info = MEDICATIONS_LOG_DB["common_medications"].get(med_name, {})
        food_instructions = med_info.get("food_interactions", "No specific instructions")
        timing_notes = med_info.get("timing_notes", "")
        
        freq_lower = frequency.lower() if frequency else "once daily"
        if "once" in freq_lower or "daily" in freq_lower:
            times = ["08:00"]
        elif "twice" in freq_lower:
            times = ["08:00", "20:00"]
        elif "three" in freq_lower:
            times = ["08:00", "14:00", "20:00"]
        elif "bedtime" in freq_lower:
            times = ["22:00"]
        else:
            times = ["08:00"]
        
        schedule_output.append(f"💊 {med_name.upper()} {dosage}")
        schedule_output.append(f"   Frequency: {frequency}")
        
        display_times = []
        for t in times:
            hour, minute = t.split(':')
            hour_int = int(hour)
            if hour_int < 12:
                display_times.append(f"{hour_int}:{minute} AM")
            elif hour_int == 12:
                display_times.append(f"12:{minute} PM")
            else:
                display_times.append(f"{hour_int-12}:{minute} PM")
        
        schedule_output.append(f"   Times: {', '.join(display_times) if times else 'As needed'}")
        schedule_output.append(f"   📝 {food_instructions}")
        if timing_notes:
            schedule_output.append(f"   ⏰ {timing_notes}")
        schedule_output.append("")
        
        for time_str in times:
            try:
                hour, minute = map(int, time_str.split(':'))
                now = datetime.now()
                reminder_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if reminder_time < now:
                    reminder_time = reminder_time + timedelta(days=1)
                
                add_reminder(
                    user_id=user_id,
                    reminder_type="medication",
                    message=f"Take {dosage} of {med_name}. {food_instructions}",
                    remind_at=reminder_time
                )
                all_reminders.append({"med": med_name, "time": time_str})
            except Exception as e:
                schedule_output.append(f"   ⚠️ Could not create reminder: {str(e)}")
    
    schedule_output.append("=" * 40)
    schedule_output.append(f"✅ Created {len(all_reminders)} reminders")
    schedule_output.append("⚠️ Set alarms on your phone as backup!")
    
    return "\n".join(schedule_output)

@tool
def get_medication_info(medication_name: str) -> str:
    """
    Look up information about a specific medication.
    """
    med_name = medication_name.lower().strip()
    med_info = MEDICATIONS_LOG_DB["common_medications"].get(med_name)
    
    if not med_info:
        return f"No information found for '{medication_name}'."
    
    output = [
        f"💊 {med_info.get('generic_name', medication_name).upper()}",
        f"Brand names: {', '.join(med_info.get('brand_names', ['N/A']))}",
        f"Drug class: {med_info.get('drug_class', 'N/A')}",
        "",
        f"📋 Common uses: {', '.join(med_info.get('common_uses', ['N/A']))}",
        f"💊 Typical dosages: {', '.join(med_info.get('typical_dosages', ['N/A']))}",
        "",
        f"⚠️ Side effects: {', '.join(med_info.get('common_side_effects', ['N/A']))}",
        "",
        "🚨 WARNINGS:",
    ]
    
    for warning in med_info.get("serious_warnings", ["None listed"]):
        output.append(f"   • {warning}")
    
    output.append("")
    output.append(f"🍽️ Food: {med_info.get('food_interactions', 'No specific instructions')}")
    output.append(f"⏰ Timing: {med_info.get('timing_notes', 'Follow prescription')}")
    
    return "\n".join(output)

# ===============================
# TOOL 3: SYMPTOM CHECKER
# ===============================

@tool
def log_symptom_check(user_id: int, symptom: str, severity: int, condition_type: Optional[str] = None) -> str:
    """
    Log a symptom for a patient and check if it requires medical attention.
    """
    try:
        symptom_id = log_symptom(user_id, symptom, severity)
    except Exception as e:
        return f"❌ Error logging symptom: {str(e)}"
    
    recent_symptoms = get_symptom_logs(user_id)
    
    response = [
        f"✅ Symptom logged: '{symptom}' (Severity: {severity}/10)",
        f"   Symptom ID: {symptom_id}",
        ""
    ]
    
    if condition_type and condition_type.lower() in WARNING_SIGNS_DB:
        condition_data = WARNING_SIGNS_DB[condition_type.lower()]
        warning_assessment = assess_symptom_severity(symptom.lower(), severity, condition_data)
        
        if warning_assessment["level"] == "emergency":
            response.extend([
                "🚨 **EMERGENCY WARNING** 🚨",
                "⚠️ Your symptom requires IMMEDIATE medical attention:",
                f"   • {warning_assessment['reason']}",
                "",
                "**IMMEDIATE ACTIONS:**",
                "1. Call 911 or go to the nearest emergency room NOW",
                "2. Do not wait - this is urgent",
                ""
            ])
        elif warning_assessment["level"] == "urgent":
            response.extend([
                "⚠️ **URGENT CARE NEEDED** ⚠️",
                "You should contact your doctor TODAY:",
                f"   • {warning_assessment['reason']}",
                ""
            ])
    
    response.extend([
        "🏠 **Self-Care Reminders:**",
        "• Take medications as prescribed",
        "• Stay hydrated (unless fluid restricted)",
        "• Get adequate rest",
        "• Follow your discharge instructions",
        "",
        "📞 **Emergency:** Call 911 for severe symptoms",
        "📞 **Doctor's Office:** Call during business hours for non-emergency concerns"
    ])
    
    return "\n".join(response)

@tool
def daily_symptom_checkin(user_id: int, condition_type: Optional[str] = None) -> str:
    """
    Perform a daily symptom check-in for a patient.
    """
    today = datetime.now().date()
    recent_symptoms = get_symptom_logs(user_id)
    
    response = [
        "🌅 **DAILY SYMPTOM CHECK-IN**",
        "=" * 40,
        "",
    ]
    
    if recent_symptoms:
        latest_time = recent_symptoms[0][2]
        if hasattr(latest_time, 'date') and latest_time.date() == today:
            response.extend([
                "📝 You've already completed a check-in today.",
                "Here's your most recent symptom log:",
                ""
            ])
            for symptom, severity, log_time in recent_symptoms[:3]:
                time_str = log_time.strftime("%I:%M %p") if hasattr(log_time, 'strftime') else str(log_time)
                response.append(f"   • {symptom} (Severity: {severity}/10) - {time_str}")
            response.append("")
    
    response.extend([
        "**Today's Check-In Questions:**",
        "1. How is your pain level today? (1-10)",
        "2. Any new or worsening symptoms?",
        "3. Have you taken all medications as prescribed?",
        "4. How is your energy level?",
        "",
        "💡 **To log a symptom, use: 'Log symptom: [symptom], severity: [1-10]'**",
    ])
    
    return "\n".join(response)

@tool
def analyze_symptom_trends(user_id: int, days: int = 7) -> str:
    """
    Analyze symptom trends for a patient over a specified time period.
    """
    all_symptoms = get_symptom_logs(user_id)
    
    if not all_symptoms:
        return "No symptom data available. Start logging symptoms to track trends!"
    
    cutoff_date = datetime.now() - timedelta(days=days)
    recent_symptoms = []
    for symptom, severity, log_time in all_symptoms:
        if hasattr(log_time, 'date') and log_time >= cutoff_date:
            recent_symptoms.append((symptom, severity, log_time))
    
    if not recent_symptoms:
        return f"No symptoms logged in the last {days} days."
    
    symptom_data = {}
    for symptom, severity, _ in recent_symptoms:
        if symptom not in symptom_data:
            symptom_data[symptom] = []
        symptom_data[symptom].append(severity)
    
    response = [
        f"📊 **SYMPTOM TREND ANALYSIS (Last {days} Days)**",
        "=" * 50,
        "",
        f"**Total symptoms logged:** {len(recent_symptoms)}",
        f"**Unique symptoms:** {len(symptom_data)}",
        ""
    ]
    
    response.append("**Symptom Breakdown:**")
    for symptom, severities in symptom_data.items():
        avg_severity = sum(severities) / len(severities)
        max_severity = max(severities)
        trend = "improving" if len(severities) > 1 and severities[-1] < severities[0] else \
                "worsening" if len(severities) > 1 and severities[-1] > severities[0] else \
                "stable"
        
        response.extend([
            f"   • {symptom}:",
            f"     - Occurrences: {len(severities)}",
            f"     - Average severity: {avg_severity:.1f}/10",
            f"     - Peak severity: {max_severity}/10",
            f"     - Trend: {trend}"
        ])
    
    return "\n".join(response)

# ===============================
# TOOL 4: VISIT SUMMARY
# ===============================

@tool
def generate_visit_summary(user_id: int) -> str:
    """
    Fetches symptom logs and medications for a user and generates a summary for a doctor's visit.
    """
    symptoms = get_symptom_logs(user_id)
    medications = get_medications(user_id)
    appointments = get_appointments(user_id)
    
    symptom_str = ""
    if symptoms:
        for s in symptoms[:10]:
            if hasattr(s[2], 'strftime'):
                date_str = s[2].strftime("%b %d, %Y")
            else:
                date_str = str(s[2])
            symptom_str += f"- {s[0]} (Severity: {s[1]}/10) on {date_str}\n"
    else:
        symptom_str = "No symptoms logged."
    
    med_str = ""
    if medications:
        for m in medications:
            med_str += f"- {m[0]} {m[1]}: {m[2]}\n"
    else:
        med_str = "No medications listed."
    
    appt_str = ""
    if appointments:
        for a in appointments:
            if hasattr(a[1], 'strftime'):
                appt_time = a[1].strftime("%b %d, %Y at %I:%M %p")
            else:
                appt_time = str(a[1])
            appt_str += f"- {a[2] or 'Follow-up'} on {appt_time}\n"
    else:
        appt_str = "No upcoming appointments."
    
    prompt_text = f"""
    You are a medical assistant helping a patient prepare for a doctor's visit.
    Based on the following data, provide a concise, well-organized summary.
    
    SYMPTOMS (Recent):
    {symptom_str}
    
    CURRENT MEDICATIONS:
    {med_str}
    
    UPCOMING APPOINTMENTS:
    {appt_str}
    
    Please format your response as follows:
    
    📊 **VISIT SUMMARY**
    
    **Overall Health Trend:**
    [Brief assessment - are symptoms improving/worsening/stable?]
    
    **Key Concerns to Discuss:**
    • [List 2-3 main symptoms or issues]
    
    **Medication Adherence:**
    [Brief note on medications]
    
    **Suggested Questions for Your Doctor:**
    1. [Question 1 based on symptoms]
    2. [Question 2 based on medications]
    3. [Question 3 about next steps]
    
    **What to Bring:**
    • This summary
    • Current medication list
    • Insurance card
    • List of questions
    """
    
    try:
        response = _genai_model.generate_content(prompt_text)
        return f"VISIT SUMMARY\n{'-'*40}\n{response.text}"
    except Exception as e:
        return f"❌ Error generating summary: {str(e)}"

# ===============================
# RAG TOOLS
# ===============================

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file"""
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        return f"Error extracting PDF: {str(e)}"

def consult_discharge_instructions(query: str, pdf_text: Optional[str] = None) -> str:
    """
    Searches the uploaded discharge instructions to answer specific questions.
    """
    try:
        if pdf_text:
            text = pdf_text
        else:
            reader = PdfReader("discharge_summary.pdf")
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        
        prompt = f"""
        Based on the following discharge instructions, please answer the patient's question.
        
        DISCHARGE INSTRUCTIONS:
        {text[:3000]}
        
        PATIENT'S QUESTION:
        {query}
        
        Please provide a clear, helpful answer based ONLY on the information in the instructions.
        If the answer cannot be found, politely say so and suggest they contact their doctor.
        """
        
        response = _genai_model.generate_content(prompt)
        return response.text
    except FileNotFoundError:
        return "No discharge PDF found. Please upload your discharge instructions first."
    except Exception as e:
        return f"Error processing PDF: {str(e)}"

def medical_knowledge_retrieval(topic: str) -> str:
    """
    Accesses the internal medical database for drug purposes, side effects, and warning signs.
    """
    topic = topic.lower().strip()
    
    if topic in MEDICATIONS_DB:
        info = MEDICATIONS_DB[topic]
        return f"💊 {topic.title()}:\n" + "\n".join([f"   • {k}: {v}" for k, v in info.items()])
    
    for condition, data in WARNING_SIGNS_DB.items():
        if topic in condition.replace('_', ' '):
            result = [f"⚠️ {condition.replace('_', ' ').title()} Warning Signs:\n"]
            result.append("🚨 EMERGENCY:")
            for sign in data.get('emergency_signs', [])[:3]:
                result.append(f"   • {sign}")
            result.append("\n⚠️ URGENT:")
            for sign in data.get('urgent_signs', [])[:3]:
                result.append(f"   • {sign}")
            return "\n".join(result)
    
    return "No specific medical reference found for that topic. Please consult your healthcare provider."

# ===============================
# AGENT CREATION
# ===============================

def create_agent():
    """Create and return the compiled LangGraph agent"""
    
    # Initialize the model
    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0,
        google_api_key=os.getenv("NEW_GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
    )
    
    # List all your tools
    tools = [
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
    ]
    
    # System prompt
    system_prompt = """You are CareCompanion, a supportive healthcare assistant helping patients manage post-discharge care.
    
    You have access to various tools to help patients:
    - Parse discharge instructions to extract medications, appointments, and care instructions
    - Create medication schedules and reminders
    - Look up medication information
    - Log and track symptoms
    - Analyze symptom trends
    - Generate visit summaries for doctor appointments
    - Retrieve medical knowledge
    - Answer questions from discharge instructions
    - Create appointments
    - Add notes
    
    Always be empathetic, clear, and concise. If a symptom seems severe (7+), advise seeking immediate medical attention.
    """
    
    # Create the agent
    agent = create_react_agent(
        model=model,
        tools=tools,
        prompt=system_prompt
    )
    
    return agent

# ===============================
# DATABASE INITIALIZATION
# ===============================

def init_db():
    """Initialize database tables if they don't exist"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS medication_logs (
            medication_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            medication_name TEXT NOT NULL,
            dosage TEXT,
            schedule TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS symptom_logs (
            symptom_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            symptom TEXT NOT NULL,
            severity INTEGER CHECK (severity >= 1 AND severity <= 10),
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS discharge_instructions (
            instruction_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            instruction TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS appointments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            appointment_time TIMESTAMP NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS reminders (
            reminder_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            reminder_type TEXT NOT NULL,
            message TEXT NOT NULL,
            remind_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS notes (
            note_id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Database tables initialized")

# ===============================
# EXPORT AGENT INSTANCE
# ===============================

# Create the compiled agent instance that main.py imports
agent = create_agent()
