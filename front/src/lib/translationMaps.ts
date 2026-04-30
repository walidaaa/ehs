// Maps Arabic DB values to translation keys for display
// DB stores Arabic values; these maps convert them for display in any language

export const appointmentStatusMap: Record<string, string> = {
  "مجدول": "statusScheduled",
  "مكتمل": "statusCompleted",
  "ملغي": "statusCancelled",
  "غائب": "statusAbsent",
};

export const appointmentStatusKeys = [
  { value: "مجدول", key: "statusScheduled" },
  { value: "مكتمل", key: "statusCompleted" },
  { value: "ملغي", key: "statusCancelled" },
  { value: "غائب", key: "statusAbsent" },
];

export const patientStatusMap: Record<string, string> = {
  "تحسن": "statusImprovement",
  "استقرار": "statusStable",
  "تدهور": "statusDeterioration",
};

export const taskStatusMap: Record<string, string> = {
  "جديدة": "statusNew",
  "منفذة": "statusExecuted",
  "مقيّمة": "statusEvaluated",
};

export const taskTypeKeys = [
  { value: "تمرين", key: "taskTypeExercise" },
  { value: "سلوك", key: "taskTypeBehavior" },
  { value: "دواء", key: "taskTypeMedication" },
  { value: "متابعة", key: "taskTypeFollowUp" },
  { value: "تعليمات", key: "taskTypeInstructions" },
];

export const diagnosisKeys = [
  { value: "توحد (ASD)", key: "diagAutism" },
  { value: "تأخر نطق", key: "diagSpeechDelay" },
  { value: "فرط الحركة وتشتت الانتباه (ADHD)", key: "diagADHD" },
  { value: "صعوبات تعلم", key: "diagLearningDifficulties" },
  { value: "اضطراب سلوكي", key: "diagBehavioralDisorder" },
  { value: "قلق عام", key: "diagGeneralAnxiety" },
  { value: "اكتئاب", key: "diagDepression" },
  { value: "اضطراب طيف التوحد", key: "diagASD" },
  { value: "تأخر نمو", key: "diagDevelopmentalDelay" },
  { value: "اضطراب التواصل", key: "diagCommunicationDisorder" },
  { value: "أخرى", key: "diagOther" },
];

export const diagnosisMap: Record<string, string> = Object.fromEntries(
  diagnosisKeys.map(k => [k.value, k.key])
);

export const birthTypeKeys = [
  { value: "طبيعية", key: "birthNatural" },
  { value: "قيصرية", key: "birthCesarean" },
  { value: "مبكرة (خداج)", key: "birthPremature" },
  { value: "بمساعدة أدوات", key: "birthAssisted" },
];

export const birthTypeMap: Record<string, string> = Object.fromEntries(
  birthTypeKeys.map(k => [k.value, k.key])
);

export const serviceKeys = [
  { value: "طب الأطفال", key: "servicePediatrics" },
  { value: "التوحد", key: "serviceAutism" },
  { value: "الأمراض العقلية", key: "serviceMentalHealth" },
  { value: "الطوارئ", key: "serviceEmergency" },
  { value: "الأرطوفوني (النطق والتخاطب)", key: "serviceSpeechTherapy" },
  { value: "علم النفس", key: "servicePsychology" },
  { value: "إعادة التأهيل", key: "serviceRehab" },
  { value: "الإدمان", key: "serviceAddiction" },
];

export const serviceMap: Record<string, string> = Object.fromEntries(
  serviceKeys.map(k => [k.value, k.key])
);

// Specialty map (same as service map for doctors)
export const specialtyKeys = [
  { value: "طب الأطفال", key: "servicePediatrics" },
  { value: "التوحد", key: "serviceAutism" },
  { value: "الأمراض العقلية", key: "serviceMentalHealth" },
  { value: "الطوارئ", key: "serviceEmergency" },
  { value: "الأرطوفوني (النطق والتخاطب)", key: "serviceSpeechTherapy" },
  { value: "علم النفس", key: "servicePsychology" },
  { value: "إعادة التأهيل", key: "serviceRehab" },
  { value: "الإدمان", key: "serviceAddiction" },
  { value: "العلاج الوظيفي", key: "serviceOccupationalTherapy" },
];

export const specialtyMap: Record<string, string> = Object.fromEntries(
  specialtyKeys.map(k => [k.value, k.key])
);

// Helper to translate a DB value using a map and translation object
export function translateValue(value: string | null | undefined, map: Record<string, string>, t: any): string {
  if (!value) return "-";
  const key = map[value];
  return key ? ((t as any)[key] || value) : value;
}

// Helper to get translated options from key-value pairs
export function getTranslatedOptions(keys: { value: string; key: string }[], t: any): { value: string; label: string }[] {
  return keys.map(k => ({ value: k.value, label: (t as any)[k.key] || k.value }));
}

export const appointmentTypeKeys = [
  { value: "فحص", key: "apptTypeExam" },
  { value: "متابعة", key: "apptTypeFollowUp" },
  { value: "استشارة", key: "apptTypeConsultation" },
  { value: "جلسة علاج", key: "apptTypeTherapy" },
  { value: "تقييم", key: "apptTypeAssessment" },
  { value: "طوارئ", key: "apptTypeEmergency" },
  { value: "أخرى", key: "apptTypeOther" },
];

export const appointmentTypeMap: Record<string, string> = Object.fromEntries(
  appointmentTypeKeys.map(k => [k.value, k.key])
);

// Notification message translations
export const notificationMessageMap: Record<string, string> = {
  "تذكير بالموعد": "appointmentReminder",
  "موعد مؤكد": "appointmentConfirmed",
  "موعد مكتمل": "appointmentCompleted",
  "موعد ملغي": "appointmentCancelled",
};
