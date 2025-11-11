import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  UnderlineType,
  PageBreak,
  WidthType,
} from "docx";
import { ResumeData } from "@/types";

// Generate PDF by creating styled HTML and using browser's print functionality
async function generatePDFBlob(
  resume: ResumeData,
  company: string,
  jobTitle: string,
): Promise<Blob> {
  const { contact, summary, skills, experience, education, projects } = resume;

  // Build formatted HTML content for the resume
  let htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 8.5in;">
      <h1 style="margin: 0 0 4px 0; font-size: 28px; font-weight: 700;">${contact.name || "Resume"}</h1>
      <div style="font-size: 12px; margin-bottom: 16px; color: #666;">
        ${contact.email ? `<span>${contact.email}</span>` : ""}
        ${contact.phone ? `<span> • ${contact.phone}</span>` : ""}
        ${contact.location ? `<span> • ${contact.location}</span>` : ""}
        ${contact.linkedin ? `<span> • ${contact.linkedin}</span>` : ""}
      </div>
  `;

  if (summary?.trim()) {
    htmlContent += `
      <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 14px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">Professional Summary</h2>
      <p style="font-size: 11px; margin-bottom: 12px;">${summary}</p>
    `;
  }

  if (skills && skills.length > 0) {
    htmlContent += `
      <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 14px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">Skills</h2>
      <p style="font-size: 11px; margin-bottom: 12px;">${skills.join(" • ")}</p>
    `;
  }

  if (experience && experience.length > 0) {
    htmlContent += `
      <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 14px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">Professional Experience</h2>
    `;
    experience.forEach((exp) => {
      const dateRange =
        exp.endDate && !exp.isCurrentlyWorking
          ? `${exp.startDate} – ${exp.endDate}`
          : `${exp.startDate} – Present`;

      htmlContent += `
        <div style="margin-bottom: 10px;">
          <div style="font-weight: 600; font-size: 12px;">${exp.title}</div>
          <div style="font-size: 11px; color: #666;">${exp.company} | ${dateRange}</div>
          <ul style="margin: 4px 0 0 20px; font-size: 11px; line-height: 1.4;">
            ${exp.description.map((desc) => `<li style="margin-bottom: 2px;">${desc}</li>`).join("")}
          </ul>
        </div>
      `;
    });
  }

  if (education && education.length > 0) {
    htmlContent += `
      <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 14px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">Education</h2>
    `;
    education.forEach((edu) => {
      htmlContent += `
        <div style="font-size: 11px; margin-bottom: 8px;">
          <div style="font-weight: 600;">${edu.degree} in ${edu.field}</div>
          <div style="color: #666;">${edu.institution} | Graduated: ${edu.graduationDate}</div>
        </div>
      `;
    });
  }

  if (projects && projects.length > 0) {
    htmlContent += `
      <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 14px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px;">Projects</h2>
    `;
    projects.forEach((project) => {
      htmlContent += `
        <div style="font-size: 11px; margin-bottom: 8px;">
          <div style="font-weight: 600;">${project.title}</div>
          <div>${project.description}</div>
        </div>
      `;
    });
  }

  htmlContent += `
    </div>
  `;

  // Create styled HTML document
  const styledHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Resume - ${contact.name}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          width: 100%;
          height: 100%;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background: white;
          padding: 0;
          margin: 0;
        }
        @page {
          size: letter;
          margin: 0.5in;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.addEventListener('load', function() {
          window.print();
        });
      </script>
    </body>
    </html>
  `;

  // Return as Blob
  return new Blob([styledHTML], { type: "text/html;charset=utf-8" });
}

