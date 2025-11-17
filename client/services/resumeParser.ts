import { ResumeData, ContactInfo, Experience, Education } from "@/types";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getApiKeyFromSettings } from "@/utils/storage";
import { retryWithBackoff } from "@/services/gemini";

const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY || "";

export async function parseFile(file: File): Promise<ResumeData> {
  let text = "";

  if (file.name.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    text = result.value;
  } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    text = await file.text();
  } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    text = await extractTextFromPDF(file);
  } else {
    throw new Error(
      "Unsupported file format. Please upload .docx, .txt, or .pdf file.",
    );
  }

  if (!text || text.trim().length === 0) {
    throw new Error(
      "Could not extract text from file. Please check the file format.",
    );
  }

  // Use Gemini to parse completely if API key is available
  let apiKey = GEMINI_API_KEY || (await getApiKeyFromSettings());
  if (apiKey) {
    try {
      return await parseWithGemini(text, apiKey);
    } catch (error) {
      console.warn("Gemini parsing failed:", error);
      throw error;
    }
  }

  throw new Error("Gemini API key not configured. Please set it in Settings.");
}

export async function parseDocxFile(file: File): Promise<ResumeData> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  // First do basic parsing
  let resume = parseResumeText(text);

  // Then enhance with Gemini if API key is available
  if (GEMINI_API_KEY) {
    try {
      resume = await enhanceWithGemini(resume, text);
    } catch (error) {
      console.warn("Gemini enhancement failed, using basic parsing:", error);
      // Continue with basic parsing if Gemini fails
    }
  }

  return resume;
}

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Use pdf-parse library if available, otherwise we'll rely on Gemini to handle the PDF
    // For now, we'll encode the PDF and send it to Gemini as base64
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);
    return `[PDF_FILE_BASE64]${base64}`;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("Could not process PDF file.");
  }
}

async function parseWithGemini(
  content: string,
  apiKey: string,
): Promise<ResumeData> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Prepare content for Gemini
    let prompt = "";
    let parts: any[] = [];

    if (content.startsWith("[PDF_FILE_BASE64]")) {
      // Handle PDF
      const base64 = content.replace("[PDF_FILE_BASE64]", "");
      parts = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64,
          },
        },
        {
          text: getResumeParsing(),
        },
      ];
    } else {
      // Handle text
      prompt = getResumeParsing() + `\n\nResume Content:\n${content}`;
      parts = [{ text: prompt }];
    }

    const responseText = await retryWithBackoff(async () => {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: parts,
          },
        ],
      });
      return result.response.text();
    });

    console.log(
      "[Gemini] Parse response received, length:",
      responseText.length,
    );

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(
        "[Gemini] No JSON found in response:",
        responseText.substring(0, 500),
      );
      throw new Error("Failed to parse resume. Invalid response format.");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return buildResumeObject(parsed);
  } catch (error) {
    console.error("[Gemini] Error parsing resume:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to parse resume with Gemini API.");
  }
}

function getResumeParsing(): string {
  return `Extract ALL content from this resume and return valid JSON with: contact (name, email, phone, location, website), summary, skills (array), experience (array with title, company, startDate, endDate, description), education (array), plus any other sections found (certifications, achievements, publications, projects, etc.).

Return ONLY valid JSON, no markdown.`;
}

function buildResumeObject(parsed: any): ResumeData {
  const contact: ContactInfo = {
    name: parsed.contact?.name || "Unknown",
    email: parsed.contact?.email || "",
    phone: parsed.contact?.phone || "",
    location: parsed.contact?.location || "",
    website: parsed.contact?.website || "",
  };

  const experience: Experience[] = Array.isArray(parsed.experience)
    ? parsed.experience.map((exp: any) => ({
        title: exp.title || "",
        company: exp.company || "",
        location: exp.location || "",
        startDate: exp.startDate || "",
        endDate: exp.endDate || "",
        isCurrentlyWorking: exp.isCurrentlyWorking || false,
        description: Array.isArray(exp.description)
          ? exp.description
          : exp.description
            ? [exp.description]
            : [],
      }))
    : [];

  const education: Education[] = Array.isArray(parsed.education)
    ? parsed.education.map((edu: any) => ({
        degree: edu.degree || "",
        field: edu.field || "",
        institution: edu.institution || "",
        graduationDate: edu.graduationDate || "",
        gpa: edu.gpa || "",
        achievements: edu.achievements || [],
      }))
    : [];

  const resume: ResumeData = {
    contact,
    summary: parsed.summary || "",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    experience,
    education,
  };

  // Add all other sections dynamically
  const standardKeys = [
    "contact",
    "summary",
    "skills",
    "experience",
    "education",
  ];
  for (const key in parsed) {
    if (!standardKeys.includes(key) && parsed[key]) {
      (resume as any)[key] = parsed[key];
    }
  }

  return resume;
}

