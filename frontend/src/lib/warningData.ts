/** Mirrors WARNING_SIGNS_DB in app/agent.py for the Symptoms UI. */

export type WarningSignsEntry = {
  emergency_signs: string[]
  urgent_signs: string[]
  expected_symptoms: string[]
}

export const WARNING_SIGNS: Record<string, WarningSignsEntry> = {
  cardiac_surgery: {
    emergency_signs: [
      'chest pain that is severe or getting worse',
      'difficulty breathing or shortness of breath at rest',
      'sudden weakness on one side of body',
      'fainting or passing out',
      'coughing up blood',
      'heart racing or pounding that does not stop',
      'temperature above 101.5°F with chills',
    ],
    urgent_signs: [
      'incision is red, swollen, or draining pus',
      'fever above 100.4°F',
      'leg swelling that is new or getting worse',
      'weight gain of more than 3 pounds in one day',
      'nausea or vomiting that prevents taking medications',
      'dizziness that does not go away',
    ],
    expected_symptoms: [
      'mild soreness around incision',
      'tiredness and fatigue for several weeks',
      'trouble sleeping',
      'mild swelling in legs that improves with elevation',
      'decreased appetite',
      'mood changes or feeling emotional',
      'mild constipation from pain medications',
    ],
  },
  joint_replacement: {
    emergency_signs: [
      'sudden severe pain in the surgical leg',
      'chest pain or difficulty breathing',
      'calf pain with swelling and warmth (possible blood clot)',
      'surgical leg turns pale, blue, or cold',
      'fainting or passing out',
    ],
    urgent_signs: [
      'fever above 100.4°F',
      'increased redness or warmth around incision',
      'drainage from incision that is yellow, green, or smells bad',
      'new numbness or tingling in foot',
      'unable to bear weight as instructed',
    ],
    expected_symptoms: [
      'pain and swelling around the joint for several weeks',
      'bruising that may spread down the leg',
      'clicking or popping sounds from new joint',
      'difficulty sleeping due to discomfort',
      'stiffness that improves with physical therapy',
    ],
  },
  abdominal_surgery: {
    emergency_signs: [
      'severe abdominal pain that is getting worse',
      'vomiting blood or material that looks like coffee grounds',
      'blood in stool or black tarry stools',
      'fever above 101.5°F with chills',
      'unable to keep any fluids down for 12 hours',
      'no bowel movement or gas for 3 days',
    ],
    urgent_signs: [
      'incision is opening or separating',
      'redness spreading from incision site',
      'fever above 100.4°F',
      'increasing pain not relieved by prescribed medication',
      'persistent nausea or vomiting',
    ],
    expected_symptoms: [
      'gas pain and bloating for several days',
      'constipation from pain medications',
      'decreased appetite',
      'fatigue',
      'mild bruising around incision',
    ],
  },
  pneumonia: {
    emergency_signs: [
      'severe difficulty breathing',
      'chest pain when breathing',
      'confusion or altered mental status',
      'lips or fingernails turning blue',
      'coughing up large amounts of blood',
    ],
    urgent_signs: [
      'fever that returns after improving',
      'shortness of breath with minimal activity',
      'cough that is getting worse instead of better',
      'unable to keep fluids down',
    ],
    expected_symptoms: [
      'cough that gradually improves over 2-3 weeks',
      'fatigue for several weeks',
      'mild shortness of breath with activity that improves daily',
    ],
  },
  heart_failure: {
    emergency_signs: [
      'severe shortness of breath',
      'chest pain',
      'fainting',
      'coughing up pink or bloody mucus',
    ],
    urgent_signs: [
      'weight gain of more than 2-3 pounds in one day or 5 pounds in one week',
      'increased swelling in legs, ankles, or abdomen',
      'waking up at night short of breath',
      'needing more pillows to sleep comfortably',
      'new or worsening cough',
    ],
    expected_symptoms: [
      'some shortness of breath with activity',
      'mild fatigue',
      'need to urinate more often when taking diuretics',
    ],
  },
  stroke: {
    emergency_signs: [
      'new weakness or numbness on one side',
      'new difficulty speaking or understanding speech',
      'new vision problems',
      'severe headache unlike any before',
      'new difficulty walking or loss of balance',
    ],
    urgent_signs: [
      'dizziness that does not go away',
      'confusion or memory problems getting worse',
      'difficulty swallowing',
    ],
    expected_symptoms: [
      'fatigue, especially in the first few weeks',
      'emotional changes',
      'gradual improvement in strength and coordination with therapy',
    ],
  },
  general_surgery: {
    emergency_signs: [
      'severe pain not relieved by medication',
      'heavy bleeding from incision',
      'fever above 101.5°F',
      'difficulty breathing',
      'chest pain',
    ],
    urgent_signs: [
      'fever above 100.4°F',
      'redness, swelling, or pus from incision',
      'incision opening up',
      'persistent vomiting',
      'unable to urinate',
    ],
    expected_symptoms: [
      'mild to moderate pain around incision',
      'fatigue',
      'bruising near incision',
      'constipation',
    ],
  },
}
