import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResumeData, JobDescription, ATSScore } from "@/types";
import { getApiKeyFromSettings, getSettings } from "@/utils/storage";

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message;

      // Only retry on 503 (overloaded) or 429 (rate limit) errors
      if (!errorMsg.includes("503") && !errorMsg.includes("429")) {
        throw lastError;
      }

      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(
          `API overloaded (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Max retry attempts exceeded");
}

// Helper function for fuzzy string matching
function fuzzyMatch(str1: string, str2: string, threshold: number = 0.7): boolean {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return true;
  if (s1.length === 0 || s2.length === 0) return false;

  // Check for substring matches
  if (s1.includes(s2) || s2.includes(s1)) return true;

  // Simple Levenshtein-like distance for typos
  const maxLen = Math.max(s1.length, s2.length);
  const minLen = Math.min(s1.length, s2.length);

  // Allow fuzzy match if one contains significant portion of the other
  if (minLen / maxLen >= threshold) {
    let matches = 0;
    for (let i = 0; i < minLen; i++) {
      if (s1[i] === s2[i]) matches++;
    }
    return matches / maxLen >= threshold;
  }

  return false;
}

// Helper function to generate keyword variations
function expandKeywordVariations(keyword: string): string[] {
  const variations = new Set<string>();
  const lower = keyword.toLowerCase().trim();

  variations.add(lower);

  // Handle special characters
  variations.add(lower.replace(/[#\+\.\-]/g, ""));
  variations.add(lower.replace("+", " plus"));
  variations.add(lower.replace("#", "sharp"));
  variations.add(lower.replace(/[\.\-]/g, " "));

  // Handle common abbreviations
  const abbrevMap: Record<string, string[]> = {
    "c++": ["cpp", "c plus plus"],
    "c#": ["csharp", "c sharp"],
    "node.js": ["nodejs", "node"],
    "react.js": ["reactjs", "react"],
    ".net": ["dot net", "dotnet"],
    "asp.net": ["aspnet"],
  };

  for (const [abbrev, expansions] of Object.entries(abbrevMap)) {
    if (lower.includes(abbrev)) {
      expansions.forEach((exp) => variations.add(exp));
    }
  }

  // Handle common technology patterns
  if (lower.includes("javascript")) variations.add("js");
  if (lower.includes("typescript")) variations.add("ts");
  if (lower.includes("python")) variations.add("py");
  if (lower.includes("java")) {
    variations.add("java");
    if (!lower.includes("script")) variations.add("java");
  }

  return Array.from(variations);
}

// Enhanced keyword matching with fuzzy matching
function findKeywordMatches(
  resumeText: string,
  jobKeywords: string[],
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of jobKeywords) {
    const variations = expandKeywordVariations(keyword);
    const found = variations.some((v) =>
      resumeText.includes(v) || fuzzyMatch(resumeText, v, 0.8)
    );

    if (found) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  return { matched, missing };
}

// Calculate ATS score with comprehensive factors
export function calculateATSScore(
  resume: ResumeData,
  jobDescription: JobDescription,
): ATSScore {
  // Build complete resume text
  const resumeText = `${resume.summary || ""} ${resume.skills.join(" ")} ${
    resume.experience
      .map((e) => `${e.title} ${e.company} ${e.description.join(" ")}`)
      .join(" ") || ""
  } ${resume.education.map((e) => `${e.degree} ${e.field}`).join(" ") || ""} ${
    resume.projects
      ?.map((p) => `${p.title} ${p.description} ${p.technologies.join(" ")}`)
      .join(" ") || ""
  } ${Object.values(resume.customSections || {}).join(" ")}`.toLowerCase();

  // Get all keywords from job description
  const jobKeywords = [
    ...jobDescription.skills,
    ...jobDescription.requirements,
  ];

  // Find keyword matches
  const { matched: matchedKeywords, missing: missingKeywords } =
    findKeywordMatches(resumeText, jobKeywords);

  // Calculate base keyword match score (40% of total)
  const keywordMatchPercentage =
    jobKeywords.length > 0
      ? (matchedKeywords.length / jobKeywords.length) * 100
      : 50;
  const keywordScore = Math.min(40, (keywordMatchPercentage / 100) * 40);

  // Skills section score (10% of total)
  let skillsScore = 0;
  if (resume.skills.length >= 8) skillsScore = 10;
  else if (resume.skills.length >= 5) skillsScore = 7;
  else if (resume.skills.length > 0) skillsScore = 4;

  // Experience quality score (25% of total)
  let experienceScore = 0;
  if (resume.experience.length > 0) {
    let totalBullets = 0;
    let bulletsWithMetrics = 0;

    resume.experience.forEach((exp) => {
      totalBullets += exp.description.length;
      // Count bullets with quantifiable metrics
      const metricsKeywords = ["%", "$", "improved", "increased", "reduced", "grew", "scaled", "built"];
      bulletsWithMetrics += exp.description.filter((d) =>
        metricsKeywords.some((k) => d.toLowerCase().includes(k)),
      ).length;
    });

    if (resume.experience.length >= 3) experienceScore += 10;
    else if (resume.experience.length >= 1) experienceScore += 5;

    if (totalBullets >= 12) experienceScore += 15;
    else if (totalBullets >= 8) experienceScore += 12;
    else if (totalBullets >= 3) experienceScore += 8;

    experienceScore = Math.min(25, experienceScore);
  }

  // Education score (10% of total)
  let educationScore = 0;
  if (resume.education.length > 0) {
    educationScore = 10;
  }

  // Summary/Professional score (10% of total)
  let summaryScore = 0;
  if (resume.summary && resume.summary.trim().length >= 100) {
    summaryScore = 10;
  } else if (resume.summary && resume.summary.trim().length >= 50) {
    summaryScore = 5;
  }

  // Projects score (5% of total)
  let projectsScore = 0;
  if (resume.projects && resume.projects.length > 0) {
    projectsScore = Math.min(5, resume.projects.length * 2);
  }

  // Calculate total score
  const totalScore = Math.min(
    100,
    Math.round(
      keywordScore + skillsScore + experienceScore + educationScore + summaryScore + projectsScore,
    ),
  );

  return {
    score: Math.max(20, totalScore),
    matchPercentage: Math.round(keywordMatchPercentage),
    keywordMatches: matchedKeywords,
    missingKeywords,
    improvements: generateImprovementsFromMissing(
      resume,
      missingKeywords,
      jobDescription,
    ),
  };
}

// Generate improvements based on missing keywords and resume gaps
function generateImprovementsFromMissing(
  resume: ResumeData,
  missingKeywords: string[],
  jobDescription: JobDescription,
): string[] {
  const improvements: string[] = [];

  // Check for missing critical keywords
  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords.slice(0, 3);
    improvements.push(
      `Incorporate key skills: ${topMissing.join(", ")}`,
    );
  }

  // Check experience quality
  const weakExperience = resume.experience.filter((e) => e.description.length < 3);
  if (weakExperience.length > 0) {
    improvements.push(
      `Expand experience descriptions with more bullet points and quantifiable achievements`,
    );
  }

  // Check for metrics in experience
  const noMetricsExp = resume.experience.filter((e) =>
    !e.description.some((d) =>
      ["improved", "increased", "reduced", "grew", "%", "$"].some((k) =>
        d.toLowerCase().includes(k),
      ),
    ),
  );
  if (noMetricsExp.length > 0) {
    improvements.push(
      `Add quantifiable metrics and measurable results to experience descriptions`,
    );
  }

  // Check summary
  if (!resume.summary || resume.summary.trim().length < 100) {
    improvements.push(
      `Write a comprehensive professional summary highlighting relevant skills`,
    );
  }

  // Check for job title match in experience
  const jobTitleLower = jobDescription.title.toLowerCase();
  const hasRelatedRole = resume.experience.some((e) =>
    e.title.toLowerCase().includes(jobTitleLower.split(" ")[0]),
  );
  if (!hasRelatedRole && resume.experience.length > 0) {
    improvements.push(
      `Emphasize experience with roles similar to: ${jobDescription.title}`,
    );
  }

  return improvements.slice(0, 5);
}

let GEMINI_API_KEY = "";

try {
  GEMINI_API_KEY = (import.meta.env as any)?.VITE_GOOGLE_GEMINI_API_KEY || "";
} catch (e) {
  console.warn("[Gemini] Could not access import.meta.env:", e);
  GEMINI_API_KEY = "";
}

// Also try to get from window object if extension context
if (
  !GEMINI_API_KEY &&
  typeof window !== "undefined" &&
  (window as any).GEMINI_API_KEY
) {
  GEMINI_API_KEY = (window as any).GEMINI_API_KEY;
}

let client: GoogleGenerativeAI | null = null;

function handleExtensionContextError(error: any): Error {
  const errorMessage = error?.message || String(error);

  if (
    errorMessage.includes("Extension context invalidated") ||
    errorMessage.includes("chrome.runtime.lastError") ||
    errorMessage.includes("context invalidated")
  ) {
    return new Error(
      `Extension context invalidated error: ${errorMessage}. Please refresh the page and try again.`,
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function initGemini(): Promise<GoogleGenerativeAI> {
  if (client) return client;

  try {
    // Try to get API key from localStorage first
    let apiKey = GEMINI_API_KEY;
    if (!apiKey) {
      apiKey = await getApiKeyFromSettings();
    }

    if (!apiKey) {
      throw new Error(
        "Gemini API key not configured. Please set it in Settings (⚙️ button in top-right corner).",
      );
    }

    client = new GoogleGenerativeAI(apiKey);
    return client;
  } catch (error) {
    throw handleExtensionContextError(error);
  }
}

export interface TailoredResumeResult {
  jobData: JobDescription;
  tailoredResume: ResumeData;
  atsScore: ATSScore;
  summary: string;
}

export async function isJobPostingPage(pageContent: string): Promise<boolean> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // If content looks like HTML, clean it. Otherwise use as plain text
  let cleanContent = pageContent;
  if (pageContent.includes("<")) {
    cleanContent = pageContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ") // Remove HTML tags, keep content
      .replace(/\s+/g, " "); // Normalize whitespace
  }

  cleanContent = (cleanContent || "").substring(0, 12000); // Limit to first 12k chars for API limits

  // First, do simple keyword-based detection for fast filtering
  const lowerContent = cleanContent.toLowerCase();
  const jobKeywords = [
    "job posting",
    "job description",
    "job title",
    "job for you",
    "responsibilities",
    "requirements",
    "qualifications",
    "apply now",
    "apply here",
    "position",
    "role",
    "hiring",
    "we are hiring",
    "open position",
    "experience required",
    "skills needed",
    "salary",
    "location",
    "required skills",
    "nice to have",
    "about the job",
    "about the role",
  ];

  const keywordMatches = jobKeywords.filter((kw) =>
    lowerContent.includes(kw),
  ).length;

  // If very few keyword matches, likely not a job posting
  // Be lenient - Naukri and other sites may use different keywords
  if (keywordMatches < 1 && !lowerContent.includes("job")) {
    console.log(
      "[isJobPostingPage] Fast filter detected non-job page (keyword matches:",
      keywordMatches,
      ")",
    );
    return false;
  }

  const prompt = `Quickly determine: Is this a job posting page?

  Look for ANY of these:
  - Job title (role, position name)
  - Company hiring info
  - Job description/responsibilities
  - "Requirements" or "Qualifications" section
  - "Apply" button or application info
  - Salary, location, or job type info

  Answer "yes" only if there's clear job posting content. Answer "no" for job listing sites, career pages listing many jobs, or non-job pages.

  Page Content:
  ${cleanContent}

  Answer with: {"isJobPosting": true} or {"isJobPosting": false}`;

  try {
    console.log(
      "[isJobPostingPage] Checking if page is a job posting...",
      cleanContent.length,
      "chars",
    );

    if (!cleanContent || cleanContent.trim().length === 0) {
      console.warn("[isJobPostingPage] Empty content provided");
      return false;
    }

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    console.log(
      "[isJobPostingPage] Gemini response:",
      text ? text.substring(0, 200) : text,
    );

    if (!text) {
      console.error("[isJobPostingPage] Empty response from Gemini");
      return false;
    }

    // More lenient JSON parsing
    let isPosting = false;

    // Check if response contains "true"
    if (
      text.toLowerCase().includes('"true"') ||
      text.toLowerCase().includes(": true")
    ) {
      isPosting = true;
    } else if (
      text.toLowerCase().includes("yes") &&
      !text.toLowerCase().includes("no")
    ) {
      isPosting = true;
    }

    // Try strict JSON parsing as fallback
    if (!isPosting) {
      try {
        const parsed = JSON.parse(text);
        isPosting = Boolean(parsed.isJobPosting || parsed.is_job_posting);
      } catch (e) {
        // Try to extract JSON from text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            isPosting = Boolean(parsed.isJobPosting || parsed.is_job_posting);
          } catch (innerError) {
            console.warn(
              "[isJobPostingPage] Could not parse JSON, checking text content",
            );
          }
        }
      }
    }

    console.log(
      "[isJobPostingPage] Result:",
      isPosting,
      "(keywords:",
      keywordMatches,
      ")",
    );
    return isPosting;
  } catch (error) {
    console.error("[isJobPostingPage] Error detecting job posting:", error);
    if (error instanceof Error) {
      console.error("[isJobPostingPage] Error message:", error.message);
    }
    // Fallback: use keyword-based detection - be lenient
    console.log(
      "[isJobPostingPage] Using keyword fallback, matches:",
      keywordMatches,
    );
    return keywordMatches >= 2;
  }
}

export async function parseJobFromHTML(
  pageContent: string,
): Promise<JobDescription | null> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // If content looks like HTML, clean it. Otherwise use as plain text
  let cleanContent = pageContent;
  if (pageContent.includes("<")) {
    cleanContent = pageContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
      .replace(/<[^>]+>/g, " ") // Remove HTML tags, keep content
      .replace(/\s+/g, " "); // Normalize whitespace
  }

  cleanContent = (cleanContent || "").substring(0, 16000); // Limit to first 16k chars for API limits

  const prompt = `Extract job posting information from this page content.

Return valid JSON with this structure:
{
  "title": "job title or position name",
  "company": "company or organization name",
  "location": "location if available",
  "description": "job description and responsibilities combined",
  "requirements": ["requirement 1", "requirement 2"],
  "skills": ["skill 1", "skill 2"]
}

Instructions:
- Extract actual job title (e.g., "Senior Software Engineer")
- Find company name or organization
- Include location if mentioned
- Combine description and responsibilities
- Extract 3+ key requirements
- Extract 3+ important skills

If information is missing, use empty strings or arrays.
Return ONLY raw JSON, no markdown or extra text.

Page Content:
${cleanContent}`;

  try {
    console.log(
      "[parseJobFromHTML] Sending content to Gemini for parsing...",
      cleanContent.length,
      "chars",
    );

    if (!cleanContent || cleanContent.trim().length === 0) {
      console.warn("[parseJobFromHTML] Empty content provided");
      return null;
    }

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    console.log(
      "[parseJobFromHTML] Gemini response:",
      text ? text.substring(0, 300) : text,
    );

    if (!text) {
      console.error("[parseJobFromHTML] Empty response from Gemini");
      return null;
    }

    // Try to extract JSON from response
    let parsed;

    // First, try to parse as direct JSON
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Try to find JSON object in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (innerE) {
          console.error(
            "[parseJobFromHTML] Failed to parse extracted JSON:",
            innerE,
          );
          console.error(
            "[parseJobFromHTML] Response was:",
            text ? text.substring(0, 500) : text,
          );
          return null;
        }
      } else {
        console.error(
          "[parseJobFromHTML] No JSON found in response:",
          text ? text.substring(0, 500) : text,
        );
        return null;
      }
    }

    // Validate that we have meaningful job data
    const title = (parsed.title || "").trim();
    const description = (parsed.description || "").trim();

    console.log("[parseJobFromHTML] Extracted title:", title);
    console.log(
      "[parseJobFromHTML] Extracted description length:",
      description.length,
    );

    // If no title or description, it's likely not a valid job posting
    if (
      !title ||
      !description ||
      title === "Unknown Position" ||
      description.length < 20
    ) {
      console.log(
        "[parseJobFromHTML] Parsed data looks incomplete - likely not a job posting",
        { title, descLength: description.length },
      );
      return null;
    }

    const result_obj: JobDescription = {
      title: title,
      company: (parsed.company || "Unknown Company").trim(),
      location: (parsed.location || "").trim(),
      description: description,
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements
            .filter((r: string) => r && r.trim())
            .map((r: string) => r.trim())
        : [],
      skills: Array.isArray(parsed.skills)
        ? parsed.skills
            .filter((s: string) => s && s.trim())
            .map((s: string) => s.trim())
        : [],
      extractedAt: new Date(),
    };

    console.log(
      "[parseJobFromHTML] Successfully parsed job description:",
      result_obj.title,
      "at",
      result_obj.company,
    );
    return result_obj;
  } catch (error) {
    console.error("[parseJobFromHTML] Error parsing job from HTML:", error);
    return null;
  }
}

export async function analyzeMasterResume(resume: ResumeData): Promise<string> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Analyze this resume and provide a concise summary of key strengths and areas:
  
  Contact: ${resume.contact.name} - ${resume.contact.email}
  Summary: ${resume.summary || "No summary"}
  Skills: ${resume.skills.join(", ")}
  
  Experience:
  ${resume.experience.map((e) => `${e.title} at ${e.company} (${e.startDate} - ${e.endDate || "Present"})`).join("\n")}
  
  Education:
  ${resume.education.map((e) => `${e.degree} in ${e.field} from ${e.institution} (${e.graduationDate})`).join("\n")}
  
  Provide a 2-3 sentence analysis of this candidate's profile.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function extractJobRequirements(
  jobDescription: string,
): Promise<JobDescription> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Extract job info from this description:
${jobDescription}

Return ONLY valid JSON:
{
  "title": "job title",
  "company": "company name",
  "location": "location",
  "requirements": ["requirement1", "requirement2"],
  "skills": ["skill1", "skill2"]
}`;

  try {
    const text = await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Error parsing job requirements:", e);
  }

  return {
    title: "Unknown Position",
    company: "Unknown Company",
    description: jobDescription,
    requirements: [],
    skills: [],
  };
}

