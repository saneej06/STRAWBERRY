import React, { useState, useEffect } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { MessageSquare, Send, CheckCircle2, User, Mail } from "lucide-react";

export default function Feedback() {
    const { sendFeedback } = useData();
    const { currentUser } = useAuth();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        message: "",
    });

    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    // Pre-fill user details if logged in
    useEffect(() => {
        if (currentUser) {
            setFormData(prev => ({
                ...prev,
                name: currentUser.displayName || "",
                email: currentUser.email || "",
            }));
        }
    }, [currentUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.message) return;

        setLoading(true);
        setError("");
        try {
            await sendFeedback(formData);
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || "Failed to send feedback. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex justify-center">
                    <div className="p-4 rounded-full bg-green-500/10 text-green-500">
                        <CheckCircle2 size={64} />
                    </div>
                </div>
                <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Thank You!</h1>
                <p className="text-lg" style={{ color: "var(--text-muted)" }}>
                    Your feedback has been received. I appreciate you taking the time to help me improve STRAWBERRY.
                </p>
                <div className="pt-4">
                    <button
                        onClick={() => {
                            setSubmitted(false);
                            setFormData(prev => ({ ...prev, message: "" }));
                        }}
                        className="px-8 py-3 rounded-xl font-bold transition-all hover:scale-105"
                        style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    >
                        Send Another Response
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-10 px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-4 mb-12">
                <div className="inline-block p-3 rounded-2xl bg-blue-500/10 text-blue-500 mb-2">
                    <MessageSquare size={32} />
                </div>
                <h1 className="text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    Share Your Feedback
                </h1>
                <p className="text-lg" style={{ color: "var(--text-muted)" }}>
                    Help me build the future of STRAWBERRY. Whether it's a suggestion, a bug, or praise, I'm listening.
                </p>
            </div>

            <div className="p-8 md:p-10 rounded-[2.5rem] border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                                <User size={14} />
                                Name
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Your Name"
                                className="w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                                style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider opacity-60 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                                <Mail size={14} />
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="your@email.com"
                                className="w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                                style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold uppercase tracking-wider opacity-60" style={{ color: "var(--text-secondary)" }}>
                            Feedback Message
                        </label>
                        <textarea
                            required
                            rows={5}
                            placeholder="Tell us more about your experience, or report a bug..."
                            className="w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
                            style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        />
                    </div>

                    {error && (
                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/50 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 rounded-2xl font-bold text-black flex items-center justify-center space-x-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        style={{ background: "var(--accent)" }}
                    >
                        {loading ? (
                            <span className="animate-pulse">Sending...</span>
                        ) : (
                            <>
                                <Send size={20} />
                                <span>Submit Feedback</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            <p className="text-center mt-8 text-sm px-10" style={{ color: "var(--text-muted)" }}>
                By submitting feedback, you agree to our terms. Your message will be sent directly to the developer, Mohammed Saneei.
            </p>
        </div>
    );
}
