import type {
  BrainIntent,
  MemoryCategory,
  MemoryEntry,
  ProviderId,
  StructuredAiResponse,
} from '../types'

type BrainRequest = {
  input: string
  memory: MemoryEntry[]
  providerId: ProviderId
  routeOverride?: BrainIntent
  variant?: string
}

type ProviderContext = BrainRequest & {
  route: BrainIntent
}

type AiProvider = {
  id: ProviderId
  name: string
  connected: boolean
  isPlaceholder: boolean
  generate: (context: ProviderContext) => StructuredAiResponse
}

const focusKeywords = [
  'focus',
  'distracted',
  'procrastinating',
  'doomscroll',
  'doom scroll',
  'phone',
  'social media',
  'stuck',
  'frustrated',
]

const familyKeywords = [
  'family',
  'kid',
  'kids',
  'child',
  'children',
  'parent',
  'house rule',
  'conflict',
]

const seniorKeywords = [
  'senior',
  'grandma',
  'grandpa',
  'elder',
  'older adult',
  'simple steps',
  'large print',
]

const medicineKeywords = [
  'medicine',
  'medication',
  'meds',
  'pill',
  'tablet',
  'capsule',
  'dose',
  'insulin',
  'metformin',
  'mg',
]

const symptomKeywords = [
  'pain',
  'symptom',
  'headache',
  'nausea',
  'dizzy',
  'fatigue',
  'shaky',
  'weak',
  'fever',
  'cough',
  'swelling',
  'side effect',
  'tingling',
  'numb',
]

const shoppingKeywords = [
  'grocery',
  'shopping',
  'buy',
  'milk',
  'eggs',
  'bread',
  'fruit',
  'vegetable',
  'store',
  'paper towels',
  'bananas',
]

const todoKeywords = [
  'todo',
  'to do',
  'task',
  'reminder',
  'call',
  'schedule',
  'pickup',
  'pick up',
  'finish',
  'send',
  'email',
]

const planningKeywords = [
  'godzilla mode',
  'deep work',
  'plan',
  'planning',
  'schedule',
  'routine',
  'tomorrow',
]

const lowReading = 70
const urgentLowReading = 54
const highReading = 250
const urgentHighReading = 300

const toLower = (value: string) => value.toLowerCase()

const hasAnyKeyword = (value: string, keywords: string[]) => {
  const normalized = toLower(value)
  return keywords.some((keyword) => normalized.includes(keyword))
}

const splitSegments = (value: string) =>
  value
    .split(/\r?\n|[;,]/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

const toBulletLines = (value: string) =>
  splitSegments(value).map((item) => item.replace(/^[-*[\]\d.)\s]+/, '').trim())

const firstWords = (value: string, limit = 10) =>
  value
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, limit)
    .join(' ')

const truncate = (value: string, limit = 180) =>
  value.length > limit ? `${value.slice(0, limit - 3).trim()}...` : value

const unique = (items: string[]) => Array.from(new Set(items))

const sentenceCase = (value: string) =>
  value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value

type GlucoseEvent = {
  value: number
  timelineText: string
}

const glucoseTimingKeywords = [
  'after meal',
  'after meals',
  'after snack',
  'fasting',
  'before bed',
  'at bedtime',
  'waking',
  'upon waking',
  'overnight',
  'this morning',
  'morning',
  'after exercise',
  'post-workout',
  'later',
]

const highCarbKeywords = [
  'rice',
  'bread',
  'potato',
  'sweet potatoes',
  'pasta',
  'cereal',
  'dessert',
  'juice',
  'soda',
]

const lowCarbKeywords = [
  'low-carb',
  'low carb',
  'eggs',
  'sausage',
  'salad',
  'protein',
  'no sugar',
]

const safeReading = (value: number) => value >= 40 && value <= 500

const detectTimingPhrase = (value: string) => {
  const normalized = toLower(value)
  const matches = glucoseTimingKeywords.filter((keyword) => normalized.includes(keyword))
  return matches.length > 0 ? matches[0] : null
}