export async function tailorResumeForJob(
  masterResume: ResumeData,
  jobDescription: JobDescription,
  configuredSections?: string[],
): Promise<ResumeData> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const jobSkills =
    (Array.isArray(jobDescription.skills)
      ? jobDescription.skills.join(", ")
      : "") ||
    (jobDescription.description
      ? jobDescription.description.substring(0, 500)
      : "");
  const jobRequirements =
    (Array.isArray(jobDescription.requirements)
      ? jobDescription.requirements.join(", ")
      : "") ||
    (jobDescription.description
      ? jobDescription.description.substring(0, 300)
      : "");

  const prompt = `Tailor this resume for MAXIMUM ATS compatibility and impact for: ${jobDescription.title} at ${jobDescription.company}

CRITICAL JOB REQUIREMENTS:
- Title: ${jobDescription.title}
- Company: ${jobDescription.company}
- Required Skills: ${jobSkills}
- Key Requirements: ${jobRequirements}

CANDIDATE RESUME:
- Name: ${masterResume.contact.name}
- Skills: ${masterResume.skills.join(", ")}
- Experience: ${masterResume.experience.map((e) => `${e.title} at ${e.company}`).join(" | ")}
${masterResume.projects && masterResume.projects.length > 0 ? `- Projects: ${masterResume.projects.map((p) => `${p.title} (${p.technologies?.join(", ")})`).join(" | ")}` : ""}

RETURN ONLY VALID JSON:
{
  "tailoredSummary": "2-3 sentence summary highlighting the candidate's most relevant and directly applicable experience for this specific role. Must mention key skills from job posting.",
  "tailoredExperience": [{"jobTitle": "original job title", "newBullets": ["highly specific, impact-driven bullet with quantifiable metrics (numbers, %, improved, achieved, etc.)", "second bullet incorporating specific job keywords and demonstrating relevant skill application", "third bullet showing direct alignment with job requirements"]}],
  "tailoredProjects": [{"title": "project title", "newDescription": "3-4 detailed sentences describing: (1) what problem the project solved, (2) the technologies used especially those matching job requirements, (3) measurable impact/results with specific metrics"}],
  "recommendedSkillsOrder": ["most relevant skill to job posting", "second most relevant skill", "third most relevant skill"]
}

TAILORING REQUIREMENTS:
- Each experience bullet must include quantifiable metrics (%, numbers, improved, achieved, scaled, etc.)
- Incorporate job keywords naturally into experience descriptions
- Projects must have 3-4 substantial sentences with specific technologies mentioned in job posting
- Skills must be ordered by relevance to the job, with most relevant first
- Summary must clearly connect candidate's experience to job requirements
- Focus on specific achievements and results, not generic responsibilities
- Every element should demonstrate direct fit for this specific role`;

  try {
    // Main tailor prompt with retry logic
    const mainResult = await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    let parsed;
    try {
      parsed = JSON.parse(mainResult);
    } catch (e) {
      const jsonMatch = mainResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON in response");
      }
    }

    const tailoredResume: ResumeData = {
      ...masterResume,
      summary: parsed.tailoredSummary || masterResume.summary,
      experience: masterResume.experience.map((exp) => {
        const tailored = parsed.tailoredExperience?.find(
          (t: any) => t.jobTitle?.toLowerCase() === exp.title.toLowerCase(),
        );
        return {
          ...exp,
          description:
            tailored?.newBullets && Array.isArray(tailored.newBullets)
              ? tailored.newBullets
              : exp.description,
        };
      }),
      projects: masterResume.projects?.map((proj) => {
        const tailored = parsed.tailoredProjects?.find(
          (t: any) => t.title?.toLowerCase() === proj.title.toLowerCase(),
        );
        return {
          ...proj,
          description:
            tailored?.newDescription &&
            typeof tailored.newDescription === "string" &&
            tailored.newDescription.trim()
              ? tailored.newDescription
              : proj.description,
        };
      }),
      skills:
        parsed.recommendedSkillsOrder &&
        Array.isArray(parsed.recommendedSkillsOrder)
          ? parsed.recommendedSkillsOrder.filter((s: string) =>
              masterResume.skills.includes(s),
            )
          : masterResume.skills,
    };

    // Generate all custom sections in ONE API call (batch) instead of multiple calls
    if (configuredSections && configuredSections.length > 0) {
      const sectionsTemplate = configuredSections
        .map(
          (section) =>
            `"${section}": "3-4 sentences relevant to ${jobDescription.title}"`,
        )
        .join(", ");

      const customSectionsPrompt = `Generate compelling custom resume sections tailored to this job opportunity.

Job: ${jobDescription.title} at ${jobDescription.company}
Required Skills: ${jobSkills}
Candidate: ${masterResume.contact.name}
Experience: ${masterResume.experience.map((e) => `${e.title} at ${e.company}`).join(" | ")}
Education: ${masterResume.education.map((e) => `${e.degree} in ${e.field}`).join(" | ")}

Generate 3-4 sentence content for each section that directly relates to the job requirements and showcases the candidate's relevant strengths:

Return ONLY valid JSON:
{
  "sections": {
    ${sectionsTemplate}
  }
}

Requirements:
- Each section should contain 3-4 substantial sentences (not generic text)
- Content must be specific to the candidate's background and the job requirements
- Use concrete examples from their experience where applicable
- Avoid placeholder text or generic resume language`;

      try {
        const customResult = await retryWithBackoff(async () => {
          const result = await model.generateContent(customSectionsPrompt);
          return result.response.text().trim();
        });

        let customParsed;
        try {
          customParsed = JSON.parse(customResult);
        } catch (e) {
          const jsonMatch = customResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            customParsed = JSON.parse(jsonMatch[0]);
          }
        }

        if (customParsed?.sections) {
          const customSections: Record<string, string> = {};
          for (const [sectionName, content] of Object.entries(
            customParsed.sections,
          )) {
            const contentStr = String(content).trim();
            if (contentStr && contentStr.length > 0 && contentStr !== "null") {
              customSections[sectionName] = contentStr;
            }
          }
          if (Object.keys(customSections).length > 0) {
            tailoredResume.customSections = customSections;
          }
        }
      } catch (err) {
        console.warn("Failed to generate custom sections:", err);
      }
    }

    return tailoredResume;
  } catch (error) {
    console.error("Error tailoring resume:", error);
    return masterResume;
  }
}