export async function generateResumeDocx(
  resume: ResumeData,
  company: string,
  jobTitle: string,
): Promise<Blob> {
  const { contact, summary, skills, experience, education, projects } = resume;

  const sections = [
    // Header with contact info
    new Paragraph({
      text: contact.name,
      bold: true,
      size: 28,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: [
        contact.email ? `${contact.email} • ` : "",
        contact.phone ? `${contact.phone} • ` : "",
        contact.location ? `${contact.location} • ` : "",
        contact.linkedin ? `LinkedIn: ${contact.linkedin}` : "",
      ]
        .filter(Boolean)
        .join(""),
      size: 20,
      spacing: { after: 400 },
    }),
  ];

  // Professional Summary
  if (summary?.trim()) {
    sections.push(
      new Paragraph({
        text: "PROFESSIONAL SUMMARY",
        bold: true,
        size: 24,
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: summary,
        size: 22,
        spacing: { after: 400 },
      }),
    );
  }

  // Skills
  if (skills.length > 0) {
    sections.push(
      new Paragraph({
        text: "SKILLS",
        bold: true,
        size: 24,
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: skills.join(" • "),
        size: 22,
        spacing: { after: 400 },
      }),
    );
  }

  // Experience
  if (experience.length > 0) {
    sections.push(
      new Paragraph({
        text: "PROFESSIONAL EXPERIENCE",
        bold: true,
        size: 24,
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { after: 200 },
      }),
    );

    experience.forEach((exp) => {
      const dateRange =
        exp.endDate && !exp.isCurrentlyWorking
          ? `${exp.startDate} – ${exp.endDate}`
          : `${exp.startDate} – Present`;

      sections.push(
        new Paragraph({
          text: exp.title,
          bold: true,
          size: 22,
          spacing: { after: 0 },
        }),
        new Paragraph({
          text: `${exp.company} | ${dateRange}`,
          italics: true,
          size: 20,
          spacing: { after: 200 },
        }),
      );

      exp.description.forEach((desc) => {
        sections.push(
          new Paragraph({
            text: desc,
            size: 22,
            spacing: { after: 100 },
            indent: { left: 720 },
          }),
        );
      });

      sections.push(
        new Paragraph({
          text: "",
          spacing: { after: 200 },
        }),
      );
    });
  }

  // Education
  if (education.length > 0) {
    sections.push(
      new Paragraph({
        text: "EDUCATION",
        bold: true,
        size: 24,
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { after: 200 },
      }),
    );

    education.forEach((edu) => {
      sections.push(
        new Paragraph({
          text: `${edu.degree} in ${edu.field}`,
          bold: true,
          size: 22,
          spacing: { after: 0 },
        }),
        new Paragraph({
          text: `${edu.institution} | Graduated: ${edu.graduationDate}`,
          italics: true,
          size: 20,
          spacing: { after: 400 },
        }),
      );
    });
  }

  // Projects
  if (projects && projects.length > 0) {
    sections.push(
      new Paragraph({
        text: "PROJECTS",
        bold: true,
        size: 24,
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { after: 200 },
      }),
    );

    projects.forEach((project) => {
      sections.push(
        new Paragraph({
          text: project.title,
          bold: true,
          size: 22,
          spacing: { after: 0 },
        }),
        new Paragraph({
          text: project.description,
          size: 22,
          spacing: { after: 200 },
        }),
      );
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
}

export async function generateResumePDF(resume: ResumeData): Promise<Blob> {
  const { contact, summary, skills, experience, education } = resume;

  // Build HTML content for the resume
  let htmlContent = `
    <h1>${contact.name}</h1>
    <div class="contact">
      ${contact.email ? `${contact.email}` : ""}
      ${contact.phone ? ` • ${contact.phone}` : ""}
      ${contact.location ? ` • ${contact.location}` : ""}
      ${contact.linkedin ? ` • ${contact.linkedin}` : ""}
    </div>
  `;

  if (summary?.trim()) {
    htmlContent += `
      <h2>Professional Summary</h2>
      <div class="section">${summary}</div>
    `;
  }

  if (skills && skills.length > 0) {
    htmlContent += `
      <h2>Skills</h2>
      <div class="skills section">
        ${skills.map((skill) => `<span>${skill}</span>`).join("")}
      </div>
    `;
  }

  if (experience && experience.length > 0) {
    htmlContent += `<h2>Professional Experience</h2>`;
    experience.forEach((exp) => {
      const dateRange =
        exp.endDate && !exp.isCurrentlyWorking
          ? `${exp.startDate} – ${exp.endDate}`
          : `${exp.startDate} – Present`;

      htmlContent += `
        <div class="job">
          <div class="job-title">${exp.title}</div>
          <div class="company">${exp.company}</div>
          <div class="duration">${dateRange}</div>
          <ul class="job-bullets">
            ${exp.description.map((desc) => `<li>${desc}</li>`).join("")}
          </ul>
        </div>
      `;
    });
  }

  if (education && education.length > 0) {
    htmlContent += `<h2>Education</h2>`;
    education.forEach((edu) => {
      htmlContent += `
        <div class="education">
          <div class="degree">${edu.degree} in ${edu.field}</div>
          <div class="institution">${edu.institution}</div>
          <div class="duration">Graduated: ${edu.graduationDate}</div>
        </div>
      `;
    });
  }

  return await generatePDFBlob(resume, "", "");
}

export async function downloadResume(
  resume: ResumeData,
  company: string,
  jobTitle: string,
): Promise<void> {
  const blob = await generateResumeDocx(resume, company, jobTitle);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  
  // Sanitize filename to avoid special characters
  const sanitizedCompany = (company || "Company").replace(/[/\\?%*:|"<>]/g, "");
  const sanitizedTitle = (jobTitle || "Position").replace(/[/\\?%*:|"<>]/g, "");
  
  a.href = url;
  a.download = `Resume_${sanitizedCompany}_${sanitizedTitle}_${today}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadResumePDF(
  resume: ResumeData,
  company: string,
  jobTitle: string,
): Promise<void> {
  const blob = await generatePDFBlob(resume, company, jobTitle);
  
  // Create a Blob with proper PDF mimetype
  const pdfBlob = new Blob([blob], { type: "application/pdf" });
  const url = URL.createObjectURL(pdfBlob);
  
  const a = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  
  // Sanitize filename to avoid special characters
  const sanitizedCompany = (company || "Company").replace(/[/\\?%*:|"<>]/g, "");
  const sanitizedTitle = (jobTitle || "Position").replace(/[/\\?%*:|"<>]/g, "");
  
  a.href = url;
  a.download = `Resume_${sanitizedCompany}_${sanitizedTitle}_${today}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}
