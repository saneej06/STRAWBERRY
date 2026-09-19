import React from "react";
import { AtSign, ExternalLink, Facebook, Linkedin, Mail, MessageCircle, Phone, Send } from "lucide-react";

export default function Contact() {
    const contactMethods = [
        {
            icon: <AtSign className="w-5 h-5" />,
            label: "Name",
            value: "Mohammed Saneei",
            helper: "Software Engineering Student",
            link: "https://www.linkedin.com/in/mohammed-saneej-98a35626a?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app",
            tone: "from-fuchsia-500 to-cyan-400",
        },
        {
            icon: <Mail className="w-5 h-5" />,
            label: "Email",
            value: "mohammedsaneej44@gmail.com",
            helper: "Send a direct message",
            link: "mailto:mohammedsaneej44@gmail.com",
            tone: "from-sky-500 to-indigo-500",
        },
        {
            icon: <Phone className="w-5 h-5" />,
            label: "WhatsApp",
            value: "+94 77 558 8512",
            helper: "Fast replies for support",
            link: "https://wa.me/94775588512",
            tone: "from-emerald-500 to-teal-400",
        },
        {
            icon: <Linkedin className="w-5 h-5" />,
            label: "LinkedIn",
            value: "Mohammed Saneei",
            helper: "Connect professionally",
            link: "https://www.linkedin.com/in/mohammed-saneej-98a35626a?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app",
            tone: "from-blue-600 to-sky-400",
        },
        {
            icon: <Facebook className="w-5 h-5" />,
            label: "Facebook",
            value: "Mohammed Saneei",
            helper: "Follow personal updates",
            link: "https://www.facebook.com/share/1LfK4z3JYk/",
            tone: "from-blue-700 to-violet-500",
        },
    ];

    const primaryActions = contactMethods.slice(1, 3);

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-emerald-400" />
                <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
                    <div className="flex flex-col justify-between gap-8">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
                                <MessageCircle size={14} />
                                Contact Hub
                            </div>
                            <h1 className="mt-6 text-4xl font-black leading-tight md:text-6xl" style={{ color: "var(--text-primary)" }}>
                                Let's build better finance tools together.
                            </h1>
                            <p className="mt-5 max-w-2xl text-base leading-7 md:text-lg" style={{ color: "var(--text-muted)" }}>
                                Reach Mohammed Saneei for STRAWBERRY support, ideas, improvements, or collaboration.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {primaryActions.map((action) => (
                                <a
                                    key={action.label}
                                    href={action.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-12 items-center gap-3 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
                                    style={{ background: "linear-gradient(135deg, var(--accent) 0%, #2563eb 100%)" }}
                                >
                                    {action.icon}
                                    {action.label === "Email" ? "Send Email" : "Open WhatsApp"}
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-base)] p-6">
                        <div className="flex items-center gap-4">
                            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-emerald-400 text-3xl font-black text-white shadow-lg">
                                MS
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>
                                    Developer
                                </p>
                                <h2 className="truncate text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                                    Mohammed Saneei
                                </h2>
                                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                                    Software Engineering Student
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                            <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                                I am available for feedback, app support, and project conversations. Pick the channel that is easiest for you.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {contactMethods.map((method, index) => (
                    <a
                        key={index}
                        href={method.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-xl"
                    >
                        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${method.tone}`} />
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${method.tone} text-white shadow-md transition-transform group-hover:scale-105`}>
                                    {method.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                                        {method.label}
                                    </p>
                                    <p className="mt-1 truncate text-base font-bold" style={{ color: "var(--text-primary)" }}>
                                        {method.value}
                                    </p>
                                </div>
                            </div>
                            <ExternalLink size={18} className="mt-3 shrink-0 opacity-40 transition-all group-hover:translate-x-1 group-hover:opacity-100 text-[var(--accent)]" />
                        </div>
                        <p className="mt-5 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                            {method.helper}
                        </p>
                    </a>
                ))}
            </div>

            <div className="mt-8 rounded-[2rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-sm md:flex md:items-center md:justify-between md:gap-8 md:p-8">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
                        Feedback
                    </p>
                    <h2 className="mt-2 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                        Your feedback matters.
                    </h2>
                    <p className="mt-2 max-w-2xl leading-6" style={{ color: "var(--text-secondary)" }}>
                        Help me refine STRAWBERRY with bug reports, ideas, and practical improvements.
                    </p>
                </div>
                <div className="mt-6 md:mt-0">
                    <a
                        href="/feedback"
                        className="inline-flex min-h-12 items-center gap-3 rounded-2xl px-6 py-3 font-bold text-black transition-all hover:-translate-y-0.5 active:translate-y-0"
                        style={{ background: "var(--accent)" }}
                    >
                        <Send size={18} />
                        Feedback Form
                    </a>
                </div>
            </div>
        </div>
    );
}
