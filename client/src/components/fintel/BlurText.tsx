import { motion, useReducedMotion } from "framer-motion";

type BlurTextProps = {
  children: string;
  className?: string;
  delay?: number;
};

export function BlurText({ children, className = "", delay = 0 }: BlurTextProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: reduceMotion ? 0 : 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
}