const summarizeEventContext = (segment: string) => {
  const normalized = toLower(segment)
  const timing = detectTimingPhrase(segment)
  const contextParts: string[] = []

  if (timing) {
    contextParts.push(timing)
  }
  if (highCarbKeywords.some((keyword) => normalized.includes(keyword))) {
    contextParts.push('carbohydrate-containing meal mentioned')
  }
  if (lowCarbKeywords.some((keyword) => normalized.includes(keyword))) {
    contextParts.push('minimal food intake mentioned')
  }
  if (/fasting|empty stomach|skipped meal|didn't eat|did not eat/i.test(normalized)) {
    contextParts.push('fasting-related timing noted')
  }
  if (/after exercise|exercise|workout|walk|gym/i.test(normalized)) {
    contextParts.push('exercise timing noted')
  }
  if (/stress|stressed|anxious|anxiety/i.test(normalized)) {
    contextParts.push('stress mention noted')
  }
  if (/sick|illness|fever|cold|flu|infection/i.test(normalized)) {
    contextParts.push('illness mention noted')
  }
  if (/overnight|before bed|at bedtime|waking|upon waking/i.test(normalized)) {
    contextParts.push('possible overnight elevation context')
  }

  return unique(contextParts)
}

const extractGlucoseEvents = (input: string): GlucoseEvent[] => {
  const segments = toBulletLines(input)
  const events: GlucoseEvent[] = []
  const seen = new Set<string>()

  for (const segment of segments) {
    const normalized = toLower(segment)
    const hasGlucoseWord = /blood sugar|glucose|\bbg\b|reading|dropped to|went down to/i.test(
      normalized,
    )
    const patterns = [
      /(?:blood sugar|glucose|reading)\s*[:=-]?\s*(\d{2,3})\b/gi,
      /\bbg\s*[:=-]?\s*(\d{2,3})\b/gi,
      /\b(\d{2,3})\s*bg\b/gi,
      /\b(\d{2,3})\s*mg\/?d?l\b/gi,
      /\b(?:dropped|drop|went|down)\s*(?:to\s*)?(\d{2,3})\b/gi,
    ]

    for (const pattern of patterns) {
      for (const match of segment.matchAll(pattern)) {
        const value = Number(match[1])
        if (!safeReading(value)) {
          continue
        }

        const contextTags = summarizeEventContext(segment)
        const contextSuffix = contextTags.length > 0 ? ` (${contextTags.join('; ')})` : ''
        const timelineText = `${value} mg/dL${contextSuffix}`
        const key = `${value}-${timelineText}`
        if (!seen.has(key)) {
          seen.add(key)
          events.push({ value, timelineText })
        }
      }
    }

    if (hasGlucoseWord || detectTimingPhrase(segment)) {
      for (const match of segment.matchAll(/\b(\d{2,3})\b/g)) {
        const value = Number(match[1])
        if (!safeReading(value)) {
          continue
        }

        const contextTags = summarizeEventContext(segment)
        const contextSuffix = contextTags.length > 0 ? ` (${contextTags.join('; ')})` : ''
        const timelineText = `${value} mg/dL${contextSuffix}`
        const key = `${value}-${timelineText}`
        if (!seen.has(key)) {
          seen.add(key)
          events.push({ value, timelineText })
        }
      }
    }
  }

  return events
}

const extractBloodSugarReadings = (input: string) =>
  Array.from(new Set(extractGlucoseEvents(input).map((event) => event.value))).sort(
    (left, right) => left - right,
  )

const extractA1cValues = (input: string) => {
  const matches = input.matchAll(/(?:a1c|hba1c)[^\d]{0,10}(\d{1,2}(?:\.\d)?)/gi)
  const values = [...matches]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 3 && value <= 20)

  return Array.from(new Set(values))
}

const extractLinesByKeyword = (input: string, keywords: string[]) =>
  toBulletLines(input).filter((line) =>
    keywords.some((keyword) => toLower(line).includes(keyword)),
  )

const extractSymptoms = (input: string) => extractLinesByKeyword(input, symptomKeywords)

const extractMedicines = (input: string) =>
  extractLinesByKeyword(input, medicineKeywords)

