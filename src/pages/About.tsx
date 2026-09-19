import React from "react";
import { Shield, TrendingUp, Users, Zap, Code2, GraduationCap } from "lucide-react";

export default function About() {
    const features = [
        {
            icon: <TrendingUp className="w-8 h-8 text-blue-500" />,
            title: "Smart Tracking",
            description: "Automatically categorize and visualize your spending habits with intuitive charts.",
        },
        {
            icon: <Users className="w-8 h-8 text-green-500" />,
            title: "Debt Management",
            description: "Keep track of who owes you money and manage partial payments effortlessly.",
        },
        {
            icon: <Shield className="w-8 h-8 text-purple-500" />,
            title: "Secure & Private",
            description: "Your financial data is encrypted and protected with industry-leading security.",
        },
        {
            icon: <Zap className="w-8 h-8 text-yellow-500" />,
            title: "AI Insights",
            description: "Get personalized financial advice and summaries from our built-in AI assistant.",
        },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-16 py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero Section */}
            <div className="text-center space-y-6">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
                    <span style={{ color: "var(--accent)" }}>STRAWBERRY</span>
                </h1>
                <p className="text-xl max-w-2xl mx-auto leading-relaxed px-4" style={{ color: "var(--text-muted)" }}>
                    Master your money, simplify your life. Welcome to my app!
                </p>
            </div>

            {/* Developer Section */}
            <div className="flex flex-col md:flex-row items-center gap-10 p-10 rounded-[3rem] bg-[var(--bg-elevated)] border border-[var(--border)]">
                <div className="space-y-4 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <h2 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Mohammed Saneei</h2>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                            <GraduationCap size={12} />
                            Student
                        </span>
                    </div>
                    <p className="text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        I am a Software Engineering Student and the developer behind STRAWBERRY. I built this website to help people gain better control over their finances with modern, easy-to-use tools.
                    </p>
                    <div className="flex items-center justify-center md:justify-start gap-4">
                        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                            <Code2 size={16} />
                            <span>Full Stack Developer</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                {features.map((feature, index) => (
                    <div
                        key={index}
                        className="p-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all hover:scale-[1.02] hover:shadow-xl hover:border-[var(--accent)] group"
                    >
                        <div className="mb-6 p-3 rounded-2xl bg-[var(--bg-elevated)] w-fit group-hover:scale-110 transition-transform">
                            {feature.icon}
                        </div>
                        <h3 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                            {feature.title}
                        </h3>
                        <p className="leading-relaxed" style={{ color: "var(--text-muted)" }}>
                            {feature.description}
                        </p>
                    </div>
                ))}
            </div>

            <div className="text-center pb-20">
                <p className="text-sm uppercase tracking-[0.2em] font-bold opacity-30" style={{ color: "var(--text-muted)" }}>
                    Developed by Mohammed Saneei
                </p>
            </div>
        </div>
    );
}
