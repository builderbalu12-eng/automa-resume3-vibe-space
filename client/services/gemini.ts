import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResumeData, JobDescription, ATSScore } from "@/types";

let GEMINI_API_KEY = "";

try {
  GEMINI_API_KEY = (import.meta.env as any)?.VITE_GOOGLE_GEMINI_API_KEY || "";
} catch (e) {
  console.warn("[Gemini] Could not access import.meta.env:", e);
  GEMINI_API_KEY = "";
}

let client: GoogleGenerativeAI | null = null;

function initGemini(): GoogleGenerativeAI {
  if (client) return client;
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key not configured. Set VITE_GOOGLE_GEMINI_API_KEY in .env",
    );
  }
  client = new GoogleGenerativeAI(GEMINI_API_KEY);
  return client;
}

export async function isJobPostingPage(pageContent: string): Promise<boolean> {
  const genAI = initGemini();
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

  cleanContent = cleanContent.substring(0, 12000); // Limit to first 12k chars for API limits

  const prompt = `Analyze this page content and determine if it contains a job posting.

  Look for indicators such as:
  - Job title, position name, or role (like "Software Engineer", "Data Scientist", "Product Manager")
  - Company name or organization
  - Job description or detailed responsibilities section
  - Requirements or qualifications section
  - Salary, location, or employment type information
  - Keywords like "apply", "apply now", "join us", "hiring", "open position", "we're hiring"
  - Benefits or job details section
  - Experience level required

  Return ONLY a valid JSON object with:
  {
    "isJobPosting": true or false,
    "confidence": number between 0-1 (how confident you are)
  }

  Only return "true" if this is clearly a single job posting page with actual job details. Return "false" for:
  - Job listing aggregator pages (showing multiple jobs)
  - Company career pages listing many jobs
  - Non-job pages that mention jobs
  - Blog posts or articles about jobs
  - Generic pages

  Return only the JSON object, nothing else.

  Page Content:
  ${cleanContent}`;

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

    console.log("[isJobPostingPage] Gemini response:", text.substring(0, 200));

    if (!text) {
      console.error("[isJobPostingPage] Empty response from Gemini");
      return false;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          console.error("[isJobPostingPage] Failed to parse JSON:", innerError);
          console.error("[isJobPostingPage] Response was:", text.substring(0, 500));
          return false;
        }
      } else {
        console.error("[isJobPostingPage] No JSON found in response:", text.substring(0, 500));
        return false;
      }
    }

    const isPosting = Boolean(parsed.isJobPosting);
    const confidence = parsed.confidence || 0;
    console.log(
      `[isJobPostingPage] Result: ${isPosting} (confidence: ${confidence})`,
    );
    return isPosting;
  } catch (error) {
    console.error("[isJobPostingPage] Error detecting job posting:", error);
    if (error instanceof Error) {
      console.error("[isJobPostingPage] Error message:", error.message);
    }
    return false;
  }
}

export async function parseJobFromHTML(
  pageContent: string,
): Promise<JobDescription | null> {
  const genAI = initGemini();
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

  cleanContent = cleanContent.substring(0, 16000); // Limit to first 16k chars for API limits

  const prompt = `You are an expert at extracting job posting information from web pages.

  Analyze this page content and extract all job posting details. Look for sections like job title, company, location, description, requirements, and required skills.

  Return ONLY a valid JSON object (no markdown, no code blocks, just raw JSON) with this exact structure:
  {
    "title": "the job title or position name",
    "company": "the company name",
    "location": "location if available, or empty string",
    "description": "the full job description and responsibilities combined into one paragraph",
    "requirements": ["requirement 1", "requirement 2", "requirement 3"],
    "skills": ["technical skill 1", "technical skill 2", "soft skill 1", "soft skill 2"]
  }

  Instructions:
  - Extract the actual job title (e.g., "Senior Software Engineer", not just "Job")
  - Find and include the company or organization name
  - Include location/city if mentioned anywhere
  - Combine all job description and responsibilities into one description field
  - Extract 3-5 key requirements and qualifications
  - Extract 4-6 important skills (mix of technical and soft skills)
  - If information is not found, use empty string or empty array
  - Return ONLY the JSON object, nothing else - no markdown, no extra text
  - Be very literal in extracting actual text from the page

  Page Content to analyze:
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

    console.log("[parseJobFromHTML] Gemini response:", text.substring(0, 300));

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
          console.error("[parseJobFromHTML] Response was:", text.substring(0, 500));
          return null;
        }
      } else {
        console.error("[parseJobFromHTML] No JSON found in response:", text.substring(0, 500));
        return null;
      }
    }

    // Validate that we have meaningful job data
    const title = (parsed.title || "").trim();
    const description = (parsed.description || "").trim();

    console.log("[parseJobFromHTML] Extracted title:", title);
    console.log("[parseJobFromHTML] Extracted description length:", description.length);

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
  const genAI = initGemini();
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
  const genAI = initGemini();
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

  const result = await model.generateContent(prompt);
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
  const genAI = initGemini();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const jobSkills =
    jobDescription.skills.join(", ") ||
    jobDescription.description.substring(0, 500);
  const jobRequirements =
    jobDescription.requirements.join(", ") ||
    jobDescription.description.substring(0, 300);

  const prompt = `You are an expert resume optimizer. Tailor this resume to match this specific job posting.

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
    const result = await model.generateContent(prompt);
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
  const genAI = initGemini();
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
    `Description: ${jobDescription.description.substring(0, 500)}`,
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
    const result = await model.generateContent(prompt);
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