const extractShoppingItems = (input: string) => {
  const segments = splitSegments(input)
  const shoppingItems = segments.filter((segment) => {
    const normalized = toLower(segment)
    return (
      shoppingKeywords.some((keyword) => normalized.includes(keyword)) ||
      (!normalized.startsWith('call ') &&
        !normalized.startsWith('finish ') &&
        !normalized.startsWith('send ') &&
        !normalized.startsWith('email ') &&
        !normalized.startsWith('reminder ') &&
        segment.split(' ').length <= 4)
    )
  })

  return unique(
    shoppingItems
      .map((item) =>
        item
          .replace(/^buy\s+/i, '')
          .replace(/^shopping\s+/i, '')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean),
  ).slice(0, 12)
}

const extractTasks = (input: string) => {
  const segments = splitSegments(input)
  const tasks = segments.filter((segment) => {
    const normalized = toLower(segment)
    return (
      todoKeywords.some((keyword) => normalized.includes(keyword)) ||
      normalized.startsWith('call ') ||
      normalized.startsWith('send ') ||
      normalized.startsWith('schedule ') ||
      normalized.startsWith('buy ') ||
      normalized.startsWith('pick up ')
    )
  })

  return unique(
    tasks
      .map((item) =>
        item
          .replace(/^todo[:\s-]*/i, '')
          .replace(/^reminder[:\s-]*/i, '')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean),
  ).slice(0, 12)
}

const cleanNotes = (input: string) => {
  const items = toBulletLines(input)
  if (items.length === 0) {
    return ['No note lines were detected yet. Paste a few lines to organize them.']
  }

  return items.map((item) => sentenceCase(item))
}

const createResponse = (
  type: string,
  title: string,
  responseText: string,
  bullets: string[],
  suggestedActions: string[],
  safetyLevel: StructuredAiResponse['safetyLevel'],
  memoryUpdates?: string[],
): StructuredAiResponse => ({
  type,
  title,
  responseText,
  bullets,
  suggestedActions,
  safetyLevel,
  memoryUpdates,
})


const relevantMemories = (input: string, memory: MemoryEntry[]) => {
  const terms = unique(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 4),
  )

  if (terms.length === 0) {
    return []
  }

  return memory
    .filter((entry) => {
      const haystack = `${entry.title} ${entry.content}`.toLowerCase()
      return terms.some((term) => haystack.includes(term))
    })
    .slice(0, 3)
}

const getSafetyForBloodSugar = (input: string, readings: number[]) => {
  const hasSevereSymptomLanguage =
    /passed out|confused|can't wake|cannot wake|shortness of breath|chest pain/i.test(
      input,
    )

  if (readings.some((reading) => reading < urgentLowReading || reading >= urgentHighReading)) {
    return {
      level: 'urgent' as const,
      note:
        'Urgent safety flag: extremely low or very high glucose was noted. If this is current, seek urgent medical care now.',
    }
  }

  if (
    readings.some((reading) => reading < lowReading || reading >= highReading) ||
    hasSevereSymptomLanguage
  ) {
    return {
      level: 'caution' as const,
      note:
        'Caution flag: an out-of-range glucose value or severe symptom wording was noted and should be reviewed with a clinician.',
    }
  }

  return {
    level: 'normal' as const,
    note: 'No urgent safety flag was noted in this note.',
  }
}

const buildPatternSummary = (readings: number[], input: string, events: GlucoseEvent[]) => {
  if (readings.length === 0) {
    return 'No clear glucose pattern was identified from this note.'
  }

  const lowCount = readings.filter((reading) => reading < lowReading).length
  const highCount = readings.filter((reading) => reading >= highReading).length
  const hasOvernightContext = events.some((event) =>
    /overnight|waking|before bed|bedtime/i.test(event.timelineText),
  )
  const hasFoodContext = events.some((event) =>
    /meal|food|carbohydrate|minimal food/i.test(event.timelineText),
  )

  if (lowCount > 0 && /juice|snack|treated|after eating/i.test(input)) {
    return 'A lower reading appears after food-related context, which may be useful to review as a sequence with a clinician.'
  }

  if (hasOvernightContext && highCount > 0 && lowCount > 0) {
    return 'Possible overnight elevation followed by a later drop appears in this note.'
  }

  if (highCount > 1) {
    return 'More than one elevated glucose reading was noted and may be useful to group chronologically for clinician review.'
  }

  if (hasFoodContext && lowCount > 0) {
    return 'Food intake and glucose shifts were both mentioned, and the timeline may be useful for clinician handoff.'
  }

  if (lowCount > 0) {
    return 'A lower glucose reading was noted; timing and meal context may help with clinician review.'
  }

  if (readings.length >= 2) {
    return `The readings appear to range from ${readings[0]} to ${readings[readings.length - 1]} mg/dL in this note.`
  }

  return 'One glucose reading was clearly noted; adding timing details may improve clinician handoff.'
}

