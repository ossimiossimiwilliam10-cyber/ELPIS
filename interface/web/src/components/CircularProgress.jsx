import { motion } from 'framer-motion';

export default function CircularProgress({ percent, size = 64, strokeWidth = 6, showText = true }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="circular-progress" style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle 
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} 
          fill="none" stroke="var(--bg-tertiary)"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth}
          fill="none" stroke="var(--success-color)" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      {showText && (
        <div style={{ fontSize: size * 0.25, fontWeight: 'bold', color: 'var(--text-primary)', zIndex: 1 }}>
          <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
            {percent}%
          </motion.span>
        </div>
      )}
    </div>
  );
}
