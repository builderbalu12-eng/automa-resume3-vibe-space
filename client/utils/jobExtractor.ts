import { JobDescription } from "@/types";

export function extractJobDescriptionFromDOM(): JobDescription | null {
  // LinkedIn job description (support multiple layouts)
  const linkedInTitle =
    document.querySelector("h2.show-more-less-html__title") ||
    document.querySelector("h1.top-card-layout__title") ||
    document.querySelector("h1.t-24");
  const linkedInCompany =
    document.querySelector('a[href*="company"]') ||
    document.querySelector("a.topcard__org-name-link") ||
    document.querySelector("a.topcard__flavor");
  const linkedInDescription =
    document.querySelector(".show-more-less-html__markup") ||
    document.querySelector(".jobs-description__content") ||
    document.querySelector(".jobs-description-content__text");

  if (linkedInTitle && linkedInDescription) {
    const descText = linkedInDescription.textContent || "";
    return {
      title: linkedInTitle.textContent || "Unknown",
      company: linkedInCompany?.textContent || "Unknown",
      description: descText,
      requirements: extractRequirements(descText),
      skills: extractSkills(descText),
      extractedAt: new Date(),
    };
  }

  // Indeed job description
  const indeedTitle = document.querySelector(
    "h1.jobsearch-JobInfoHeader-title",
  );
  const indeedCompany = document.querySelector("a[data-testid='company-name']");
  const indeedDescription = document.querySelector("[id='jobDescriptionText']");

  if (indeedTitle && indeedDescription) {
    return {
      title: indeedTitle.textContent || "Unknown",
      company: indeedCompany?.textContent || "Unknown",
      description: indeedDescription.textContent || "",
      requirements: extractRequirements(indeedDescription.textContent || ""),
      skills: extractSkills(indeedDescription.textContent || ""),
      extractedAt: new Date(),
    };
  }

  // Naukri job description - try multiple selector patterns as they update their structure
  const naukriSelectors = [
    { title: ".jd-header h1", desc: ".job-desc" },
    { title: "h1.jd-title", desc: "[data-cy='jd-desc']" },
    { title: "h1", desc: ".jobsectionwrap" },
    { title: "[data-cy='job-title']", desc: "[data-cy='job-description']" },
    { title: ".jdMainSection h1", desc: ".jdMainSection" },
    // Additional Naukri selectors for different page versions
    {
      title: "[data-cy='job-card-title']",
      desc: "[data-cy='job-card-description']",
    },
    { title: ".jobTitle", desc: ".jobDescription" },
    { title: ".job-title", desc: ".job-description-text" },
  ];

  for (const selector of naukriSelectors) {
    const naukriTitle = document.querySelector(selector.title);
    const naukriDescription = document.querySelector(selector.desc);

    if (
      naukriTitle?.textContent?.trim() &&
      naukriDescription?.textContent?.trim()
    ) {
      return {
        title: naukriTitle.textContent.trim() || "Unknown",
        company: "Unknown",
        description: naukriDescription.textContent.trim() || "",
        requirements: extractRequirements(naukriDescription.textContent || ""),
        skills: extractSkills(naukriDescription.textContent || ""),
        extractedAt: new Date(),
      };
    }
  }

  // Naukri-specific fallback: Look for job title in headers and description in main sections
  const allHeadings = document.querySelectorAll("h1, h2");
  let naukriTitle = "";

  for (const heading of allHeadings) {
    const text = heading.textContent?.trim() || "";
    // Skip navigation/generic headings
    if (
      text.length > 5 &&
      text.length < 200 &&
      !text.includes("Job") &&
      !text.includes("Naukri")
    ) {
      naukriTitle = text;
      break;
    }
  }

  // Try to find main job content area for description
  const mainContent = document.querySelector(
    "main, article, [role='main'], .job-content, .jobsectionwrap, .jdMainSection, .jobContainer, [class*='description']",
  );

  if (naukriTitle && mainContent?.textContent) {
    const contentText = mainContent.textContent.trim();
    if (contentText.length > 200) {
      return {
        title: naukriTitle || "Unknown",
        company: "Unknown",
        description: contentText,
        requirements: extractRequirements(contentText),
        skills: extractSkills(contentText),
        extractedAt: new Date(),
      };
    }
  }

  // Additional fallback: Try to extract from any visible text if basic selectors fail
  const h1 = document.querySelector("h1");
  const h2 = document.querySelector("h2");
  const fallbackMainContent = document.querySelector(
    "main, article, [role='main'], .job-content, .jobsectionwrap, .jdMainSection",
  );

  if (
    (h1?.textContent?.trim() || h2?.textContent?.trim()) &&
    fallbackMainContent?.textContent
  ) {
    const title =
      h1?.textContent?.trim() || h2?.textContent?.trim() || "Unknown";
    const contentText = fallbackMainContent.textContent.trim();
    if (contentText.length > 200) {
      return {
        title: title,
        company: "Unknown",
        description: contentText,
        requirements: extractRequirements(contentText),
        skills: extractSkills(contentText),
        extractedAt: new Date(),
      };
    }
  }

  // Glassdoor job description (support multiple layouts)
  const glassdoorTitle =
    document.querySelector('[data-test="jobTitle"]') ||
    document.querySelector('h1[data-test="jobTitle"]') ||
    document.querySelector("h1");
  const glassdoorCompany =
    document.querySelector('[data-test="companyName"]') ||
    document.querySelector('[data-test="employerName"]') ||
    document.querySelector(".employerName");
  const glassdoorDescription =
    document.querySelector('[data-test="JobDescription"]') ||
    document.querySelector('#JobDescriptionContainer') ||
    document.querySelector('.jobDescriptionContent');

  if (glassdoorTitle && glassdoorDescription) {
    const descText = glassdoorDescription.textContent || "";
    return {
      title: glassdoorTitle.textContent || "Unknown",
      company: glassdoorCompany?.textContent || "Unknown",
      description: descText,
      requirements: extractRequirements(descText),
      skills: extractSkills(descText),
      extractedAt: new Date(),
    };
  }

  return null;
}