async function enhanceWithGemini(
  baseResume: ResumeData,
  resumeText: string,
): Promise<ResumeData> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Parse this resume and extract structured information. Return a JSON object with these fields:
{
  "summary": "2-3 sentence professional summary",
  "skills": ["skill1", "skill2", ...],
  "certifications": ["cert1", "cert2", ...],
  "achievements": ["achievement1", "achievement2", ...],
  "publications": ["publication1", "publication2", ...],
  "hobbies": ["hobby1", "hobby2", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "isCurrentlyWorking": true/false,
      "description": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "institution": "University Name",
      "graduationDate": "YYYY-MM"
    }
  ]
}

Resume text:
${resumeText}

Return ONLY valid JSON, no other text.`;

  try {
    const responseText = await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("No JSON found in Gemini response");
      return baseResume;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      contact: baseResume.contact,
      summary: parsed.summary || baseResume.summary,
      skills: parsed.skills || baseResume.skills,
      experience: parsed.experience || baseResume.experience,
      education: parsed.education || baseResume.education,
      certifications: parsed.certifications || [],
      achievements: parsed.achievements || [],
      publications: parsed.publications || [],
      hobbies: parsed.hobbies || [],
    };
  } catch (error) {
    console.error("Error parsing with Gemini:", error);
    return baseResume;
  }
}

function parseResumeText(text: string): ResumeData {
  const lines = text.split("\n").filter((line) => line.trim());

  // Extract contact info from first lines
  const contact: ContactInfo = {
    name: lines[0] || "Unknown",
    email: extractEmail(text),
    phone: extractPhone(text),
    location: "",
    website: extractUrl(text),
  };

  // Extract sections
  const skills = extractSection(text, "skills", "experience");
  const experience = extractExperience(text);
  const education = extractEducation(text);
  const summary = extractSection(
    text,
    "summary|profile|objective",
    "experience",
  );

  return {
    contact,
    summary: summary.join(" "),
    skills,
    experience,
    education,
  };
}

function extractEmail(text: string): string {
  const match = text.match(/[\w\.-]+@[\w\.-]+\.\w+/);
  return match ? match[0] : "";
}

function extractPhone(text: string): string {
  const match = text.match(
    /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  );
  return match ? match[0] : "";
}

function extractUrl(text: string): string {
  const match = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/i);
  return match ? match[0] : "";
}

function extractSection(
  text: string,
  startKeyword: string,
  endKeyword: string,
): string[] {
  const startRegex = new RegExp(startKeyword, "i");
  const endRegex = new RegExp(endKeyword, "i");

  const startIdx = text.search(startRegex);
  const endIdx = text.search(endRegex);

  if (startIdx === -1) return [];

  const sectionText =
    endIdx === -1 ? text.substring(startIdx) : text.substring(startIdx, endIdx);

  return sectionText
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function extractExperience(text: string): Experience[] {
  const experiences: Experience[] = [];

  const experienceRegex =
    /([A-Z][a-z\s]+)\s+(?:at|@)?\s+([A-Z][a-z\s&\-\.]+)(\d{4})?[-–](\d{4}|present|now)?/gi;
  let match;

  while ((match = experienceRegex.exec(text)) !== null) {
    experiences.push({
      title: match[1].trim(),
      company: match[2].trim(),
      startDate: match[3] || "Unknown",
      endDate: match[4] || undefined,
      isCurrentlyWorking: /present|now|current/i.test(match[4] || ""),
      description: [],
    });
  }

  return experiences;
}

function extractEducation(text: string): Education[] {
  const educations: Education[] = [];

  const degreeRegex =
    /(Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|Associate).*?(?:in|of)?\s+([A-Za-z\s]+?)(?:from|at|,|\()?([A-Z][a-z\s\-\.&]+(?:University|College|Institute))/gi;
  let match;

  while ((match = degreeRegex.exec(text)) !== null) {
    educations.push({
      degree: match[1].trim(),
      field: match[2].trim(),
      institution: match[3].trim(),
      graduationDate: "Unknown",
    });
  }

  return educations;
}

export function validateResume(resume: ResumeData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!resume.contact.name?.trim()) {
    errors.push("Missing name");
  }

  if (!resume.contact.email?.trim()) {
    errors.push("Missing email");
  }

  if (!resume.contact.phone?.trim()) {
    errors.push("Missing phone");
  }

  if (resume.skills.length === 0) {
    errors.push("No skills listed");
  }

  if (resume.experience.length === 0) {
    errors.push("No experience listed");
  }

  if (resume.education.length === 0) {
    errors.push("No education listed");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