const buildHealthSummary = (context: ProviderContext) => {
  const glucoseEvents = extractGlucoseEvents(context.input)
  const readings = extractBloodSugarReadings(context.input)
  const a1cValues = extractA1cValues(context.input)
  const medicines = extractMedicines(context.input)
  const symptoms = extractSymptoms(context.input)
  const safety = getSafetyForBloodSugar(context.input, readings)
  const patternSummary = buildPatternSummary(readings, context.input, glucoseEvents)
  const contextMentions = unique(glucoseEvents.flatMap((event) => {
    const matches = event.timelineText.match(/\((.+)\)/)
    return matches ? matches[1].split(';').map((item) => item.trim()) : []
  }))

  return createResponse(
    'health_summary',
    'Health Notes Summary',
    'This local summary organizes reported health notes for personal tracking and clinician handoff. It is not diagnostic or prescriptive.',
    [
      glucoseEvents.length > 0
        ? `Glucose readings mentioned: ${glucoseEvents.map((event) => event.timelineText).join(' | ')}`
        : 'Glucose readings mentioned: No clear glucose reading was identified in this note.',
      contextMentions.length > 0
        ? `Context noted: ${contextMentions.join(' | ')}`
        : 'Context noted: No timing or meal context was clearly identified.',
      a1cValues.length > 0
        ? `A1C mentioned: ${a1cValues.join(', ')}`
        : 'A1C mentioned: No A1C value was mentioned in this note.',
      `Possible pattern: ${patternSummary}`,
      medicines.length > 0
        ? `Medications: ${medicines.slice(0, 3).join(' | ')}`
        : 'Medications: No medications were mentioned in this note.',
      symptoms.length > 0
        ? `Symptoms: ${symptoms.slice(0, 3).join(' | ')}`
        : 'Symptoms: No symptoms were described in this note.',
      `Safety wording: ${safety.level === 'normal' ? 'This note is an organizational summary only and is not medical advice.' : safety.note}`,
    ],
    [
      'Keep dates, times, and readings together when you add future notes.',
      'Use this summary as clinician handoff prep, not as diagnosis.',
      'Add missing timing details if you want a clearer chronology.',
    ],
    safety.level,
    unique([
      ...readings.map((reading) => `Blood sugar reading noted: ${reading} mg/dL`),
      ...a1cValues.map((value) => `A1C mentioned: ${value}`),
      ...contextMentions,
      ...medicines.slice(0, 2),
      ...symptoms.slice(0, 2),
    ]),
  )
}

const buildBloodSugarSummary = (context: ProviderContext) => {
  const glucoseEvents = extractGlucoseEvents(context.input)
  const readings = extractBloodSugarReadings(context.input)
  const a1cValues = extractA1cValues(context.input)
  const safety = getSafetyForBloodSugar(context.input, readings)
  const patternSummary = buildPatternSummary(readings, context.input, glucoseEvents)

  const rangeText =
    readings.length > 0
      ? readings.length > 1
        ? `Glucose readings mentioned: ${readings.join(', ')} mg/dL. Range: ${readings[0]}-${readings[readings.length - 1]} mg/dL.`
        : `Glucose readings mentioned: ${readings[0]} mg/dL.`
      : 'Glucose readings mentioned: No explicit glucose reading was identified.'

  return createResponse(
    'blood_sugar',
    context.variant === 'doctor-note' ? 'Doctor-Ready Glucose Note' : 'Blood Sugar Summary',
    'This is a non-diagnostic glucose summary based only on what was noted in your text.',
    [
      rangeText,
      glucoseEvents.length > 0
        ? `Timeline context: ${glucoseEvents.map((event) => event.timelineText).join(' | ')}`
        : 'Timeline context: No clear glucose timeline details were identified.',
      a1cValues.length > 0
        ? `A1C mentioned: ${a1cValues.join(', ')}.`
        : 'A1C mentioned: No A1C value was mentioned in this note.',
      `Possible pattern: ${patternSummary}`,
      `Safety wording: ${safety.level === 'normal' ? 'This note is an organizational summary only and is not medical advice.' : safety.note}`,
    ],
    [
      'Add dates, meals, and medicine timing for stronger tracking.',
      'Keep repeated lows or highs in one running log for your clinician.',
      'Use this summary for organization and clinician review only.',
    ],
    safety.level,
    readings.map((reading) => `Blood sugar reading noted: ${reading} mg/dL`),
  )
}

