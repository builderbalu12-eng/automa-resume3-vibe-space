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

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-block px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <p className="text-sm font-semibold text-primary">
                    AI-Powered Resume Optimization
                  </p>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading leading-tight">
                  <span className="text-gradient">Land Your Dream Job</span>{" "}
                  with AI-Powered Resume Tailoring
                </h1>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                ResumeMatch Pro automatically tailors your resume for every job
                application, optimizes for ATS, and calculates match scores in
                seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {!masterResume ? (
                  <Link
                    to="/upload"
                    className="inline-flex items-center justify-center px-8 py-4 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
                  >
                    <FileUp className="h-5 w-5 mr-2" />
                    Upload Your Resume
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/tailor"
                      className="inline-flex items-center justify-center px-8 py-4 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
                    >
                      <Zap className="h-5 w-5 mr-2" />
                      Tailor Your Resume
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Link>
                    <Link
                      to="/history"
                      className="inline-flex items-center justify-center px-8 py-4 rounded-lg border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-all"
                    >
                      View History
                    </Link>
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Trusted by job seekers:
                </p>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-5 w-5 text-primary" />
                  <span>10,000+ successful applications</span>
                </div>
              </div>
            </div>

            {masterResume && (
              <div className="hidden md:block">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative bg-card rounded-2xl p-8 border border-border shadow-glow hover:shadow-lg transition-all duration-300">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold mb-2">
                          {masterResume.contact.name}
                        </h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>{masterResume.contact.email}</p>
                          <p>{masterResume.contact.phone}</p>
                          <p>{masterResume.contact.location}</p>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {masterResume.summary}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-3">Top Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {masterResume.skills.slice(0, 6).map((s) => (
                            <span
                              key={s}
                              className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-semibold mb-3">
                          Recent Role
                        </h4>
                        {masterResume.experience.slice(0, 1).map((exp) => (
                          <div key={exp.title} className="text-sm space-y-2">
                            <div>
                              <div className="font-semibold">{exp.title}</div>
                              <div className="text-muted-foreground text-xs">
                                {exp.company} • {exp.startDate}{" "}
                                {exp.endDate ? `– ${exp.endDate}` : "– Present"}
                              </div>
                            </div>
                            <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1">
                              {exp.description.slice(0, 2).map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Link
                          to="/tailor"
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                        >
                          Tailor Resume
                        </Link>

                        <Link
                          to="/upload"
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                        >
                          Upload New
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold font-heading mb-4">
            How ResumeMatch Pro Works
          </h2>
          <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto">
            Our AI-powered system analyzes job requirements and optimizes your
            resume for maximum impact
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: FileUp,
              title: "Upload Your Master Resume",
              description:
                "Upload your professional resume once. We parse and store all your experience, skills, and education.",
              number: "01",
            },
            {
              icon: Zap,
              title: "AI-Powered Tailoring",
              description:
                "Our AI analyzes job postings and rewrites your resume to highlight the most relevant skills and experience.",
              number: "02",
            },
            {
              icon: BarChart3,
              title: "ATS Score Optimization",
              description:
                "Get real-time ATS compatibility scores and specific suggestions to improve your resume visibility.",
              number: "03",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="group relative rounded-2xl border border-border bg-card p-8 hover:shadow-glow transition-all hover:border-primary/50 hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-4xl font-bold text-primary/20 group-hover:text-primary/30 transition-colors">
                    {feature.number}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {masterResume && recentApplications.length > 0 && (
        <div className="bg-muted/30 py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold font-heading mb-8">
                Recent Applications
              </h3>
              <div className="grid gap-4">
                {recentApplications.map((app) => (
                  <div
                    key={app._id}
                    className="group flex items-center justify-between p-5 rounded-lg border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {app.jobTitle}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {app.company}
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-bold text-lg text-primary">
                        {app.atsScore || app.matchPercentage}%
                      </p>
                      <p className="text-xs text-muted-foreground capitalize font-medium">
                        {app.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/history"
                className="inline-flex items-center gap-2 text-primary font-semibold mt-8 hover:text-primary/80 transition-colors group"
              >
                View all applications
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="relative rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 border border-primary/20 p-12 sm:p-20 text-center overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl sm:text-5xl font-bold font-heading">
              Ready to Land Your Dream Job?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Start tailoring your resume for every application and increase
              your chances of getting noticed by hiring managers.
            </p>
            {!masterResume ? (
              <Link
                to="/upload"
                className="inline-flex items-center px-8 py-4 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
              >
                Get Started Now
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            ) : (
              <Link
                to="/tailor"
                className="inline-flex items-center px-8 py-4 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:shadow-glow transition-all hover:-translate-y-0.5"
              >
                Tailor Your Resume
                <Zap className="h-5 w-5 ml-2" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
