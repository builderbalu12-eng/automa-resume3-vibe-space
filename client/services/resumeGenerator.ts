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

// Simple PDF generation by creating styled HTML and using browser's print-to-PDF
async function generatePDFFromHTML(htmlContent: string): Promise<Blob> {
  // Create a styled wrapper with print-friendly CSS
  const styledHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Resume</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background: white;
        }
        .resume {
          max-width: 8.5in;
          height: 11in;
          margin: auto;
          padding: 0.5in;
          background: white;
          box-shadow: 0 0 0 1px #ddd;
        }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .contact { font-size: 12px; margin-bottom: 16px; color: #666; }
        h2 {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 14px;
          margin-bottom: 8px;
          border-bottom: 2px solid #333;
          padding-bottom: 4px;
        }
        .section { margin-bottom: 12px; }
        .job { margin-bottom: 10px; }
        .job-title { font-weight: 600; font-size: 12px; }
        .company { font-size: 11px; color: #666; }
        .duration { font-size: 11px; color: #999; }
        .job-bullets { margin: 4px 0 0 20px; font-size: 11px; line-height: 1.4; }
        .job-bullets li { margin-bottom: 2px; }
        .skills { font-size: 11px; }
        .skills span {
          display: inline-block;
          background: #f0f0f0;
          padding: 2px 6px;
          margin: 2px;
          border-radius: 3px;
        }
        .education { font-size: 11px; margin-bottom: 8px; }
        .degree { font-weight: 600; }
        .institution { color: #666; }
        @media print {
          body { margin: 0; padding: 0; }
          .resume { max-width: 100%; height: auto; box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="resume">
        ${htmlContent}
      </div>
    </body>
    </html>
  `;

  // Convert HTML string to Blob
  const blob = new Blob([styledHTML], { type: "text/html" });
  return blob;
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

export async function downloadResume(
  resume: ResumeData,
  company: string,
  jobTitle: string,
): Promise<void> {
  const blob = await generateResumeDocx(resume, company, jobTitle);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `Resume_${company}_${jobTitle}_${today}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