const buildMedicineSummary = (context: ProviderContext) => {
  const medicines = extractMedicines(context.input)
  const symptoms = extractSymptoms(context.input)
  const cautionLevel =
    symptoms.some((item) => /side effect|nausea|dizzy|rash|swelling/i.test(item)) &&
    medicines.length > 0
      ? 'caution'
      : 'normal'

  return createResponse(
    'medicine_log',
    'Medicine Summary',
    'This is a local summary of medicine-related notes. It does not verify safety, doses, or interactions.',
    [
      medicines.length > 0
        ? `Medicine lines found: ${medicines.slice(0, 5).join(' | ')}`
        : 'No medications were mentioned in this note.',
      symptoms.length > 0
        ? `Possible side effects or symptoms mentioned: ${symptoms.slice(0, 3).join(' | ')}`
        : 'No symptoms were described in this note.',
      'Keep exact names, strengths, and timing together when you log medicines.',
    ],
    [
      'Compare this summary with the prescription label for accuracy.',
      'Bring questions about side effects or missed doses to a clinician or pharmacist.',
      'Add dates and times to make the log more useful later.',
    ],
    cautionLevel,
    medicines.slice(0, 4),
  )
}

const buildSymptomSummary = (context: ProviderContext) => {
  const symptoms = extractSymptoms(context.input)
  const readings = extractBloodSugarReadings(context.input)
  const safety = getSafetyForBloodSugar(context.input, readings)

  return createResponse(
    'symptom_note',
    'Symptom Organizer',
    'This organizes symptom notes into a cleaner format without diagnosing what they mean.',
    [
      symptoms.length > 0
        ? `Symptoms or side effects mentioned: ${symptoms.slice(0, 5).join(' | ')}`
        : 'No symptoms were described in this note.',
      readings.length > 0
        ? `Glucose readings mentioned: ${readings.join(', ')} mg/dL.`
        : 'Glucose readings mentioned: No glucose reading was identified in this note.',
      `Safety wording: ${safety.level === 'normal' ? 'This note is an organizational summary only and is not medical advice.' : safety.note}`,
    ],
    [
      'Add when the symptom started, how long it lasted, and what made it better or worse.',
      'Keep symptom notes separate from guesses about diagnosis.',
      'If symptoms are severe or rapidly worsening, seek medical advice promptly.',
    ],
    safety.level,
    symptoms.slice(0, 4),
  )
}

const buildDoctorReport = (context: ProviderContext) => {
  const cleaned = cleanNotes(context.input)
  const glucoseEvents = extractGlucoseEvents(context.input)
  const readings = extractBloodSugarReadings(context.input)
  const medicines = extractMedicines(context.input)
  const symptoms = extractSymptoms(context.input)
  const safety = getSafetyForBloodSugar(context.input, readings)
  const patternSummary = buildPatternSummary(readings, context.input, glucoseEvents)
  const reason = truncate(firstWords(context.input, 18) || 'Health note organization request')
  const timeline =
    glucoseEvents.length > 0
      ? glucoseEvents.map((event) => event.timelineText).slice(0, 6).join(' | ')
      : cleaned.slice(0, 3).join(' | ')

  return createResponse(
    'doctor_report',
    'Doctor-Ready Note',
    'This is a structured preparation note for clinician handoff. It is an organizational summary only and not medical advice.',
    [
      `Reason for note: ${reason}.`,
      `Timeline: ${timeline || 'No clear timeline details were noted.'}`,
      `Symptoms: ${symptoms.length > 0 ? symptoms.slice(0, 4).join(' | ') : 'none mentioned'}`,
      medicines.length > 0
        ? `Medications: ${medicines.slice(0, 4).join(' | ')}`
        : 'Medications: none mentioned',
      `Possible pattern: ${patternSummary}`,
      `Safety wording: ${safety.level === 'normal' ? 'This note is an organizational summary only and is not medical advice.' : safety.note}`,
    ],
    [
      'Add dates, times, and duration before you send or print this note.',
      'Keep the final note concise so it is easy to review quickly in clinic.',
      'Use this draft for organization and handoff only, not diagnosis.',
    ],
    safety.level,
    unique([
      ...cleaned.slice(0, 2),
      ...glucoseEvents.map((event) => `Glucose event: ${event.timelineText}`),
      ...readings.map((reading) => `Reading: ${reading} mg/dL`),
    ]),
  )
}

