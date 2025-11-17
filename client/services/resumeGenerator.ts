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

// Load html2pdf from CDN and generate actual PDF
async function loadHtml2Pdf(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).html2pdf) {
      resolve((window as any).html2pdf);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => {
      resolve((window as any).html2pdf);
    };
    script.onerror = () => {
      reject(new Error("Failed to load html2pdf library"));
    };
    document.head.appendChild(script);
  });
}

// Generate proper PDF using html2pdf
async function generatePDFBlobProper(
  resume: ResumeData,
  company: string,
  jobTitle: string,
): Promise<Blob> {
  const { contact, summary, skills, experience, education, projects } = resume;

  // Build formatted HTML content
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.45; color: #333; padding: 20px; max-width:800px; margin:0 auto;">
      <h1 style="margin: 0 0 5px 0; font-size: 28px; font-weight: 700;">${
        contact.name || "Resume"
      }</h1>
      <div style="font-size: 12px; margin-bottom: 15px; color: #666;">
        ${contact.email ? `<span>${contact.email}</span>` : ""}
        ${contact.phone ? `<span> • ${contact.phone}</span>` : ""}
        ${contact.location ? `<span> • ${contact.location}</span>` : ""}
        ${contact.linkedin ? `<span> • ${contact.linkedin}</span>` : ""}
      </div>

      ${
        summary?.trim()
          ? `
        <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Professional Summary</h2>
        <p style="font-size: 11px; margin-bottom: 10px; line-height: 1.5;">${summary}</p>
      `
          : ""
      }

      ${
        skills && skills.length > 0
          ? `
        <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Skills</h2>
        <p style="font-size: 11px; margin-bottom: 10px;">${skills.join(" • ")}</p>
      `
          : ""
      }

      ${
        experience && experience.length > 0
          ? `
        <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Professional Experience</h2>
        ${experience
          .map((exp) => {
            const dateRange =
              exp.endDate && !exp.isCurrentlyWorking
                ? `${exp.startDate} – ${exp.endDate}`
                : `${exp.startDate} – Present`;
            return `
              <div style="margin-bottom: 8px;">
                <div style="font-weight: 600; font-size: 12px; margin: 0;">${exp.title}</div>
                <div style="font-size: 11px; color: #666; margin: 2px 0;">${exp.company} | ${dateRange}</div>
                <ul style="margin: 3px 0 0 20px; font-size: 11px; line-height: 1.4; padding: 0;">
                  ${exp.description
                    .map(
                      (desc) => `<li style="margin-bottom: 2px;">${desc}</li>`,
                    )
                    .join("")}
                </ul>
              </div>
            `;
          })
          .join("")}
      `
          : ""
      }

      ${
        education && education.length > 0
          ? `
        <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Education</h2>
        ${education
          .map(
            (edu) => `
          <div style="font-size: 11px; margin-bottom: 6px;">
            <div style="font-weight: 600; margin: 0;">${edu.degree} in ${edu.field}</div>
            <div style="color: #666; margin: 2px 0;">${edu.institution} | Graduated: ${edu.graduationDate}</div>
          </div>
        `,
          )
          .join("")}
      `
          : ""
      }

      ${
        projects && projects.length > 0
          ? `
        <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Projects</h2>
        ${projects
          .map(
            (project) => `
          <div style="font-size: 11px; margin-bottom: 6px;">
            <div style="font-weight: 600; margin: 0;">${project.title}</div>
            <div>${project.description}</div>
          </div>
        `,
          )
          .join("")}
      `
          : ""
      }
    </div>
  `;

  try {
    const html2pdf = await loadHtml2Pdf();

    // Create element to convert
    const element = document.createElement("div");
    element.innerHTML = htmlContent;
    element.style.display = "none";
    document.body.appendChild(element);

    // Generate PDF
    return new Promise((resolve, reject) => {
      html2pdf()
        .set({
          margin: 10,
          filename: `Resume_${company || "Resume"}_${jobTitle || "Position"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
        })
        .from(element)
        .toPdf()
        .output("blob")
        .then((blob: Blob) => {
          document.body.removeChild(element);
          resolve(blob);
        })
        .catch((err: Error) => {
          document.body.removeChild(element);
          reject(err);
        });
    });
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw new Error(
      `PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function generateResumeDocx(
  resume: ResumeData,
  company: string,
  jobTitle: string,
): Promise<Blob> {
  const { contact, summary, skills, experience, education, projects } = resume;

  const sections = [
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

  if (resume.customSections && Object.keys(resume.customSections).length > 0) {
    for (const [sectionName, sectionContent] of Object.entries(resume.customSections)) {
      if (sectionContent && sectionContent.trim()) {
        sections.push(
          new Paragraph({
            text: sectionName.toUpperCase(),
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
            text: sectionContent,
            size: 22,
            spacing: { after: 400 },
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export async function generateResumePDF(resume: ResumeData): Promise<Blob> {
  return generatePDFBlobProper(resume, "", "");
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
  try {
    const html2pdf = await loadHtml2Pdf();

    const { contact, summary, skills, experience, education, projects } =
      resume;

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.45; color: #333; padding: 20px; max-width:800px; margin:0 auto;">
        <h1 style="margin: 0 0 5px 0; font-size: 28px; font-weight: 700;">${
          contact.name || "Resume"
        }</h1>
        <div style="font-size: 12px; margin-bottom: 15px; color: #666;">
          ${contact.email ? `<span>${contact.email}</span>` : ""}
          ${contact.phone ? `<span> • ${contact.phone}</span>` : ""}
          ${contact.location ? `<span> • ${contact.location}</span>` : ""}
          ${contact.linkedin ? `<span> • ${contact.linkedin}</span>` : ""}
        </div>

        ${
          summary?.trim()
            ? `
          <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Professional Summary</h2>
          <p style="font-size: 11px; margin-bottom: 10px; line-height: 1.5;">${summary}</p>
        `
            : ""
        }

        ${
          skills && skills.length > 0
            ? `
          <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Skills</h2>
          <p style="font-size: 11px; margin-bottom: 10px;">${skills.join(" • ")}</p>
        `
            : ""
        }

        ${
          experience && experience.length > 0
            ? `
          <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Professional Experience</h2>
          ${experience
            .map((exp) => {
              const dateRange =
                exp.endDate && !exp.isCurrentlyWorking
                  ? `${exp.startDate} – ${exp.endDate}`
                  : `${exp.startDate} – Present`;
              return `
                <div style="margin-bottom: 8px;">
                  <div style="font-weight: 600; font-size: 12px; margin: 0;">${exp.title}</div>
                  <div style="font-size: 11px; color: #666; margin: 2px 0;">${exp.company} | ${dateRange}</div>
                  <ul style="margin: 3px 0 0 20px; font-size: 11px; line-height: 1.4; padding: 0;">
                    ${exp.description
                      .map(
                        (desc) =>
                          `<li style="margin-bottom: 2px;">${desc}</li>`,
                      )
                      .join("")}
                  </ul>
                </div>
              `;
            })
            .join("")}
        `
            : ""
        }

        ${
          education && education.length > 0
            ? `
          <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Education</h2>
          ${education
            .map(
              (edu) => `
            <div style="font-size: 11px; margin-bottom: 6px;">
              <div style="font-weight: 600; margin: 0;">${edu.degree} in ${edu.field}</div>
              <div style="color: #666; margin: 2px 0;">${edu.institution} | Graduated: ${edu.graduationDate}</div>
            </div>
          `,
            )
            .join("")}
        `
            : ""
        }

        ${
          projects && projects.length > 0
            ? `
          <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 12px 0 6px 0; border-bottom: 2px solid #333; padding-bottom: 3px;">Projects</h2>
          ${projects
            .map(
              (project) => `
            <div style="font-size: 11px; margin-bottom: 6px;">
              <div style="font-weight: 600; margin: 0;">${project.title}</div>
              <div>${project.description}</div>
            </div>
          `,
            )
            .join("")}
        `
            : ""
        }
      </div>
    `;

    const element = document.createElement("div");
    element.innerHTML = htmlContent;
    element.style.display = "none";
    document.body.appendChild(element);

    const today = new Date().toISOString().split("T")[0];
    const sanitizedCompany = (company || "Company").replace(
      /[/\\?%*:|"<>]/g,
      "",
    );
    const sanitizedTitle = (jobTitle || "Position").replace(
      /[/\\?%*:|"<>]/g,
      "",
    );

    await html2pdf()
      .set({
        margin: 10,
        filename: `Resume_${sanitizedCompany}_${sanitizedTitle}_${today}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
      })
      .from(element)
      .save();

    document.body.removeChild(element);
  } catch (error) {
    console.error("PDF download error:", error);
    throw new Error(
      `Failed to download PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
