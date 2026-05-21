import { motion } from "framer-motion";
import { Mail, Linkedin } from "lucide-react";
import { teamCopy } from "../LandingPageContent";

export function TeamSection() {
  return (
    <div className="team" id="equipe" aria-labelledby="team-heading">
      <div className="team__grid">
        {teamCopy.members.map((member, i) => (
          <motion.article
            key={member.email}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="team__card"
          >
            <div className="team__card-inner">
              <img
                src={member.image}
                alt={member.name}
                className={`team__avatar ${member.name.includes("Benjamin") ? "team__avatar--muted" : ""}`}
              />
              <blockquote className="team__quote">
                &ldquo;{member.quote}&rdquo;
              </blockquote>
              <h3 className="team__name">{member.name}</h3>
              <p className="team__role">{member.title}</p>
              <p className="team__desc">{member.description}</p>
              <div className="team__social">
                <a href={`mailto:${member.email}`} aria-label={`Email ${member.name}`}>
                  <Mail className="team__icon" aria-hidden />
                </a>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`LinkedIn ${member.name}`}
                >
                  <Linkedin className="team__icon" aria-hidden />
                </a>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