const buildCleanNotes = (context: ProviderContext) => {
  const cleaned = cleanNotes(context.input)

  return createResponse(
    'messy_notes',
    'Clean Notes',
    'These notes were reformatted into cleaner, easier-to-scan points.',
    cleaned.slice(0, 10),
    [
      'Copy the cleaned version into your main notes app if it looks right.',
      'Run shopping or task extraction next if the note mixes multiple topics.',
      'Add dates or owners to any line that could become an action item.',
    ],
    'info',
    cleaned.slice(0, 4),
  )
}

const buildShoppingList = (context: ProviderContext) => {
  const shoppingItems = extractShoppingItems(context.input)

  return createResponse(
    'shopping_text',
    'Shopping List',
    'Here is a quick shopping-focused extract from the pasted text.',
    shoppingItems.length > 0
      ? shoppingItems.map((item) => sentenceCase(item))
      : ['No obvious shopping items were detected yet.'],
    [
      'Remove duplicates and add quantities before you head out.',
      'Save useful recurring items to memory if this is part of a routine.',
      'Keep shopping items separate from errands for a cleaner list.',
    ],
    'info',
    shoppingItems,
  )
}

const buildTaskList = (context: ProviderContext) => {
  const tasks = extractTasks(context.input)

  return createResponse(
    'todo_text',
    'Task Extract',
    'These look like the clearest action items from the text you pasted.',
    tasks.length > 0
      ? tasks.map((task) => sentenceCase(task))
      : ['No obvious task or reminder line was detected yet.'],
    [
      'Put deadlines next to anything time-sensitive.',
      'Split larger tasks into the next visible step.',
      'Move routine items into memory if you want a reusable checklist later.',
    ],
    'info',
    tasks,
  )
}

const buildFocusSupport = (context: ProviderContext) => {
  const supportiveLine =
    context.variant === 'supportive'
      ? 'You do not need a perfect restart. A clean 10-minute restart still counts.'
      : 'A smaller, calmer restart is usually stronger than waiting for perfect motivation.'

  return createResponse(
    'focus_support',
    'Focus Mode Coaching',
    'This plan is meant to lower friction and help you get moving locally, without overwhelm.',
    [
      supportiveLine,
      'Pick one target for the next 25 minutes and hide every other visible task.',
      'Put the distracting app or device in another room, drawer, or account for one work block.',
      'Add friction: sign out, remove autoplay, grayscale the screen, or use a separate browser profile.',
      'When you stall, restart with one tiny verb: open, write, sort, or send.',
    ],
    [
      'Start a short timer and stop after the first visible chunk.',
      'Write the single task you are allowed to do next.',
      'Save a working focus script to memory if this wording helps.',
    ],
    'normal',
    ['Preferred focus reset: short timer, one visible task, added distraction friction'],
  )
}

