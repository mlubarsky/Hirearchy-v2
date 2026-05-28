"""Deterministic skill extraction + match scoring.

Given some text (a resume or a job description), find which of our known
skills/keywords appear. Compare two sets to produce a match score, plus the
specific overlap and gap lists so the user gets actionable feedback.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Canonical skill names. Matching is case-insensitive and word-boundary aware.
# Keep this list pragmatic — adding a skill is one line.
SKILLS: list[str] = [
    # Programming languages
    "Python", "JavaScript", "TypeScript", "Go", "Golang", "Rust", "Java",
    "Kotlin", "Swift", "Objective-C", "Ruby", "PHP", "Scala", "Clojure",
    "Elixir", "Haskell", "OCaml", "Erlang", "Lua", "Perl", "R", "MATLAB",
    "Julia", "Dart", "Bash", "Shell", "PowerShell", "SQL", "GraphQL",
    "HTML", "CSS", "Sass", "Less", "WebAssembly",

    # Special-case languages (handled separately because + and # aren't word chars)
    "C++", "C#", ".NET",

    # Frontend frameworks / libs
    "React", "React Native", "Next.js", "Vue", "Nuxt", "Svelte", "SvelteKit",
    "Angular", "Ember", "Solid", "Solid.js", "Astro", "Remix", "Gatsby",
    "Redux", "MobX", "Zustand", "Recoil", "Tailwind", "Tailwind CSS",
    "shadcn", "Material UI", "Chakra UI", "Bootstrap", "Storybook",
    "Vite", "Webpack", "Rollup", "esbuild", "Turbopack",

    # Backend frameworks
    "Node", "Node.js", "Express", "NestJS", "Koa", "Fastify",
    "Django", "Flask", "FastAPI", "Tornado", "Pyramid",
    "Spring", "Spring Boot", "Rails", "Ruby on Rails", "Sinatra",
    "Laravel", "Symfony", "ASP.NET", "Gin", "Echo", "Phoenix", "Actix",

    # Databases
    "PostgreSQL", "Postgres", "MySQL", "MariaDB", "SQLite", "SQL Server",
    "Oracle", "MongoDB", "Redis", "Cassandra", "DynamoDB", "Elasticsearch",
    "OpenSearch", "Neo4j", "ClickHouse", "Snowflake", "BigQuery", "Redshift",
    "Databricks", "Firestore", "Supabase", "CockroachDB", "TimescaleDB",
    "InfluxDB", "DuckDB", "Pinecone", "Weaviate", "Chroma",

    # Cloud / DevOps / Infra
    "AWS", "Azure", "GCP", "Google Cloud", "DigitalOcean", "Fly.io",
    "Vercel", "Netlify", "Cloudflare", "Heroku", "Render",
    "Docker", "Kubernetes", "K8s", "Helm", "Istio", "Terraform",
    "Pulumi", "Ansible", "Chef", "Puppet", "Packer", "Vagrant",
    "Jenkins", "GitLab CI", "GitHub Actions", "CircleCI", "Travis CI",
    "ArgoCD", "Spinnaker", "Prometheus", "Grafana", "Datadog", "New Relic",
    "Sentry", "PagerDuty", "Splunk", "ELK", "OpenTelemetry",
    "Lambda", "EC2", "S3", "ECS", "EKS", "Fargate", "CloudFront",
    "CloudFormation", "RDS", "Aurora", "SQS", "SNS", "Kinesis",

    # ML / Data / AI
    "PyTorch", "TensorFlow", "Keras", "JAX", "scikit-learn",
    "pandas", "NumPy", "SciPy", "Matplotlib", "Seaborn", "Plotly",
    "Hugging Face", "Transformers", "LangChain", "LlamaIndex",
    "Spark", "PySpark", "Hadoop", "Airflow", "Dagster", "Prefect",
    "Kafka", "RabbitMQ", "NATS", "Pulsar",
    "dbt", "Looker", "Tableau", "Power BI", "Metabase",
    "machine learning", "deep learning", "NLP", "computer vision",
    "reinforcement learning", "MLOps", "feature engineering",

    # Mobile
    "iOS", "Android", "Flutter", "Xamarin", "Ionic", "Cordova",
    "SwiftUI", "UIKit", "Jetpack Compose",

    # APIs / protocols / patterns
    "REST", "REST API", "gRPC", "WebSockets", "OAuth", "OAuth2", "OIDC",
    "JWT", "SAML", "LDAP", "Webhooks", "Server-Sent Events", "SSE",
    "Microservices", "Monolith", "Event-driven", "CQRS", "Event sourcing",
    "Pub/sub", "Service mesh", "API Gateway",

    # Testing
    "Jest", "Vitest", "Mocha", "Chai", "Cypress", "Playwright",
    "Selenium", "Puppeteer", "JUnit", "TestNG", "pytest", "unittest",
    "RSpec", "Testcontainers", "test-driven development", "TDD", "BDD",

    # Tools / collaboration
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Linear",
    "Notion", "Confluence", "Figma", "Sketch", "Adobe XD", "InVision",
    "Slack", "Discord", "Zoom", "VSCode", "IntelliJ", "Vim", "Emacs",

    # Methodologies / soft skills
    "Agile", "Scrum", "Kanban", "Lean", "Waterfall", "SAFe", "OKRs",
    "Leadership", "mentoring", "team lead", "tech lead", "engineering manager",
    "code review", "pair programming", "system design", "architecture",
    "performance optimization", "scalability", "accessibility", "a11y",
    "SEO", "internationalization", "i18n", "localization", "l10n",
    "security", "OWASP", "penetration testing", "threat modeling",
    "stakeholder management", "product sense", "data-driven", "experimentation",
    "A/B testing", "user research", "design systems",
]


# Skills with non-word characters need bespoke regex (\b doesn't work for + # .)
SPECIAL_SKILLS: dict[str, str] = {
    "C++": r"(?:^|[^a-zA-Z0-9])c\+\+(?:$|[^a-zA-Z0-9+])",
    "C#": r"(?:^|[^a-zA-Z0-9])c#(?:$|[^a-zA-Z0-9#])",
    ".NET": r"(?:^|[^a-zA-Z0-9.])\.net(?:$|[^a-zA-Z0-9.])",
}


@dataclass
class MatchResult:
    score: int | None  # 0..100, or None if JD has no recognized skills
    matched: list[str]
    missing: list[str]
    extra: list[str]  # skills in resume that the JD doesn't ask for (FYI)


def extract_skills(text: str) -> set[str]:
    """Return the set of canonical skill names present in `text`."""
    if not text:
        return set()
    text_lower = text.lower()
    found: set[str] = set()

    for skill in SKILLS:
        if skill in SPECIAL_SKILLS:
            continue
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found.add(skill)

    for skill, pattern in SPECIAL_SKILLS.items():
        if re.search(pattern, text_lower):
            found.add(skill)

    return found


def match(resume_text: str, jd_text: str) -> MatchResult:
    """Compare a resume against a single job description."""
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)

    if not jd_skills:
        return MatchResult(score=None, matched=[], missing=[], extra=sorted(resume_skills))

    matched = resume_skills & jd_skills
    missing = jd_skills - resume_skills
    extra = resume_skills - jd_skills
    score = int(round(100 * len(matched) / len(jd_skills)))

    return MatchResult(
        score=score,
        matched=sorted(matched),
        missing=sorted(missing),
        extra=sorted(extra),
    )
