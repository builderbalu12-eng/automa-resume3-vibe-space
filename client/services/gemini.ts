import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResumeData, JobDescription, ATSScore } from "@/types";
import {
  getApiKeyFromSettings,
  getSettings,
  DEFAULT_IMMUTABLE_SECTIONS,
} from "@/utils/storage";

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

async function initGemini(): Promise<GoogleGenerativeAI> {
  if (client) return client;

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
}

// Retry helper for transient Gemini/API errors (model overloaded, 503s, rate limits)
async function withRetry(
  fn: () => Promise<any>,
  retries = 3,
  initialDelay = 800,
) {
  let attempt = 0;
  let delay = initialDelay;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const msg = err && (err.message || String(err));
      const isTransient =
        msg &&
        (msg.includes("503") ||
          msg.toLowerCase().includes("overloaded") ||
          msg.toLowerCase().includes("temporarily unavailable") ||
          msg.toLowerCase().includes("rate limit") ||
          msg.toLowerCase().includes("server error"));
      if (!isTransient || attempt > retries) throw err;
      console.warn(
        `[Gemini] Transient error, retrying attempt ${attempt}/${retries} in ${delay}ms`,
        err,
      );
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

export interface TailoredResumeResult {
  jobData: JobDescription;
  tailoredResume: ResumeData;
  atsScore: ATSScore;
  summary: string;
  omittedSections?: string[];
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

    const result = await withRetry(() => model.generateContent(prompt));
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

    const result = await withRetry(() => model.generateContent(prompt));
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

  const result = await withRetry(() => model.generateContent(prompt));
  return result.response.text();
}

export async function extractJobRequirements(
  jobDescription: string,
): Promise<JobDescription> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Extract structured information from this job description. Return JSON with this format:
  {
    "title": "job title",
    "company": "company name",
    "location": "location",
    "requirements": ["requirement 1", "requirement 2", ...],
    "skills": ["skill 1", "skill 2", ...]
  }
  
  Job Description:
  ${jobDescription}`;

  const result = await withRetry(() => model.generateContent(prompt));
  const text = result.response.text();

  try {
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

  const settings = (await getSettings()) || {
    customInstructions: "",
    resumeContentSections: [],
  };
  const sectionsToInclude = Array.from(
    new Set([
      ...(settings.resumeContentSections || []),
      ...DEFAULT_IMMUTABLE_SECTIONS,
    ]),
  );
  const sectionsText = sectionsToInclude.join(", ");
  const customInstrText = settings.customInstructions?.trim()
    ? `Custom Instructions: ${settings.customInstructions}`
    : "";

  const prompt = `You are an expert resume optimizer. Tailor this resume to match this specific job posting.

  USER PREFERENCES:
  - Only include/tailor these sections: ${sectionsText}
  ${customInstrText}

  TARGET JOB:
  - Title: ${jobDescription.title}
  - Company: ${jobDescription.company}
  - Required Skills: ${jobSkills}
  - Requirements: ${jobRequirements}

  ORIGINAL RESUME:
  - Name: ${masterResume.contact.name}
  - Summary: ${masterResume.summary || "Professional with relevant experience"}
  - All Skills: ${masterResume.skills.join(", ")}

  - Experience:
  ${masterResume.experience.map((e, i) => `${i + 1}. ${e.title} at ${e.company} (${e.startDate}${e.endDate ? ` - ${e.endDate}` : ""}): ${e.description.join(" ")}`).join("\n\n")}

  TASK: Create a tailored version that:
  1. Rewrites the professional summary to highlight relevant experience for THIS job
  2. Reorders and rewrites experience bullets to emphasize skills matching the job
  3. Uses keywords from the job description naturally
  4. Maintains ATS-friendly formatting (standard keywords, no special characters)
  5. Keeps achievements and quantifiable results that are relevant

  Return ONLY a valid JSON object (no markdown, no code blocks):
  {
    "tailoredSummary": "2-3 sentence professional summary tailored for this specific job, highlighting most relevant experience",
    "tailoredExperience": [
      {"jobTitle": "job title from original resume", "newBullets": ["tailored bullet point 1", "tailored bullet point 2", "tailored bullet point 3"]},
      {"jobTitle": "another job title", "newBullets": ["bullet 1", "bullet 2"]}
    ],
    "recommendedSkillsOrder": ["most relevant skill 1", "relevant skill 2", "skill 3"]
  }`;

  try {
    const result = await withRetry(() => model.generateContent(prompt));
    const text = result.response.text().trim();

    console.log("Tailor response received, length:", text.length);

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
      skills:
        parsed.recommendedSkillsOrder &&
        Array.isArray(parsed.recommendedSkillsOrder)
          ? parsed.recommendedSkillsOrder.filter((s: string) =>
              masterResume.skills.includes(s),
            )
          : masterResume.skills,
    };

    return tailoredResume;
  } catch (error) {
    console.error("Error tailoring resume:", error);
    // Return original resume if tailoring fails
    return masterResume;
  }
}

export async function calculateATSScore(
  resume: ResumeData,
  jobDescription: JobDescription,
): Promise<ATSScore> {
  const genAI = await initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const resumeText = [
    resume.contact.name,
    resume.summary || "Professional",
    "Skills: " + resume.skills.join(", "),
    "Experience: " +
      resume.experience
        .map((e) => `${e.title} at ${e.company}: ${e.description.join(" ")}`)
        .join(" | "),
    "Education: " +
      resume.education
        .map((e) => `${e.degree} in ${e.field} from ${e.institution}`)
        .join(" | "),
  ].join("\n");

  const jobText = [
    `Job: ${jobDescription.title} at ${jobDescription.company}`,
    `Skills needed: ${jobDescription.skills.join(", ")}`,
    `Requirements: ${jobDescription.requirements.join(", ")}`,
    `Description: ${jobDescription.description ? jobDescription.description.substring(0, 500) : ""}`,
  ].join("\n");

  const prompt = `Analyze how well this resume matches the job posting for ATS (Applicant Tracking System) screening.

  RESUME:
  ${resumeText}

  JOB POSTING:
  ${jobText}

  Evaluate the match and return ONLY a valid JSON object (no markdown):
  {
    "score": number between 0-100 (how likely ATS will rank it high),
    "matchPercentage": number between 0-100 (percentage of job requirements matched),
    "matchedKeywords": ["keyword matched 1", "keyword matched 2", "keyword matched 3"],
    "missingKeywords": ["important missing keyword 1", "missing keyword 2"],
    "improvements": ["specific improvement 1", "specific improvement 2", "specific improvement 3"]
  }

  Be honest and practical in your assessment.`;

  try {
    const result = await withRetry(() => model.generateContent(prompt));
    const text = result.response.text().trim();

    console.log("ATS Score response received, length:", text.length);

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

    return {
      score: Math.min(100, Math.max(0, parsed.score || 0)),
      matchPercentage: Math.min(100, Math.max(0, parsed.matchPercentage || 0)),
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
  } catch (error) {
    console.error("Error calculating ATS score:", error);

    // Fallback: simple keyword matching
    const resumeStr = resumeText.toLowerCase();
    const jobKeywords = [
      ...jobDescription.skills,
      ...jobDescription.requirements,
    ].map((k) => k.toLowerCase());

    const matches = jobKeywords.filter((k) => resumeStr.includes(k));
    const matchPercentage = Math.round(
      (matches.length / jobKeywords.length) * 100,
    );

    return {
      score: Math.max(30, matchPercentage),
      matchPercentage: matchPercentage,
      keywordMatches: matches.slice(0, 5),
      missingKeywords: jobKeywords
        .filter((k) => !resumeStr.includes(k))
        .slice(0, 5),
      improvements: [
        "Add more relevant keywords from the job description",
        "Include specific technical skills mentioned in the job posting",
        "Quantify achievements with metrics and numbers",
      ],
    };
  }
}

export async function analyzeJobAndTailorResume(
  pageHTML: string,
  masterResume: ResumeData,
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
    },
    null,
    2,
  );

  const settings = (await getSettings()) || {
    customInstructions: "",
    resumeContentSections: [],
  };
  const sectionsToInclude = Array.from(
    new Set([
      ...(settings.resumeContentSections || []),
      ...DEFAULT_IMMUTABLE_SECTIONS,
    ]),
  );
  const sectionsText = sectionsToInclude.join(", ");
  const customInstrText = settings.customInstructions?.trim()
    ? `Custom Instructions: ${settings.customInstructions}`
    : "";

  const prompt = `You are an expert resume optimizer and job analyst.

USER PREFERENCES:
- Only include/tailor these sections: ${sectionsText}
${customInstrText}

IMPORTANT:
- Do NOT fabricate facts, certifications, or project details. Only generate content for a requested section if there is evidence in the master resume or the job posting that supports it. If you cannot confidently create a section, omit it and list it under "omittedSections" in the JSON.

TASK:
1. Extract job posting details from the page content
2. Tailor the provided resume for this specific job
3. Calculate ATS match score

PAGE CONTENT (job posting):
${cleanHTML}

MASTER RESUME:
${resumeText}

INSTRUCTIONS:
1. EXTRACT JOB DETAILS from the page content:
   - Find job title (exact position name)
   - Find company name
   - Find location if available
   - Extract key responsibilities and requirements
   - Extract required technical skills
   - Extract years of experience required if mentioned

2. TAILOR THE RESUME:
   - Rewrite professional summary to highlight most relevant experience for THIS job
   - Reorder experience entries by relevance to job requirements
   - Rewrite 3-4 bullet points for each relevant job position to match job keywords
   - Reorder skills list to prioritize job-required skills first
   - Maintain ATS-friendly formatting (no special characters, standard text)
   - Keep quantifiable achievements that are relevant to this job

3. CALCULATE ATS SCORE:
   - Rate how well the tailored resume matches the job (0-100)
   - Identify which keywords/skills matched
   - List missing important keywords
   - Suggest improvements

4. CREATE SUMMARY:
   - Write a short 2-3 sentence summary of the job and match

5. ADDITIONAL SECTIONS:
- If user requested extra sections, return them under "additionalSections" as an object where each key is the section name and the value is an array of strings (each string an item/line). If a section cannot be generated, include it under "omittedSections".

Return ONLY valid JSON (no markdown, no explanations):
{
  "jobTitle": "extracted job title",
  "company": "extracted company name",
  "location": "location or 'Not specified'",
  "jobDescription": "comprehensive job description combining responsibilities and requirements",
  "requirements": ["requirement 1", "requirement 2", ...],
  "skills": ["skill 1", "skill 2", ...],
  "tailoredSummary": "2-3 sentence professional summary tailored for this job",
  "tailoredExperience": [
    {"position": "exact job title from resume", "newBullets": ["bullet 1", "bullet 2", "bullet 3"]},
    ...
  ],
  "tailoredSkillsOrder": ["most relevant skill", "skill 2", ...],
  "atsScore": number between 0-100,
  "atsMatchPercentage": number between 0-100,
  "matchedKeywords": ["keyword 1", "keyword 2", ...],
  "missingKeywords": ["missing keyword 1", ...],
  "improvements": ["improvement 1", "improvement 2", ...],
  "jobSummary": "2-3 sentence summary of the job and how well the resume matches",
  "additionalSections": {"Section Name": ["item1","item2"]},
  "omittedSections": ["Section Name"]
}`;

  try {
    console.log("[Gemini] Analyzing job and tailoring resume...");

    const result = await withRetry(() => model.generateContent(prompt));
    const text = result.response.text().trim();

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
      skills: Array.isArray(parsed.tailoredSkillsOrder)
        ? parsed.tailoredSkillsOrder.filter((s: string) =>
            masterResume.skills.some(
              (ms) => ms.toLowerCase() === s.toLowerCase(),
            ),
          )
        : masterResume.skills,
    };

    // Map any additionalSections returned by the model into ResumeData
    const additional =
      parsed.additionalSections ||
      parsed.additionalsections ||
      parsed.additional ||
      {};
    const omittedFromModel = Array.isArray(parsed.omittedSections)
      ? parsed.omittedSections
      : Array.isArray(parsed.omittedsections)
        ? parsed.omittedsections
        : [];

    if (additional && typeof additional === "object") {
      Object.keys(additional).forEach((key) => {
        const normalized = key.toLowerCase().trim();
        const items = Array.isArray(additional[key])
          ? additional[key]
              .filter((i: any) => i && String(i).trim())
              .map((i: any) => String(i))
          : [];
        if (!items.length) return;

        if (normalized.includes("certif")) {
          tailoredResume.certifications = items;
        } else if (
          normalized.includes("achiev") ||
          normalized.includes("career") ||
          normalized.includes("accompl")
        ) {
          tailoredResume.achievements = items;
        } else if (
          normalized.includes("project") ||
          normalized.includes("course")
        ) {
          // Map string items to Project objects with description
          tailoredResume.projects = items.map((it: string) => ({
            title: "",
            description: it,
            technologies: [],
          }));
        } else if (normalized.includes("publication")) {
          tailoredResume.publications = items;
        } else if (normalized.includes("hobb")) {
          tailoredResume.hobbies = items;
        } else if (normalized.includes("skill")) {
          // merge into skills if not present
          items.forEach((it: string) => {
            if (
              !tailoredResume.skills.some(
                (s) => s.toLowerCase() === it.toLowerCase(),
              )
            ) {
              tailoredResume.skills.push(it);
            }
          });
        } else {
          // Unknown section: push into achievements as fallback
          tailoredResume.achievements = Array.from(
            new Set([...(tailoredResume.achievements || []), ...items]),
          );
        }
      });
    }

    // Build ATS score
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

    const summary =
      parsed.jobSummary ||
      `Match: ${atsScore.score}% for ${jobData.title} at ${jobData.company}`;

    // Determine which requested sections were omitted (no content after tailoring)
    const includedSectionsSet = new Set<string>();
    const checkIfPresent = (name: string) => {
      const n = name.toLowerCase();
      if (
        n.includes("summary") &&
        tailoredResume.summary &&
        tailoredResume.summary.trim()
      )
        return true;
      if (
        n.includes("skill") &&
        tailoredResume.skills &&
        tailoredResume.skills.length > 0
      )
        return true;
      if (
        n.includes("experience") &&
        tailoredResume.experience &&
        tailoredResume.experience.length > 0
      )
        return true;
      if (
        n.includes("education") &&
        tailoredResume.education &&
        tailoredResume.education.length > 0
      )
        return true;
      if (
        n.includes("project") &&
        tailoredResume.projects &&
        tailoredResume.projects.length > 0
      )
        return true;
      if (
        n.includes("certif") &&
        tailoredResume.certifications &&
        tailoredResume.certifications.length > 0
      )
        return true;
      if (
        (n.includes("achiev") ||
          n.includes("career") ||
          n.includes("accompl")) &&
        tailoredResume.achievements &&
        tailoredResume.achievements.length > 0
      )
        return true;
      if (
        n.includes("publication") &&
        tailoredResume.publications &&
        tailoredResume.publications.length > 0
      )
        return true;
      if (
        n.includes("hobb") &&
        tailoredResume.hobbies &&
        tailoredResume.hobbies.length > 0
      )
        return true;
      return false;
    };

    const omittedSections: string[] = [];
    // Use sectionsToInclude from earlier prompt construction if present
    try {
      (sectionsToInclude || []).forEach((sec) => {
        if (!checkIfPresent(sec)) omittedSections.push(sec);
      });
      // Also include model-declared omittedSections
      if (Array.isArray(omittedFromModel) && omittedFromModel.length) {
        omittedFromModel.forEach((s: string) => {
          if (!omittedSections.includes(s)) omittedSections.push(s);
        });
      }
    } catch (e) {
      // ignore
    }

    return {
      jobData,
      tailoredResume,
      atsScore,
      summary,
      omittedSections: omittedSections.length ? omittedSections : undefined,
    };
  } catch (error) {
    console.error("[Gemini] Error analyzing job and tailoring resume:", error);
    throw error;
  }
}