const buildFamilySupport = (context: ProviderContext) => {
  return createResponse(
    'family_support',
    'Family Helper Guidance',
    'This wording aims to be calm, direct, and practical for family or household support.',
    [
      'Rule wording draft: "We keep devices in shared spaces first, and private screen time comes after responsibilities are done."',
      'Conflict wording draft: "I want to solve this with you, not fight you. Let\'s slow it down and choose one next step."',
      'Kid-safe structure idea: use shared charging spots, daytime-only installs, and fewer app choices on the main screen.',
      'Keep consequences predictable and short instead of emotional or surprise-based.',
      context.input.trim()
        ? `Situation anchor: ${truncate(context.input)}`
        : 'Add a specific situation to get more tailored wording next time.',
    ],
    [
      'Use one sentence at a time during tense moments.',
      'Write house rules in positive, plain language.',
      'Save the best wording to memory for reuse.',
    ],
    'normal',
    ['Family rule wording saved as a calm, consistent structure'],
  )
}

const buildSeniorSupport = (context: ProviderContext) => {
  const lines = cleanNotes(context.input)

  return createResponse(
    'senior_support',
    'Senior-Friendly Steps',
    'This version uses simpler wording, shorter steps, and a safety-first tone.',
    [
      'Step 1: Start with one device and one task.',
      'Step 2: Read one short instruction at a time.',
      'Step 3: Pause after each step to confirm what changed on the screen.',
      'Safety reminder: do not share codes, passwords, or payment details unless you fully trust the request.',
      lines[0]
        ? `Simplified from your note: ${truncate(lines[0])}`
        : 'Paste a longer instruction set to simplify it further.',
    ],
    [
      'Keep instructions printed or pinned in the same place each time.',
      'Use larger text, fewer steps, and the exact button names on screen.',
      'Save repeatable instructions to memory for later.',
    ],
    'info',
    ['Senior-friendly instruction style: one task, one step, one confirmation at a time'],
  )
}

const buildGodzillaPlanning = (context: ProviderContext) => {
  return createResponse(
    'godzilla_planning',
    'KCxMode Planning',
    'Here is a practical plan for a strong local-first work block inside the KCxMode ecosystem.',
    [
      'Define the one result that would make this block a win.',
      'Set up the environment first: charger, water, notes, and the exact files or tabs you need.',
      'Use one visible task lane and move everything else into a parking list.',
      'Add friction to distractions before the sprint starts, not after you drift.',
      context.input.trim()
        ? `Current planning note: ${truncate(context.input)}`
        : 'Add a project or goal line to get a more anchored plan.',
    ],
    [
      'Work in one block, then review what to keep, cut, or defer.',
      'Save good routines as KCxMode settings in memory.',
      'Turn loose ideas into one next concrete action.',
    ],
    'normal',
    ['KCxMode planning preference: one visible result, one lane, pre-added distraction friction'],
  )
}

const buildGeneralResponse = (context: ProviderContext) => {
  const related = relevantMemories(context.input, context.memory)

  return createResponse(
    'general',
    'Local Assistant Response',
    'This is a local-first helper response from the built-in rule-based provider. No cloud call or remote login is being used.',
    [
      `Main takeaway: ${truncate(context.input || 'No input was provided yet.')}`,
      related.length > 0
        ? `Related memory: ${related.map((entry) => entry.title).join(' | ')}`
        : 'No close memory match was found in local storage.',
      'If this is health-related, I can organize notes safely without diagnosing.',
      'If this is messy text, I can extract tasks, shopping items, or cleaner notes.',
    ],
    [
      'Use a helper section if you want a more structured result.',
      'Save useful outputs to memory so the app gets more personalized locally.',
      'Keep sensitive details local unless you choose to share them elsewhere.',
    ],
    'info',
    related.slice(0, 2).map((entry) => `Related local memory: ${entry.title}`),
  )
}

const buildResponseByRoute = (context: ProviderContext) => {
  switch (context.route) {
    case 'health_summary':
      return buildHealthSummary(context)
    case 'blood_sugar':
    case 'a1c':
      return buildBloodSugarSummary(context)
    case 'medicine_log':
      return buildMedicineSummary(context)
    case 'symptom_note':
      return buildSymptomSummary(context)
    case 'doctor_report':
      return buildDoctorReport(context)
    case 'messy_notes':
      return buildCleanNotes(context)
    case 'shopping_text':
      return buildShoppingList(context)
    case 'todo_text':
      return buildTaskList(context)
    case 'focus_support':
      return buildFocusSupport(context)
    case 'family_support':
      return buildFamilySupport(context)
    case 'senior_support':
      return buildSeniorSupport(context)
    case 'godzilla_planning':
      return buildGodzillaPlanning(context)
    case 'general':
      return buildGeneralResponse(context)
  }
}

