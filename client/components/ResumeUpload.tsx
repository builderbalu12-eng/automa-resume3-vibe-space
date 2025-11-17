import React, { useState } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { parseFile, validateResume } from "@/services/resumeParser";
import { ResumeData } from "@/types";
import { getApiKeyFromSettings } from "@/utils/storage";

interface ResumeUploadProps {
  onUploadSuccess: (resume: ResumeData) => void;
  isLoading?: boolean;
  onApiKeyMissing?: () => void;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({
  onUploadSuccess,
  isLoading = false,
  onApiKeyMissing,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateApiKey = async (): Promise<boolean> => {
    try {
      const apiKey = await getApiKeyFromSettings();
      if (!apiKey || apiKey.trim().length === 0) {
        setError(
          "⚠️ API Key Required. Please configure your Gemini API key in Settings before uploading your resume."
        );
        if (onApiKeyMissing) {
          onApiKeyMissing();
        }
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error validating API key:", err);
      setError("Failed to validate API key. Please try again.");
      return false;
    }
  };

  const handleFile = async (file: File) => {
    try {
      // Validate API key first
      const hasApiKey = await validateApiKey();
      if (!hasApiKey) {
        return;
      }

      const validExtensions = [".docx", ".txt", ".pdf"];
      const hasValidExtension = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        setError("Please upload a .docx, .txt, or .pdf file");
        return;
      }

      setError(null);
      const resume = await parseFile(file);
      const validation = validateResume(resume);

      if (!validation.isValid) {
        setError(`Resume issues: ${validation.errors.join(", ")}`);
        return;
      }

      onUploadSuccess(resume);
    } catch (err) {
      // Handle extension context invalidation error
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (
        errorMessage.includes("Extension context invalidated") ||
        errorMessage.includes("chrome.runtime.lastError")
      ) {
        setError(
          `⚠️ Extension was reloaded.

Please try one of the following:
1. Refresh this page and try again
2. Clear cookies and site data:
   - Click the lock icon (or site info icon) on the left side of the address bar
   - Click "Cookies and site data"
   - Click "Remove" or "Clear"
   - Refresh the page

Then re-enable the extension and try again.`
        );
      } else {
        setError(errorMessage || "Failed to parse resume. Please try another file.");
      }
      console.error("Resume parsing error:", err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        onChange={handleChange}
        className="hidden"
        disabled={isLoading}
      />

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`
          relative w-full rounded-lg border-2 border-dashed p-8
          transition-all duration-200
          ${
            dragActive
              ? "border-primary bg-primary/5 scale-105"
              : "border-muted hover:border-primary/50"
          }
          ${isLoading ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <div className="flex flex-col items-center justify-center gap-6">
          {isLoading ? (
            <>
              <div className="rounded-full bg-primary/20 p-6 animate-pulse">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg text-primary">
                  Parsing Resume...
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Extracting and analyzing your resume content
                </p>
                <div className="mt-4 w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-full bg-primary/10 p-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">
                  Upload Your Master Resume
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop your resume or click to browse (DOCX format)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex gap-3 rounded-lg bg-destructive/10 p-3 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">{error}</p>
            <p className="text-xs text-destructive/80 mt-1">
              Please ensure your resume contains contact info, skills,
              experience, and education.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
