import styles from "@/features/landing/TeamSection.module.css";
import { TEAM } from "@/features/landing/landingData";

const BASE = "/images/landing/team";

// Three per row inside the 1240px container, two on tablet, one on a phone — see the grid
// column counts in TeamSection.module.css, which this string has to stay in step with.
const SIZES = "(max-width: 640px) 88vw, (max-width: 1000px) 44vw, 400px";

export default function TeamSection() {
  return (
    <section className={styles.team} aria-labelledby="team-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id="team-title" className={styles.title}>
            Our Team
          </h2>
        </header>

        <ul className={styles.grid} role="list">
          {TEAM.map((member) => (
            <li key={member.id} className={styles.item}>
              <div className={styles.frame}>
                <picture>
                  <source
                    type="image/avif"
                    sizes={SIZES}
                    srcSet={`${BASE}/${member.id}-400.avif 400w, ${BASE}/${member.id}-800.avif 800w`}
                  />
                  <source
                    type="image/webp"
                    sizes={SIZES}
                    srcSet={`${BASE}/${member.id}-400.webp 400w, ${BASE}/${member.id}-800.webp 800w`}
                  />
                  {/* Name and role sit in text right below, so the portrait stays decorative
                      rather than making a screen reader say every name twice. */}
                  <img
                    src={`${BASE}/${member.id}.jpg`}
                    alt=""
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    className={styles.photo}
                  />
                </picture>
              </div>
              <div className={styles.caption}>
                <span className={styles.name}>{member.name}</span>
                <span className={styles.role}>{member.role}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