class RuleBasedProvider implements AiProvider {
  id: ProviderId = 'rule-based'
  name = 'Rule-Based Provider'
  connected = true
  isPlaceholder = false

  generate(context: ProviderContext) {
    return buildResponseByRoute(context)
  }
}

class PlaceholderProvider implements AiProvider {
  id: ProviderId
  name: string
  connected = false
  isPlaceholder = true

  constructor(id: ProviderId, name: string) {
    this.id = id
    this.name = name
  }

  generate(context: ProviderContext) {
    return createResponse(
      'provider_placeholder',
      `${this.name} Placeholder`,
      `${this.name} is configured only as a future placeholder right now. The app is staying local-first and is not making real provider network calls yet.`,
      [
        `Requested route: ${context.route}`,
        'No API key is being used here.',
        'No external connection was attempted.',
      ],
      [
        'Use the active local rule-based provider for working features right now.',
        'Keep provider settings saved locally for future wiring only.',
      ],
      'info',
    )
  }
}

export class GodzillaAiBrain {
  private providers: Record<ProviderId, AiProvider> = {
    'rule-based': new RuleBasedProvider(),
    ollama: new PlaceholderProvider('ollama', 'Ollama'),
    openai: new PlaceholderProvider('openai', 'OpenAI'),
    gemini: new PlaceholderProvider('gemini', 'Gemini'),
    claude: new PlaceholderProvider('claude', 'Claude'),
  }

  detectIntent(input: string): BrainIntent {
    const normalized = toLower(input)
    const readings = extractBloodSugarReadings(input)
    const a1cValues = extractA1cValues(input)

    if (readings.length > 0) {
      return 'blood_sugar'
    }

    if (a1cValues.length > 0) {
      return 'a1c'
    }

    if (/doctor|appointment|report|visit summary|for my doctor/i.test(normalized)) {
      return 'doctor_report'
    }

    if (hasAnyKeyword(normalized, medicineKeywords)) {
      return 'medicine_log'
    }

    if (hasAnyKeyword(normalized, symptomKeywords)) {
      return 'symptom_note'
    }

    if (hasAnyKeyword(normalized, shoppingKeywords)) {
      return 'shopping_text'
    }

    if (hasAnyKeyword(normalized, todoKeywords)) {
      return 'todo_text'
    }

    if (hasAnyKeyword(normalized, focusKeywords)) {
      return 'focus_support'
    }

    if (hasAnyKeyword(normalized, familyKeywords)) {
      return 'family_support'
    }

    if (hasAnyKeyword(normalized, seniorKeywords)) {
      return 'senior_support'
    }

    if (hasAnyKeyword(normalized, planningKeywords)) {
      return 'godzilla_planning'
    }

    if (input.includes('\n') || /,|;/.test(input)) {
      return 'messy_notes'
    }

    return 'general'
  }

  getProviderCatalog() {
    return Object.values(this.providers).map((provider) => ({
      id: provider.id,
      name: provider.name,
      connected: provider.connected,
      isPlaceholder: provider.isPlaceholder,
    }))
  }

  suggestMemoryCategory(response: StructuredAiResponse): MemoryCategory {
    switch (response.type) {
      case 'health_summary':
        return 'health_context'
      case 'blood_sugar':
      case 'a1c':
        return 'blood_sugar'
      case 'medicine_log':
        return 'medicine'
      case 'symptom_note':
        return 'symptom'
      case 'shopping_text':
        return 'shopping'
      case 'todo_text':
        return 'task'
      case 'focus_support':
      case 'godzilla_planning':
        return 'godzilla_mode_setting'
      default:
        return 'note'
    }
  }

  generate(request: BrainRequest) {
    const route = request.routeOverride ?? this.detectIntent(request.input)
    const preferredProvider = this.providers[request.providerId]
    const activeProvider =
      preferredProvider && preferredProvider.connected
        ? preferredProvider
        : this.providers['rule-based']

    return activeProvider.generate({
      ...request,
      route,
    })
  }
}
