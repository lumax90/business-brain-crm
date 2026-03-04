"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signUp } from "@/lib/auth-client";
import {
    RiBrainLine,
    RiMailLine,
    RiLockLine,
    RiUser3Line,
    RiEyeLine,
    RiEyeOffLine,
    RiLoader4Line,
    RiArrowRightLine,
} from "@remixicon/react";

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await signUp.email({
                name,
                email,
                password,
            });

            if (result.error) {
                setError(result.error.message || "Registration failed");
                setLoading(false);
                return;
            }

            // Auto-login after registration, redirect to dashboard
            router.push("/");
        } catch (err: any) {
            setError(err?.message || "Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto px-6">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
                    <RiBrainLine className="w-7 h-7 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
                    Create your account
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Get started with Pixl Sales Brain
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {/* Name */}
                <div className="space-y-1.5">
                    <label htmlFor="name" className="text-sm font-medium text-foreground">
                        Full Name
                    </label>
                    <div className="relative">
                        <RiUser3Line className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            required
                            className={cn(
                                "w-full h-10 rounded-lg border border-input bg-background pl-10 pr-4 text-sm",
                                "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40",
                                "transition-all duration-200"
                            )}
                        />
                    </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-medium text-foreground">
                        Email
                    </label>
                    <div className="relative">
                        <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            required
                            className={cn(
                                "w-full h-10 rounded-lg border border-input bg-background pl-10 pr-4 text-sm",
                                "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40",
                                "transition-all duration-200"
                            )}
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                        Password
                    </label>
                    <div className="relative">
                        <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            required
                            minLength={8}
                            className={cn(
                                "w-full h-10 rounded-lg border border-input bg-background pl-10 pr-10 text-sm",
                                "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40",
                                "transition-all duration-200"
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">Minimum 8 characters</p>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                        "w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm",
                        "hover:bg-primary/90 transition-all duration-200",
                        "flex items-center justify-center gap-2",
                        "disabled:opacity-50 disabled:pointer-events-none"
                    )}
                >
                    {loading ? (
                        <RiLoader4Line className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            Create account
                            <RiArrowRightLine className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>

            {/* Footer */}
            <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