export async function analyzeJobAndTailorResume(
  pageHTML: string,
  masterResume: ResumeData,
  configuredSections?: string[],
): Promise<TailoredResumeResult> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Clean HTML
  let cleanHTML = (pageHTML || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .substring(0, 24000); // Use more content for better parsing

  const resumeText = JSON.stringify(
    {
      name: masterResume.contact.name,
      email: masterResume.contact.email,
      summary: masterResume.summary,
      skills: masterResume.skills,
      experience: masterResume.experience.map((e) => ({
        title: e.title,
        company: e.company,
        duration: `${e.startDate} - ${e.endDate || "Present"}`,
        description: e.description,
      })),
      education: masterResume.education.map((e) => ({
        degree: e.degree,
        field: e.field,
        institution: e.institution,
        graduation: e.graduationDate,
      })),
      projects: masterResume.projects?.map((p) => ({
        title: p.title,
        description: p.description,
        technologies: p.technologies,
      })),
    },
    null,
    2,
  );

  const prompt = `Extract job details and tailor resume for maximum ATS matching. Return valid JSON:
{
  "jobTitle": "title",
  "company": "company",
  "location": "location or 'Not specified'",
  "jobDescription": "full job description from page",
  "requirements": ["requirement1", "requirement2"],
  "skills": ["skill1", "skill2"],
  "tailoredSummary": "2-3 sentence summary emphasizing relevant experience for this specific job",
  "tailoredExperience": [{"position": "original job title", "newBullets": ["bullet1 with metrics", "bullet2 with keywords"]}],
  "tailoredProjects": [{"title": "project title", "newDescription": "3-4 sentences describing project impact, technologies used relevant to job, and measurable results"}],
  "tailoredSkillsOrder": ["most relevant skill", "second most relevant"],
  "atsScore": 0-100,
  "atsMatchPercentage": 0-100,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1"],
  "improvements": ["improvement1"],
  "jobSummary": "summary with match percentage"
}

Instructions for ATS Scoring:
- Extract ALL job skills and requirements from the posting (be thorough, aim for 15+ keywords)
- Calculate ATS score CAREFULLY:
  * Base score on skill match percentage (primary factor)
  * Add bonus points if experience has metrics/numbers (improved, increased, %, $)
  * Add bonus points for job title relevance in experience
  * Ensure minimum score of 20 (every tailored resume is better than untailored)
  * For well-tailored resumes (4+ relevant experience bullets, 2+ custom sections, clear skill alignment): score should be 75-85+
  * For excellent tailored resumes (5+ experience bullets with metrics, multiple projects, strong summary): score should be 80-90+
- For tailoredProjects: provide 3-4 detailed sentences describing project impact, relevant technologies, and quantified results
- For tailoredExperience: write impact-driven bullets with metrics where possible, incorporate job keywords naturally
- Order skills by relevance to job posting
- atsMatchPercentage should reflect percentage of job keywords found in tailored resume

Job posting:
${cleanHTML}

Resume:
${resumeText}`;

  try {
    console.log("[Gemini] Analyzing job and tailoring resume...");

    const text = await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    console.log("[Gemini] Response received, parsing...");

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON in response");
      }
    }

    // Build job description object
    const jobData: JobDescription = {
      title: parsed.jobTitle || "Unknown Position",
      company: parsed.company || "Unknown Company",
      location: parsed.location || "",
      description: parsed.jobDescription || "",
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements.filter((r: string) => r && r.trim())
        : [],
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.filter((s: string) => s && s.trim())
        : [],
      extractedAt: new Date(),
    };

    // Build tailored resume
    const tailoredResume: ResumeData = {
      ...masterResume,
      summary: parsed.tailoredSummary || masterResume.summary,
      experience: masterResume.experience.map((exp) => {
        const tailored = Array.isArray(parsed.tailoredExperience)
          ? parsed.tailoredExperience.find(
              (t: any) =>
                t.position?.toLowerCase() === exp.title.toLowerCase() ||
                t.position?.toLowerCase().includes(exp.title.toLowerCase()),
            )
          : null;

        return {
          ...exp,
          description:
            tailored?.newBullets && Array.isArray(tailored.newBullets)
              ? tailored.newBullets.filter((b: string) => b && b.trim())
              : exp.description,
        };
      }),
      projects: masterResume.projects?.map((proj) => {
        const tailored = Array.isArray(parsed.tailoredProjects)
          ? parsed.tailoredProjects.find(
              (t: any) => t.title?.toLowerCase() === proj.title.toLowerCase(),
            )
          : null;

        return {
          ...proj,
          description:
            tailored?.newDescription &&
            typeof tailored.newDescription === "string" &&
            tailored.newDescription.trim()
              ? tailored.newDescription
              : proj.description,
        };
      }),
      skills: Array.isArray(parsed.tailoredSkillsOrder)
        ? parsed.tailoredSkillsOrder.filter((s: string) =>
            masterResume.skills.some(
              (ms) => ms.toLowerCase() === s.toLowerCase(),
            ),
          )
        : masterResume.skills,
    };

    // Get configured custom sections from settings and generate them
    let sectionsToGenerate = configuredSections;

    console.log(
      "[Gemini] analyzeJobAndTailorResume - Received configuredSections:",
      JSON.stringify(configuredSections),
    );
    console.log(
      "[Gemini] configuredSections type:",
      Array.isArray(configuredSections) ? "array" : typeof configuredSections,
    );
    console.log(
      "[Gemini] configuredSections length:",
      configuredSections ? configuredSections.length : "null",
    );

    // If not provided as parameter, try to load from settings
    if (!sectionsToGenerate || sectionsToGenerate.length === 0) {
      console.log(
        "[Gemini] No sections from parameter, trying to load from settings...",
      );
      let appSettings: any = null;
      try {
        appSettings = await getSettings();
        console.log(
          "[Gemini] Settings loaded from storage:",
          JSON.stringify(appSettings),
        );
      } catch (e) {
        console.error(
          "[Gemini] Error loading settings for custom sections:",
          e,
        );
      }
      sectionsToGenerate = appSettings?.resumeContentSections || [];
      console.log(
        "[Gemini] Sections from settings:",
        JSON.stringify(sectionsToGenerate),
      );
    }

    console.log(
      "[Gemini] Final sectionsToGenerate:",
      JSON.stringify(sectionsToGenerate),
    );
    console.log(
      "[Gemini] sectionsToGenerate length:",
      sectionsToGenerate ? sectionsToGenerate.length : 0,
    );

    if (sectionsToGenerate && sectionsToGenerate.length > 0) {
      console.log(
        "[Gemini] Generating custom sections:",
        JSON.stringify(sectionsToGenerate),
      );

      const jobSkills = Array.isArray(jobData.skills)
        ? jobData.skills.join(", ")
        : "";

      const sectionsTemplate = sectionsToGenerate
        .map(
          (section) =>
            `"${section}": "3-4 sentences relevant to ${jobData.title}"`,
        )
        .join(", ");

      const customSectionsPrompt = `Generate compelling resume content for custom sections tailored to this job opportunity.

Job: ${jobData.title} at ${jobData.company}
Skills needed: ${jobSkills}
Job requirements: ${Array.isArray(jobData.requirements) ? jobData.requirements.join(", ") : ""}
Candidate: ${masterResume.contact.name}
Experience: ${masterResume.experience.map((e) => `${e.title} at ${e.company}`).join(" | ")}
Education: ${masterResume.education.map((e) => `${e.degree} in ${e.field}`).join(" | ")}

Generate 3-4 sentence content for each section that aligns with the job requirements and showcases relevant experience:

Return ONLY valid JSON:
{
  "sections": {
    ${sectionsTemplate}
  }
}

Important: Each section content should be specific, substantial (3-4 sentences), and demonstrate how the candidate's background aligns with the job requirements.`;

      try {
        const customResult = await retryWithBackoff(async () => {
          const result = await model.generateContent(customSectionsPrompt);
          return result.response.text().trim();
        });

        let customParsed;
        try {
          customParsed = JSON.parse(customResult);
        } catch (e) {
          const jsonMatch = customResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            customParsed = JSON.parse(jsonMatch[0]);
          }
        }

        if (customParsed?.sections) {
          console.log(
            "[Gemini] Parsed custom sections:",
            JSON.stringify(customParsed.sections),
          );
          const customSections: Record<string, string> = {};
          for (const [sectionName, content] of Object.entries(
            customParsed.sections,
          )) {
            const contentStr = String(content).trim();
            if (contentStr && contentStr.length > 0 && contentStr !== "null") {
              customSections[sectionName] = contentStr;
              console.log(
                `[Gemini] Added custom section "${sectionName}": ${contentStr.substring(0, 100)}...`,
              );
            }
          }
          console.log(
            "[Gemini] Total custom sections added:",
            Object.keys(customSections).length,
          );
          if (Object.keys(customSections).length > 0) {
            tailoredResume.customSections = customSections;
            console.log(
              "[Gemini] ✓ Custom sections assigned to tailoredResume:",
              JSON.stringify(customSections),
            );
          }
        } else {
          console.warn(
            "[Gemini] customParsed has no sections property:",
            JSON.stringify(customParsed),
          );
        }
      } catch (err) {
        console.error("[Gemini] Failed to generate custom sections:", err);
      }
    } else {
      console.log(
        "[Gemini] Skipping custom section generation - no sections configured",
      );
    }

    // Build ATS score for tailored resume
    const atsScore: ATSScore = {
      score: Math.min(100, Math.max(0, parsed.atsScore || 0)),
      matchPercentage: Math.min(
        100,
        Math.max(0, parsed.atsMatchPercentage || 0),
      ),
      keywordMatches: (Array.isArray(parsed.matchedKeywords)
        ? parsed.matchedKeywords
        : []
      ).filter((k: string) => k && k.trim()),
      missingKeywords: (Array.isArray(parsed.missingKeywords)
        ? parsed.missingKeywords
        : []
      ).filter((k: string) => k && k.trim()),
      improvements: (Array.isArray(parsed.improvements)
        ? parsed.improvements
        : []
      ).filter((i: string) => i && i.trim()),
    };

    // Calculate ATS score for master resume
    const masterAtsScore = calculateATSScore(masterResume, jobData);
    console.log("[Gemini] Master resume ATS score:", masterAtsScore.score, "%");
    console.log("[Gemini] Tailored resume ATS score:", atsScore.score, "%");

    const summary =
      parsed.jobSummary ||
      `Match: ${atsScore.score}% for ${jobData.title} at ${jobData.company}`;

    return {
      jobData,
      tailoredResume,
      atsScore,
      masterAtsScore,
      summary,
    };
  } catch (error) {
    console.error("[Gemini] Error analyzing job and tailoring resume:", error);
    throw error;
  }
}
