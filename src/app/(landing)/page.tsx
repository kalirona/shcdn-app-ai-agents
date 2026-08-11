import {
  Bot,
  Check,
  MessageSquare,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

import { signInAction, signUpAction } from "@/lib/auth/auth-actions";

const FEATURES = [
  {
    icon: Bot,
    title: "AI Customer Agent",
    description: "Create intelligent agents trained on your business knowledge. They answer questions 24/7.",
  },
  {
    icon: MessageSquare,
    title: "Website Widget",
    description: "One-line install. Add your AI agent to any website with a simple embed code.",
  },
  {
    icon: Zap,
    title: "Instant Answers",
    description: "AI responds in seconds using your own content. No more waiting for support.",
  },
  {
    icon: Shield,
    title: "Human Handoff",
    description: "When AI can't help, seamlessly transfer to a human agent.",
  },
  {
    icon: Sparkles,
    title: "Lead Capture",
    description: "Automatically capture leads from conversations. Never miss a customer.",
  },
  {
    icon: Check,
    title: "Booking System",
    description: "Let customers book appointments directly through the AI chat.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    description: "Perfect for small businesses",
    features: [
      "1 AI Agent",
      "1,000 conversations/mo",
      "50MB knowledge storage",
      "Lead capture",
      "Booking system",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Business",
    price: "$79",
    period: "/mo",
    description: "For growing businesses",
    features: [
      "5 AI Agents",
      "5,000 conversations/mo",
      "500MB knowledge storage",
      "Analytics dashboard",
      "Human handoff",
      "Team members (5)",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mo",
    description: "For agencies and enterprises",
    features: [
      "15 AI Agents",
      "20,000 conversations/mo",
      "2GB knowledge storage",
      "Advanced analytics",
      "White-label widget",
      "Team members (20)",
      "API access",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const FAQS = [
  {
    question: "How does the AI agent learn about my business?",
    answer: "You can upload documents (PDF, DOCX), paste text, add website URLs, or create FAQs. The AI uses this knowledge to answer customer questions accurately.",
  },
  {
    question: "Can I try it before paying?",
    answer: "Yes! All plans come with a 14-day free trial. No credit card required to start.",
  },
  {
    question: "What happens when the AI can't answer a question?",
    answer: "The AI will honestly say it doesn't know and can offer to connect the customer with a human agent. You can also set custom fallback messages.",
  },
  {
    question: "Can I use my own domain?",
    answer: "Yes! The chat widget works on any website. Pro plan includes white-label options to remove our branding.",
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use enterprise-grade encryption, and your data is never used to train other models. You own your data.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes, no contracts. Cancel anytime and your data is exported before account closure.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Bot className="size-6 text-primary" />
            <span className="font-bold text-lg">Agent AI</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="#features" className="text-muted-foreground text-sm hover:text-foreground">Features</a>
            <a href="#pricing" className="text-muted-foreground text-sm hover:text-foreground">Pricing</a>
            <a href="#faq" className="text-muted-foreground text-sm hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <form action={signInAction}>
              <button type="submit" className="text-sm font-medium hover:underline">
                Sign In
              </button>
            </form>
            <form action={signUpAction}>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm font-medium"
              >
                Get Started
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-primary text-sm font-medium">
            Turn your website into an AI employee
          </span>
          <h1 className="font-bold text-5xl tracking-tight lg:text-6xl">
            AI Customer Agent for Your Business
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Answer questions, capture leads, and book appointments — automatically.
            Train your AI with your own content and let it handle customer conversations 24/7.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <form action={signUpAction}>
              <button
                type="submit"
                className="rounded-xl bg-primary px-8 py-3 font-medium text-primary-foreground"
              >
                Start Free Trial
              </button>
            </form>
            <a
              href="#pricing"
              className="rounded-xl border px-8 py-3 font-medium hover:border-muted-foreground/50"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/20 px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-bold text-3xl">Everything you need</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Powerful features to automate your customer support.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border bg-background p-6">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-muted-foreground text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-bold text-3xl">Simple, transparent pricing</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Start free. Scale as you grow.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-6 ${plan.popular ? "border-primary ring-1 ring-primary" : ""}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-primary-foreground text-xs">
                    Most Popular
                  </span>
                )}
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <p className="mt-1 text-muted-foreground text-sm">{plan.description}</p>
                <div className="mt-4">
                  <span className="font-bold text-4xl">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="size-4 shrink-0 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <form action={signUpAction}>
                  <button
                    type="submit"
                    className={`mt-6 block w-full rounded-lg py-2.5 text-center font-medium ${
                      plan.popular
                        ? "bg-primary text-primary-foreground"
                        : "border hover:border-muted-foreground/50"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t bg-muted/20 px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-bold text-3xl">Frequently Asked Questions</h2>
          <div className="mt-12 space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group rounded-lg border bg-background">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 font-medium">
                  {faq.question}
                  <span className="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
                </summary>
                <p className="px-6 pb-4 text-muted-foreground text-sm">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground">
          <h2 className="font-bold text-3xl">Ready to automate your customer support?</h2>
          <p className="mt-3 text-lg opacity-90">
            Join hundreds of businesses using Agent AI to handle conversations 24/7.
          </p>
          <form action={signUpAction}>
            <button
              type="submit"
              className="mt-6 inline-block rounded-xl bg-background px-8 py-3 font-medium text-foreground"
            >
              Start Your Free Trial
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <span className="font-bold">Agent AI</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Agent AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