export function extractRequirements(text: string): string[] {
  const requirements: string[] = [];

  const requirementsSection = text.match(
    /(?:requirement|skill|qualification|must have|should have)[\s\S]*?(?:nice to have|about|$)/i,
  );

  if (requirementsSection) {
    const bullets = requirementsSection[0].match(/[•\-*]\s+([^\n]+)/g) || [];
    bullets.forEach((bullet) => {
      const cleaned = bullet.replace(/^[•\-*]\s+/, "").trim();
      if (cleaned.length > 5) {
        requirements.push(cleaned);
      }
    });
  }

  return requirements;
}

export function extractSkills(text: string): string[] {
  const commonSkills = [
    "javascript",
    "typescript",
    "python",
    "java",
    "react",
    "vue",
    "angular",
    "node",
    "express",
    "mongodb",
    "postgres",
    "sql",
    "html",
    "css",
    "aws",
    "gcp",
    "azure",
    "docker",
    "kubernetes",
    "git",
    "rest api",
    "graphql",
    "agile",
    "scrum",
    "jira",
    "jenkins",
    "linux",
    "unix",
    "bash",
    "shell",
    "c++",
    "c#",
    "golang",
    "rust",
    "scala",
    "r",
    "matlab",
    "excel",
    "powerpoint",
    "word",
    "salesforce",
    "sap",
    "oracle",
    "tableau",
    "power bi",
    "tensorflow",
    "pytorch",
    "keras",
    "scikit-learn",
    "spark",
    "hadoop",
    "kafka",
    "rabbitmq",
    "redis",
    "elasticsearch",
    "mysql",
    "cassandra",
    "dynamodb",
    "firebase",
    "iot",
    "machine learning",
    "deep learning",
    "nlp",
    "computer vision",
    "data science",
    "data analysis",
    "big data",
    "etl",
    "api design",
    "microservices",
    "serverless",
    "ci/cd",
    "devops",
    "security",
    "encryption",
    "oauth",
    "jwt",
    "testing",
    "unit testing",
    "integration testing",
    "performance testing",
    "load testing",
  ];

  const lowerText = text.toLowerCase();
  const foundSkills = new Set<string>();

  commonSkills.forEach((skill) => {
    if (lowerText.includes(skill)) {
      foundSkills.add(skill);
    }
  });

  // Extract years of experience
  const yearsMatch = text.match(/(\d+)\+?\s*years?/gi);
  if (yearsMatch) {
    foundSkills.add(yearsMatch[0]);
  }

  return Array.from(foundSkills);
}

export function createJobExtractionButton(): HTMLElement {
  const button = document.createElement("button");
  button.id = "resumematch-extract-btn";
  button.textContent = "Analyse";
  button.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    z-index: 10000;
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  button.onmouseover = () => {
    button.style.transform = "translateY(-2px)";
    button.style.boxShadow = "0 6px 16px rgba(102, 126, 234, 0.6)";
  };

  button.onmouseout = () => {
    button.style.transform = "translateY(0)";
    button.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
  };

  return button;
}
