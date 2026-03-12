import { motion } from "framer-motion";
import type { Easing } from "framer-motion";

const EASE: Easing = [0.32, 0.72, 0, 1];

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: EASE },
  viewport: { once: true },
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 md:px-8 h-14 flex items-center justify-between">
          <motion.span
            {...fadeUp}
            className="text-sm font-medium font-mono text-muted-foreground tracking-tight"
          >
            blank
          </motion.span>
          <motion.nav
            {...fadeUp}
            className="flex items-center gap-6"
          >
            <a href="#system" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              System
            </a>
            <a href="#primitives" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              Primitives
            </a>
          </motion.nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 sm:py-32 border-b border-border">
        <div className="container mx-auto px-6 md:px-8">
          <motion.p
            {...fadeUp}
            className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-6"
          >
            Foundation / v1.0.0
          </motion.p>
          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
            className="font-semibold text-foreground mb-6"
          >
            Blank Site.
          </motion.h1>
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
            className="text-muted-foreground text-lg leading-relaxed mb-10"
          >
            A foundational starting point. A minimal set of styles and
            conventions for typography, spacing, and interaction — ready
            to become anything.
          </motion.p>
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
            className="flex items-center gap-3"
          >
            <button className="btn-shadow bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-[box-shadow,opacity] duration-200">
              Get started
            </button>
            <button className="btn-shadow bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-[box-shadow,background-color] duration-200">
              View system
            </button>
          </motion.div>
        </div>
      </section>

      {/* System section */}
      <section id="system" className="py-16 sm:py-24 border-b border-border">
        <div className="container mx-auto px-6 md:px-8">
          <motion.h2
            {...fadeUp}
            className="font-semibold text-foreground mb-3"
          >
            System
          </motion.h2>
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
            className="text-muted-foreground mb-12"
          >
            Core design decisions, defined once, applied consistently.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "Typography",
                description: "Geist Sans. Fluid type scale from 16px to 72px. Calibrated for readability at every size.",
                meta: "font-sans · -0.025em tracking",
              },
              {
                label: "Color",
                description: "Neutral HSL palette. One primary accent. Designed for clarity under all lighting conditions.",
                meta: "10 semantic tokens",
              },
              {
                label: "Interaction",
                description: "One easing curve. Two durations. Transitions are predictable, never surprising.",
                meta: "cubic-bezier(0.32, 0.72, 0, 1)",
              },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                viewport={{ once: true }}
                className="card-shadow rounded-xl p-6 bg-card hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow] duration-[250ms]"
              >
                <p className="text-xs font-mono text-muted-foreground mb-3 tracking-wide">{item.meta}</p>
                <h3 className="text-base font-semibold text-foreground mb-2">{item.label}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Primitives section */}
      <section id="primitives" className="py-16 sm:py-24 border-b border-border">
        <div className="container mx-auto px-6 md:px-8">
          <motion.h2 {...fadeUp} className="font-semibold text-foreground mb-3">
            Primitives
          </motion.h2>
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
            className="text-muted-foreground mb-12"
          >
            Foundational atoms, ready to compose.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <p className="text-xs font-mono text-muted-foreground tracking-wide uppercase">Button</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn-shadow bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-[box-shadow,opacity] duration-200">
                  Primary
                </button>
                <button className="btn-shadow bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-[box-shadow,background-color] duration-200">
                  Secondary
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-[color,background-color] duration-150">
                  Ghost
                </button>
              </div>
            </motion.div>

            {/* Input */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06, ease: EASE }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <p className="text-xs font-mono text-muted-foreground tracking-wide uppercase">Input</p>
              <div className="bg-secondary p-4 rounded-xl inline-flex flex-col gap-2 w-full max-w-xs">
                <label className="text-xs font-medium text-foreground">Label</label>
                <input
                  type="text"
                  placeholder="Placeholder text"
                  className="input-shadow bg-background text-foreground px-3 py-2 rounded-md text-sm outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-shadow duration-150 w-full"
                />
              </div>
            </motion.div>

            {/* Type scale */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12, ease: EASE }}
              viewport={{ once: true }}
              className="space-y-4 md:col-span-2"
            >
              <p className="text-xs font-mono text-muted-foreground tracking-wide uppercase">Type Scale</p>
              <div className="space-y-2">
                <div className="flex items-baseline gap-4 py-2 border-b border-border">
                  <span className="w-16 text-xs font-mono text-muted-foreground shrink-0">h1</span>
                  <span className="font-semibold leading-none" style={{ fontSize: "clamp(1.75rem, 1.5rem + 1.25vw, 2.5rem)" }}>The quick brown fox</span>
                </div>
                <div className="flex items-baseline gap-4 py-2 border-b border-border">
                  <span className="w-16 text-xs font-mono text-muted-foreground shrink-0">h2</span>
                  <span className="font-semibold leading-tight text-2xl">The quick brown fox jumps</span>
                </div>
                <div className="flex items-baseline gap-4 py-2 border-b border-border">
                  <span className="w-16 text-xs font-mono text-muted-foreground shrink-0">body</span>
                  <span className="text-base text-muted-foreground leading-relaxed">The quick brown fox jumps over the lazy dog. A sentence of moderate length for testing body readability.</span>
                </div>
                <div className="flex items-baseline gap-4 py-2">
                  <span className="w-16 text-xs font-mono text-muted-foreground shrink-0">mono</span>
                  <span className="font-mono text-sm text-muted-foreground">const value = 1_000_000;</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8">
        <div className="container mx-auto px-6 md:px-8 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">blank · foundation</span>
          <span className="text-xs text-muted-foreground">Ready to build.</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
