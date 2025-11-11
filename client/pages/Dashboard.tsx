import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileUp,
  Zap,
  BarChart3,
  ArrowRight,
  Briefcase,
  Users,
} from "lucide-react";
import { ResumeData, ApplicationRecord } from "@/types";
import { getApplicationHistory } from "@/services/mongodb";
import { getMasterResume } from "@/utils/storage";

export const Dashboard: React.FC = () => {
  const [masterResume, setMasterResume] = useState<ResumeData | null>(null);
  const [recentApplications, setRecentApplications] = useState<
    ApplicationRecord[]
  >([]);
  const [stats, setStats] = useState({
    totalApps: 0,
    avgScore: 0,
    successRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const resume = await getMasterResume();
        setMasterResume(resume);

        const apps = await getApplicationHistory();
        setRecentApplications(apps.slice(0, 5));

        if (apps.length > 0) {
          const avgScore = Math.round(
            apps.reduce(
              (sum, a) => sum + (a.atsScore || a.matchPercentage || 0),
              0,
            ) / apps.length,
          );
          const successCount = apps.filter(
            (a) => a.status === "offer" || a.status === "interview",
          ).length;
          const successRate = Math.round((successCount / apps.length) * 100);

          setStats({
            totalApps: apps.length,
            avgScore,
            successRate,
          });
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading leading-tight mb-6">
                <span className="text-gradient">Land Your Dream Job</span> with
                AI-Powered Resume Tailoring
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                ResumeMatch Pro automatically tailors your resume for every job
                application, optimizes for ATS, and calculates match scores in
                seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                {!masterResume ? (
                  <Link
                    to="/upload"
                    className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
                  >
                    <FileUp className="h-5 w-5 mr-2" />
                    Upload Your Resume
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/tailor"
                      className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
                    >
                      <Zap className="h-5 w-5 mr-2" />
                      Tailor Your Resume
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Link>
                    <Link
                      to="/history"
                      className="inline-flex items-center justify-center px-8 py-3 rounded-lg border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-all"
                    >
                      View History
                    </Link>
                  </>
                )}
              </div>

              <div className="mt-12 pt-8 border-t border-border">
                <p className="text-sm text-muted-foreground mb-4">
                  Trusted by job seekers:
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-5 w-5 text-primary" />
                  <span>10,000+ successful applications</span>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-2xl opacity-20" />
                <div className="relative bg-card rounded-2xl p-6 border border-border shadow-glow">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">
                        {masterResume?.contact.name ?? "John Doe"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {masterResume?.contact.email ?? "john.doe@example.com"}
                        {" • "}
                        {masterResume?.contact.phone ?? "(555) 555-5555"}
                      </p>

                      <p className="mt-3 text-sm text-muted-foreground">
                        {masterResume?.summary ??
                          "Experienced software engineer with a track record of building scalable web applications and improving product metrics."}
                      </p>

                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {(
                            masterResume?.skills ?? [
                              "JavaScript",
                              "React",
                              "Node.js",
                              "TypeScript",
                              "AWS",
                            ]
                          )
                            .slice(0, 8)
                            .map((s) => (
                              <span
                                key={s}
                                className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                              >
                                {s}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">
                          Recent Role
                        </h4>
                        {(masterResume?.experience &&
                        masterResume.experience.length
                          ? masterResume.experience.slice(0, 1)
                          : [
                              {
                                title: "Senior Software Engineer",
                                company: "Acme Corp",
                                startDate: "Jan 2020",
                                endDate: "Present",
                                description: [
                                  "Led a team to build a customer-facing web app.",
                                  "Improved load times by 40% through optimizations.",
                                ],
                              },
                            ]
                        ).map((exp) => (
                          <div key={exp.title} className="text-sm">
                            <div className="font-semibold">{exp.title}</div>
                            <div className="text-muted-foreground text-xs">
                              {exp.company} • {exp.startDate}{" "}
                              {exp.endDate ? `– ${exp.endDate}` : "– Present"}
                            </div>
                            <ul className="list-disc list-inside mt-2 text-muted-foreground text-xs">
                              {exp.description.slice(0, 3).map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="w-40 flex-shrink-0 text-right">
                      <div className="text-sm text-muted-foreground">
                        {masterResume?.contact.location ?? "San Francisco, CA"}
                      </div>

                      <div className="mt-4 flex flex-col gap-2 items-end">
                        {masterResume ? (
                          <Link
                            to="/tailor"
                            className="inline-flex items-center px-3 py-1 rounded bg-primary/10 text-primary text-sm font-medium"
                          >
                            Tailor Resume
                          </Link>
                        ) : (
                          <Link
                            to="/upload"
                            className="inline-flex items-center px-3 py-1 rounded bg-primary/10 text-primary text-sm font-medium"
                          >
                            Upload Resume
                          </Link>
                        )}

                        <Link
                          to="/history"
                          className="inline-flex items-center px-3 py-1 rounded border border-border text-sm"
                        >
                          View History
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl sm:text-4xl font-bold font-heading text-center mb-4">
          How ResumeMatch Pro Works
        </h2>
        <p className="text-center text-muted-foreground text-lg mb-12 max-w-2xl mx-auto">
          Our AI-powered system analyzes job requirements and optimizes your
          resume for maximum impact
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: FileUp,
              title: "Upload Your Master Resume",
              description:
                "Upload your professional resume once. We parse and store all your experience, skills, and education.",
            },
            {
              icon: Zap,
              title: "AI-Powered Tailoring",
              description:
                "Our AI analyzes job postings and rewrites your resume to highlight the most relevant skills and experience.",
            },
            {
              icon: BarChart3,
              title: "ATS Score Optimization",
              description:
                "Get real-time ATS compatibility scores and specific suggestions to improve your resume visibility.",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="group rounded-xl border border-border bg-card p-6 hover:shadow-glow transition-all hover:border-primary/50 hover:-translate-y-1"
            >
              <div className="rounded-lg bg-primary/10 p-3 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Section (if user has data) */}
      {masterResume && (
        <div className="bg-muted/50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-center mb-12">
              Your Application Stats
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-8 rounded-xl bg-card border border-border hover:shadow-glow transition-shadow">
                <div className="text-4xl font-bold text-primary mb-2">
                  {stats.totalApps}
                </div>
                <p className="text-muted-foreground">Applications Tailored</p>
              </div>
              <div className="text-center p-8 rounded-xl bg-card border border-border hover:shadow-glow transition-shadow">
                <div className="text-4xl font-bold text-primary mb-2">
                  {stats.avgScore}%
                </div>
                <p className="text-muted-foreground">Average ATS Score</p>
              </div>
              <div className="text-center p-8 rounded-xl bg-card border border-border hover:shadow-glow transition-shadow">
                <div className="text-4xl font-bold text-primary mb-2">
                  {stats.successRate}%
                </div>
                <p className="text-muted-foreground">Success Rate</p>
              </div>
            </div>

            {recentApplications.length > 0 && (
              <div className="mt-12">
                <h3 className="text-2xl font-bold font-heading mb-6">
                  Recent Applications
                </h3>
                <div className="grid gap-4">
                  {recentApplications.map((app) => (
                    <div
                      key={app._id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold">{app.jobTitle}</p>
                        <p className="text-sm text-muted-foreground">
                          {app.company}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          {app.atsScore || app.matchPercentage}% Match
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {app.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  to="/history"
                  className="inline-flex items-center gap-2 text-primary font-semibold mt-6 hover:underline"
                >
                  View all applications <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold font-heading mb-6">
          Ready to Land Your Dream Job?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Start tailoring your resume for every application and increase your
          chances of getting noticed.
        </p>
        {!masterResume ? (
          <Link
            to="/upload"
            className="inline-flex items-center px-8 py-3 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
          >
            Get Started Now
            <ArrowRight className="h-5 w-5 ml-2" />
          </Link>
        ) : (
          <Link
            to="/tailor"
            className="inline-flex items-center px-8 py-3 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
          >
            Tailor Your Resume
            <Zap className="h-5 w-5 ml-2" />
          </Link>
        )}
      </div>
    </div>
  );
};
